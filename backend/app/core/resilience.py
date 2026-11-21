"""Resilience primitives for outbound boundaries only.

A circuit breaker, a bulkhead, a bounded jittered retry and an explicit timeout,
one policy per dependency. These are constructed once in the composition root
and injected; a service never builds one inline, and they are never applied to an
in-process call between our own layers.

Ported from Gigr's ``core/resilience.py`` and simplified to the four things
ProxID actually calls out to: Groq, Cloudinary, Brevo, and (later) Concordium.
"""

from __future__ import annotations

import asyncio
import random
import time
from collections.abc import Awaitable, Callable
from dataclasses import dataclass
from enum import Enum
from typing import Protocol, TypeVar

from .errors import DependencyUnavailableError
from .logging import get_logger

T = TypeVar("T")

logger = get_logger("resilience")


def http_status(error: BaseException) -> int | None:
    """The HTTP status an outbound exception carries, when it carries one."""
    status = getattr(error, "status", None)
    if status is None:
        status = getattr(error, "status_code", None)
    response = getattr(error, "response", None)
    if status is None and response is not None:
        status = getattr(response, "status_code", None)
    return status if isinstance(status, int) else None


class MetricSink(Protocol):
    """Where breaker state changes and fallback activations are reported."""

    def increment(self, name: str, tags: dict[str, str]) -> None: ...


class StructuredLogMetricSink:
    """Default sink: one structured log line per metric, no extra dependency."""

    def __init__(self, component: str) -> None:
        self._component = component

    def increment(self, name: str, tags: dict[str, str]) -> None:
        logger.warning(
            "metric",
            extra={"metric": name, "component": self._component, "tags": tags},
        )


class BreakerState(str, Enum):
    """The three states a breaker may be in."""

    CLOSED = "closed"
    OPEN = "open"
    HALF_OPEN = "half_open"


@dataclass(frozen=True)
class ResiliencePolicy:
    """One policy per outbound dependency, not per call site."""

    dependency: str
    timeout_seconds: float = 15.0
    failure_threshold: int = 5
    reset_timeout_seconds: float = 30.0
    half_open_probes: int = 1
    max_attempts: int = 3
    base_backoff_seconds: float = 0.25
    max_backoff_seconds: float = 4.0
    max_concurrency: int = 4


class DependencyCircuitBreaker:
    """Closed, open, half-open. One instance per outbound dependency.

    Transitions are logged and counted. ``allows_request`` is the only gate: an
    open breaker refuses immediately rather than adding latency to a dependency
    that is already failing.
    """

    def __init__(self, policy: ResiliencePolicy, metrics: MetricSink) -> None:
        self._policy = policy
        self._metrics = metrics
        self._state = BreakerState.CLOSED
        self._consecutive_failures = 0
        self._opened_at = 0.0
        self._probes_in_flight = 0

    @property
    def state(self) -> BreakerState:
        return self._state

    def _transition(self, new_state: BreakerState, reason: str) -> None:
        if new_state is self._state:
            return
        previous = self._state
        self._state = new_state
        self._metrics.increment(
            "breaker.state_change",
            {
                "dependency": self._policy.dependency,
                "from": previous.value,
                "to": new_state.value,
                "reason": reason,
            },
        )

    def allows_request(self) -> bool:
        """True when a call may proceed right now."""
        if self._state is BreakerState.CLOSED:
            return True
        if self._state is BreakerState.OPEN:
            if time.monotonic() - self._opened_at >= self._policy.reset_timeout_seconds:
                self._transition(BreakerState.HALF_OPEN, "reset_timeout_elapsed")
                self._probes_in_flight = 0
                return True
            return False
        # Half open: only the configured number of probes may be in flight.
        if self._probes_in_flight < self._policy.half_open_probes:
            self._probes_in_flight += 1
            return True
        return False

    def record_success(self) -> None:
        self._consecutive_failures = 0
        self._probes_in_flight = 0
        self._transition(BreakerState.CLOSED, "probe_succeeded")

    def record_failure(self) -> None:
        self._probes_in_flight = max(0, self._probes_in_flight - 1)
        self._consecutive_failures += 1
        if self._state is BreakerState.HALF_OPEN:
            self._opened_at = time.monotonic()
            self._transition(BreakerState.OPEN, "probe_failed")
            return
        if self._consecutive_failures >= self._policy.failure_threshold:
            self._opened_at = time.monotonic()
            self._transition(BreakerState.OPEN, "failure_threshold_reached")


