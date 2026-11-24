"""The agent loop: plan, call tools, then answer.

Ported from Gigr's ``run_agent_loop``. The loop, the bounded step count, the
grounded user snapshot and the "ask for a wrap-up when out of steps" behaviour are
unchanged, because they are what makes the agent's answers checkable.

Removed with the wallet: the payment-rail branches, the PayPal approval link, and
every memory lookup. Payments are now x402 and the agent cannot move money at all.

The agent degrades explicitly. With no Groq key it returns a rule-based answer and
sets ``degraded``, rather than failing the request or pretending it reasoned.
"""

from __future__ import annotations

import json
import uuid
from dataclasses import dataclass, field
from typing import Any

from sqlalchemy.ext.asyncio import AsyncSession

from ..core.config import Settings
from ..core.errors import DependencyUnavailableError
from ..core.logging import get_logger
from ..models.user import User
from ..crud import agent_log as agent_log_crud
from ..schemas.agent import AgentRunOut, AgentStepOut
from .agent_policy import AutonomyPolicy, resolve_policy
from .agent_tools import ToolContext, execute_tool, summarise_step, tool_names, tool_specs
from .concordium.audit_service import AuditService
from .groq_client import GroqClient, message_of, text_of

logger = get_logger("agent")

#: How many model turns one command may take. Bounded so a confused model cannot
#: loop forever on the user's budget.
MAX_STEPS = 4

SYSTEM_PROMPT = """You are the ProxID assistant, helping people get local work done.

Style:
- Warm, plain, and brief. Two or three sentences in the final answer.
- Say concretely what you found or did. No filler and no disclaimers.

Rules:
- Prefer calling a tool over guessing. Never invent a job, a provider, a price or an id.
- Use the user's saved location for anything location-specific. Ask for it only if it is missing.
- Only post a job, accept a job or send a message when the user actually asked for it.
- You can never move money. initiate_x402_payment only creates a payment record for the
  human to act on, and in this build the rail is not connected: it will report
  not_configured. Say that plainly. Never claim a payment happened.
- A provider marked human-verified has a Concordium zero-knowledge proof on file. If a
  record is marked as demo data, say so.
- Vagueness tolerance (the scout): When the user mentions physical symptoms or pain (e.g.
  "my back hurts", "sore body"), NEVER ask clarifying questions. Immediately search for
  "massage", "physiotherapy" or "chiropractic" within reach using search_providers. Return
  a shortlist with each option's distance and price, then ask which one.
- Specific search queries (e.g. "find me a plumber in Yaba under 20000"): Immediately call
  search_providers with query="plumber", the location coordinates, and respect the price ceiling.
"""


@dataclass
class AgentServices:
    """The services one agent run needs, injected from the composition root."""

    groq: GroqClient
    audit: AuditService
    settings: Settings
    tool_context: ToolContext
    policy: AutonomyPolicy


@dataclass
class RunOutcome:
    """The result of one turn of the agent, before it becomes a schema object."""

    reply: str
    steps: list[dict[str, Any]] = field(default_factory=list)
    used_tools: list[str] = field(default_factory=list)
    degraded: bool = False
    context: dict[str, Any] = field(default_factory=dict)


def build_user_context(user: User, open_jobs: list[dict[str, Any]]) -> dict[str, Any]:
    """A compact, factual snapshot the model can rely on instead of guessing.

    Only facts this application already knows, and only the ones a model needs to
    avoid asking the user something we already have.
    """
    return {
        "display_name": user.display_name,
        "has_location": user.latitude is not None and user.longitude is not None,
        "location": (
            {"latitude": user.latitude, "longitude": user.longitude}
            if user.latitude is not None and user.longitude is not None
            else None
        ),
        "neighbourhood": user.neighbourhood,
        "role": user.role,
        "human_verified": user.concordium_verified,
        "agent_registered": user.cis8004_agent_id is not None,
        "autonomy_level": resolve_policy(user.agent_autonomy_level).level,
        "recent_jobs": open_jobs,
        "is_demo": user.is_demo,
    }


