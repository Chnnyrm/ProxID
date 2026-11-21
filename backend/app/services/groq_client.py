"""The Groq client: one place for key rotation and chat completions.

Ported from Gigr's ``services/groq_client.py``. The behaviour kept deliberately:

- several keys, tried in order, rotating on a 429 rather than failing the feature;
- the model name comes from configuration, not from a literal at the call site;
- ``extract_json`` tolerates a model that wraps JSON in prose or a code fence;
- ``message_of`` and ``text_of`` read a completion without raising on a malformed
  body.

What was dropped: the startup "is this model retired" probe, which mutated a global
``settings`` object. Try-once-then-report is replaced by the caller handling a
failed completion, which is where the decision belongs.

Every call goes through the injected dependency guard: timeout, breaker, bounded
retry, one bulkhead per dependency.
"""

from __future__ import annotations

import json
import re
from typing import Any

import httpx

from ..core.config import Settings
from ..core.errors import DependencyUnavailableError
from ..core.logging import get_logger
from ..core.resilience import DependencyGuard, http_status

logger = get_logger("groq")

ChatMessage = dict[str, Any]


class GroqClient:
    """A thin, resilient wrapper around the one Groq endpoint this product uses."""

    def __init__(self, settings: Settings, guard: DependencyGuard) -> None:
        self._settings = settings
        self._guard = guard

    @property
    def is_available(self) -> bool:
        """True when at least one key is configured. The agent degrades without one."""
        return bool(self._settings.groq_keys_list)

    @property
    def model(self) -> str:
        return self._settings.GROQ_MODEL

    async def chat(
        self,
        messages: list[ChatMessage],
        *,
        tools: list[dict[str, Any]] | None = None,
        tool_choice: str | None = None,
        temperature: float = 0.2,
        max_tokens: int | None = None,
        timeout: float | None = None,
    ) -> dict[str, Any]:
        """Run one chat completion and return the parsed body.

        Raises ``DependencyUnavailableError`` when every key fails or the breaker is
        open. Callers degrade explicitly; nothing here swallows an error.
        """
        if not self.is_available:
            raise DependencyUnavailableError(
                "groq",
                "chat refused: no GROQ_API_KEY configured (layer=http_client)",
                operation="groq_chat",
                external_message=(
                    "The assistant is not connected on this deployment. Everything else in "
                    "ProxID still works."
                ),
            )

        payload: dict[str, Any] = {
            "model": self.model,
            "messages": messages,
            "temperature": temperature,
            "max_tokens": max_tokens if max_tokens is not None else self._settings.GROQ_MAX_TOKENS,
        }
        if tools:
            payload["tools"] = tools
            payload["tool_choice"] = tool_choice or "auto"

        if timeout is not None:
            # A per-call timeout below the guard's would be ignored; raising it above
            # the guard's would never fire. The guard is the single timeout owner.
            logger.debug("per-call groq timeout ignored; the dependency guard owns timeouts")

        async def attempt() -> dict[str, Any]:
            return await self._post_with_key_rotation(payload)

        return await self._guard.call(
            "groq_chat", attempt, is_retryable=lambda error: http_status(error) in (429, 500, 502, 503, 504)
        )

    async def _post_with_key_rotation(self, payload: dict[str, Any]) -> dict[str, Any]:
        """POST to Groq, trying each configured key once.

        Ported behaviour: a 429 on one key moves to the next key instead of failing
        the feature. Every other status raises immediately, because retrying an
        invalid request on four keys just makes four identical mistakes.
        """
        keys = self._settings.groq_keys_list
        last_error: Exception | None = None
        url = f"{self._settings.GROQ_BASE_URL.rstrip('/')}/chat/completions"

        async with httpx.AsyncClient(timeout=self._settings.GROQ_TIMEOUT_SECONDS) as client:
            for index, key in enumerate(keys):
                try:
                    response = await client.post(
                        url,
                        headers={
                            "Authorization": f"Bearer {key}",
                            "Content-Type": "application/json",
                        },
                        json=payload,
                    )
                except httpx.HTTPError as error:
                    last_error = error
                    logger.warning(
                        "groq call failed on a key, trying the next",
                        extra={"operation": "groq_chat", "key_index": index, "error": type(error).__name__},
                    )
                    continue

                if response.status_code == 429:
                    last_error = httpx.HTTPStatusError(
                        "rate limited", request=response.request, response=response
                    )
                    logger.warning(
                        "groq key rate limited, trying the next",
                        extra={"operation": "groq_chat", "key_index": index},
                    )
                    continue
                if response.status_code >= 400:
                    logger.warning(
                        "groq rejected the request",
                        extra={
                            "operation": "groq_chat",
                            "key_index": index,
                            "status": response.status_code,
                        },
                    )
                    response.raise_for_status()
                return response.json()

        if last_error is None:
            raise DependencyUnavailableError(
                "groq",
                "chat failed: every configured key was rate limited (layer=http_client)",
                operation="groq_chat",
                external_message=(
                    "The assistant is busy right now. Nothing was changed. Try again in a "
                    "few seconds."
                ),
            )
        raise last_error


def extract_json(text: str) -> Any:
    """Parse JSON out of a model response, tolerating prose and code fences.

    Trusting the whole string to be JSON is fragile: models wrap it, prefix it, or
    trail an explanation. Taking the outermost object is far more reliable.
    """
    if not text or not text.strip():
        raise ValueError("empty response")
    cleaned = re.sub(r"```(?:json)?\s*", "", text).strip("` \n")
    try:
        return json.loads(cleaned)
    except json.JSONDecodeError:
        pass
    start, end = cleaned.find("{"), cleaned.rfind("}")
    if start != -1 and end > start:
        return json.loads(cleaned[start : end + 1])
    raise ValueError("no JSON object found in response")


def message_of(response: dict[str, Any]) -> dict[str, Any]:
    """The assistant message from a completion, or an empty dict."""
    try:
        return response["choices"][0]["message"] or {}
    except (KeyError, IndexError, TypeError):
        return {}


def text_of(response: dict[str, Any]) -> str:
    """The assistant text from a completion, or an empty string."""
    return (message_of(response).get("content") or "").strip()