class DependencyGuard:
    """The boundary around one outbound dependency.

    ``call`` applies, in order: breaker refusal, bulkhead admission, a hard
    timeout, and a bounded jittered retry for the exceptions the caller marks as
    retryable. A retry only happens when ``is_retryable`` says the operation is
    safe to repeat; the default retries nothing beyond transport errors.
    """

    def __init__(
        self,
        policy: ResiliencePolicy,
        metrics: MetricSink,
        *,
        clock: Callable[[], float] = time.monotonic,
        sleeper: Callable[[float], Awaitable[None]] = asyncio.sleep,
    ) -> None:
        self._policy = policy
        self._metrics = metrics
        self._breaker = DependencyCircuitBreaker(policy, metrics)
        self._bulkhead = asyncio.Semaphore(policy.max_concurrency)
        self._clock = clock
        self._sleeper = sleeper

    @property
    def dependency(self) -> str:
        return self._policy.dependency

    @property
    def breaker_state(self) -> BreakerState:
        return self._breaker.state

    def _unavailable(self, operation: str, cause: str) -> DependencyUnavailableError:
        return DependencyUnavailableError(
            self._policy.dependency,
            f"{operation} failed: dependency={self._policy.dependency} cause={cause} "
            f"breaker={self._breaker.state.value} (layer=http_client)",
            operation=operation,
            external_message=(
                f"We could not reach {self._policy.dependency} just now. "
                "Nothing was lost. Try again in a moment."
            ),
        )

    async def call(
        self,
        operation: str,
        function: Callable[[], Awaitable[T]],
        *,
        is_retryable: Callable[[BaseException], bool] | None = None,
    ) -> T:
        """Run one outbound call under the policy.

        Raises ``DependencyUnavailableError`` when the breaker is open, the
        timeout expires, or every permitted attempt fails.
        """
        if not self._breaker.allows_request():
            self._metrics.increment(
                "breaker.rejected", {"dependency": self._policy.dependency, "operation": operation}
            )
            raise self._unavailable(operation, "circuit_breaker_open")

        retryable = is_retryable or (lambda error: isinstance(error, (TimeoutError, OSError)))
        attempts = max(1, self._policy.max_attempts)
        last_error: BaseException | None = None

        async with self._bulkhead:
            for attempt in range(1, attempts + 1):
                try:
                    result = await asyncio.wait_for(
                        function(), timeout=self._policy.timeout_seconds
                    )
                except asyncio.TimeoutError as error:
                    last_error = error
                    self._metrics.increment(
                        "outbound.timeout",
                        {"dependency": self._policy.dependency, "operation": operation},
                    )
                except Exception as error:  # noqa: BLE001 - classified below, never swallowed
                    last_error = error
                    if not retryable(error):
                        self._breaker.record_failure()
                        raise
                else:
                    self._breaker.record_success()
                    return result

                if attempt < attempts:
                    delay = min(
                        self._policy.base_backoff_seconds * (2 ** (attempt - 1)),
                        self._policy.max_backoff_seconds,
                    )
                    # Full jitter: spreads retries from concurrent callers.
                    await self._sleeper(random.uniform(0, delay))

        self._breaker.record_failure()
        raise self._unavailable(operation, type(last_error).__name__ if last_error else "unknown")


def build_guard(policy: ResiliencePolicy, component: str) -> DependencyGuard:
    """Construct a guard with the standard log metric sink.

    Called from ``core/container.py`` only. A service receives the guard.
    """
    return DependencyGuard(policy, StructuredLogMetricSink(component))