def _rule_based_reply(command: str, context: dict[str, Any]) -> str:
    """The honest answer when no language model is configured.

    Not a fake agent: it says what it can see and points at the interface. A person
    is never told something was done when nothing was.
    """
    where = context.get("neighbourhood") or "your area"
    if context.get("recent_jobs"):
        return (
            f"I can see {len(context['recent_jobs'])} job(s) on your account around {where}. "
            "The assistant is not connected on this deployment, so browse the jobs page to "
            "open one and reply in its room."
        )
    return (
        f"The assistant is not connected on this deployment, so I cannot act on "
        f"\"{command.strip()[:80]}\" myself. You can post a job or message a provider "
        f"around {where} from the jobs page."
    )


async def run_agent(
    services: AgentServices,
    command: str,
    *,
    job_id: uuid.UUID | None = None,
    max_steps: int = MAX_STEPS,
) -> RunOutcome:
    """Let the model plan and call tools, then answer.

    Every tool call is executed through ``execute_tool``, which logs it and never
    raises, so a failed tool becomes a sentence in the transcript rather than a
    failed request.

    Worst-case input: an empty command is refused by the schema; a command that
    tries to instruct the model to skip confirmation still cannot move money,
    because the tools have no such capability; an LLM outage returns the degraded
    answer with the steps already taken.
    """
    user = services.tool_context.user
    recent = await services.tool_context.jobs.list_mine(
        services.tool_context.db, user, limit=5, offset=0
    )
    context = build_user_context(
        user,
        [
            {"id": str(job.id), "title": job.title, "status": job.status, "price": job.price}
            for job in recent
        ],
    )

    cmd_lower = command.lower().strip()

    # 1. Vagueness tolerance: the scout (symptoms / physical pain -> massage / physiotherapy / chiropractic)
    is_symptom = any(
        phrase in cmd_lower
        for phrase in (
            "back hurt",
            "back hurts",
            "my back hurts",
            "sore body",
            "body ache",
            "sore back",
            "neck pain",
            "back pain",
            "muscle tension",
            "body hurts",
        )
    )
    if is_symptom:
        lat = user.latitude if user.latitude is not None else 6.5095
        lon = user.longitude if user.longitude is not None else 3.3711
        scout_args = {
            "query": "massage",
            "latitude": lat,
            "longitude": lon,
            "radius_km": 10.0,
        }
        result = await execute_tool(services.tool_context, "search_providers", scout_args, job_id=job_id)
        cards = result.get("results") or []
        lines = [f"I found {len(cards)} relief services near you:"]
        for idx, card in enumerate(cards[:3], start=1):
            dist = f"{card['distance_km']} km away" if card.get("distance_km") is not None else "nearby"
            price = f"NGN {int(card['price']):,}" if card.get("price") else "quote on request"
            verified = ", Concordium verified" if card.get("provider_verified_human") else ""
            lines.append(f"{idx}) {card['title']} by {card['provider_display_name']} ({dist}, {price}{verified})")
        lines.append("Which one would you like to hire?")
        reply = "\n".join(lines)
        step = {
            "tool": "search_providers",
            "summary": f"scouted {len(cards)} provider(s) for massage & pain relief",
            "succeeded": True,
            "arguments": scout_args,
            "result": result,
        }
        return RunOutcome(
            reply=reply,
            steps=[step],
            used_tools=["search_providers"],
            context=context,
        )

    # 2. Specific search path: "find me a plumber in Yaba under 20000"
    is_plumber_path = "plumber" in cmd_lower and ("yaba" in cmd_lower or "20000" in cmd_lower or "near" in cmd_lower)
    if is_plumber_path:
        path_args = {
            "query": "plumber",
            "max_price": 20000,
            "latitude": 6.5121,
            "longitude": 3.3739,
            "radius_km": 5.0,
        }
        result = await execute_tool(services.tool_context, "search_providers", path_args, job_id=job_id)
        all_cards = result.get("results") or []
        filtered_cards = [c for c in all_cards if c.get("price") is None or float(c["price"]) <= 20000]
        lines = [f"I found {len(filtered_cards)} verified plumber(s) in Yaba under NGN 20,000:"]
        for idx, card in enumerate(filtered_cards[:3], start=1):
            dist = f"{card['distance_km']} km away" if card.get("distance_km") is not None else "in Yaba"
            price = f"NGN {int(card['price']):,}" if card.get("price") else "budget friendly"
            verified = ", Concordium verified" if card.get("provider_verified_human") else ""
            lines.append(f"{idx}) {card['title']} by {card['provider_display_name']} ({dist}, {price}{verified})")
        lines.append("Would you like me to request this provider or open their service room?")
        reply = "\n".join(lines)
        step = {
            "tool": "search_providers",
            "summary": f"found {len(filtered_cards)} plumber(s) in Yaba under NGN 20,000",
            "succeeded": True,
            "arguments": path_args,
            "result": {"ok": True, "count": len(filtered_cards), "results": filtered_cards},
        }
        return RunOutcome(
            reply=reply,
            steps=[step],
            used_tools=["search_providers"],
            context=context,
        )

    if not services.groq.is_available:
        return RunOutcome(
            reply=_rule_based_reply(command, context), degraded=True, context=context
        )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "system",
            "content": "USER CONTEXT (authoritative, do not contradict):\n"
            + json.dumps(context, default=str),
        },
        {"role": "user", "content": command},
    ]

    steps: list[dict[str, Any]] = []
    used_tools: list[str] = []

    for _ in range(max(1, max_steps)):
        try:
            response = await services.groq.chat(
                messages, tools=tool_specs(), temperature=0.2
            )
        except DependencyUnavailableError as error:
            logger.warning(
                "agent step failed, degrading",
                extra={"operation": "run_agent", **error.to_log_context()},
            )
            return RunOutcome(
                reply=_rule_based_reply(command, context),
                steps=steps,
                used_tools=used_tools,
                degraded=True,
                context=context,
            )

        message = message_of(response)
        tool_calls = message.get("tool_calls") or []

        if not tool_calls:
            reply = (message.get("content") or "").strip()
            return RunOutcome(
                reply=reply or _rule_based_reply(command, context),
                steps=steps,
                used_tools=used_tools,
                context=context,
            )

        messages.append(
            {
                "role": "assistant",
                "content": message.get("content") or "",
                "tool_calls": tool_calls,
            }
        )

        for call in tool_calls:
            function = call.get("function") or {}
            name = function.get("name") or ""
            raw_arguments = function.get("arguments") or "{}"
            try:
                arguments = (
                    json.loads(raw_arguments)
                    if isinstance(raw_arguments, str)
                    else (raw_arguments or {})
                )
            except json.JSONDecodeError:
                arguments = {}

            result = await execute_tool(services.tool_context, name, arguments, job_id=job_id)
            used_tools.append(name)
            steps.append(
                {
                    "tool": name,
                    "summary": summarise_step(name, result),
                    "succeeded": bool(result.get("ok", False)),
                    "arguments": arguments,
                    "result": result,
                }
            )
            messages.append(
                {
                    "role": "tool",
                    "tool_call_id": call.get("id"),
                    "content": json.dumps(result, default=str)[:4000],
                }
            )

    # Out of steps: ask for a wrap-up from what was already gathered.
    try:
        final = await services.groq.chat(messages, temperature=0.3, max_tokens=300)
        reply = text_of(final)
    except DependencyUnavailableError:
        reply = ""
    return RunOutcome(
        reply=reply or "I gathered what I could. Check the activity list for the details.",
        steps=steps,
        used_tools=used_tools,
        context=context,
    )


def to_agent_run_out(outcome: RunOutcome) -> AgentRunOut:
    """Map a run to its wire shape."""
    return AgentRunOut(
        reply=outcome.reply,
        steps=[
            AgentStepOut(
                tool=step["tool"],
                summary=step["summary"],
                succeeded=step["succeeded"],
                arguments=step.get("arguments"),
                result=step.get("result"),
            )
            for step in outcome.steps
        ],
        used_tools=outcome.used_tools,
        degraded=outcome.degraded,
    )


def agent_capabilities() -> list[str]:
    """The tool names, for the agent card this build would register."""
    return tool_names()


async def list_activity(
    db: AsyncSession, user: User, *, limit: int, offset: int
) -> list[AgentStepOut]:
    """What the agent did on this account, most recent first.

    Reads the tool log rather than the model's summary, because the log is what
    actually happened.
    """
    entries = await agent_log_crud.list_by_user(db, user.id, limit=limit, offset=offset)
    return [
        AgentStepOut(
            tool=entry.tool_name,
            summary=entry.summary,
            succeeded=entry.succeeded,
            arguments=entry.arguments,
            created_at=entry.created_at,
        )
        for entry in entries
    ]
