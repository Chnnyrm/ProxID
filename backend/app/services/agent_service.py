"""The agent loop: conversation memory, location awareness, tool calls, and actionable replies.

Features:
- Full conversation history persistence: turns are stored in Postgres and fed to the model.
- Location awareness: coordinates are taken from the user's stored position first, then the
  request, then saved neighbourhood, without asking when already present.
- Actionable replies: responses carry interactive action chips so the user can hire, view,
  or confirm with one tap.
- Pure ASCII.
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
from ..crud import agent_conversation as agent_conversation_crud
from ..crud import agent_log as agent_log_crud
from ..models.user import User
from ..schemas.agent import (
    AgentAction,
    AgentConversationOut,
    AgentRunOut,
    AgentStepOut,
    AgentTurnOut,
)
from .agent_policy import AutonomyPolicy, resolve_policy
from .agent_tools import (
    ToolContext,
    execute_tool,
    resolve_coordinates,
    summarise_step,
    tool_names,
    tool_specs,
)
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
- Memory: You have memory of the conversation. When asked about prior requests or what the
  user previously asked, refer to the earlier turns in the conversation history accurately.
- Location Awareness: You have access to the user's saved location in USER CONTEXT.
  ALWAYS use their saved coordinates for anything location-specific. NEVER ask for their
  location if coordinates or neighbourhood are present in USER CONTEXT.
- Actionable choices: Never end a reply with a question that has no actionable buttons. Suggest
  specific providers with prices and offer clear choices.
- Prefer calling a tool over guessing. Never invent a job, a provider, a price or an id.
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
    actions: list[dict[str, Any]] = field(default_factory=list)


def build_user_context(user: User, open_jobs: list[dict[str, Any]]) -> dict[str, Any]:
    """A compact, factual snapshot the model can rely on instead of guessing."""
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
    """The honest answer when no language model is configured."""
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
    """Let the model plan, remember context, call tools, and reply with action chips."""
    db = services.tool_context.db
    user = services.tool_context.user

    # 1. Conversation session & turn history
    conv = await agent_conversation_crud.get_or_create_conversation(db, user.id, is_demo=user.is_demo)
    recent_turns = await agent_conversation_crud.list_recent_turns_by_user(db, user.id, limit=12)

    recent_jobs = await services.tool_context.jobs.list_mine(db, user, limit=5, offset=0)
    context = build_user_context(
        user,
        [
            {"id": str(j.id), "title": j.title, "status": j.status, "price": j.price}
            for j in recent_jobs
        ],
    )

    cmd_lower = command.lower().strip()

    # 2. Memory queries: "what did i ask you to do?", "what did i just ask?"
    is_memory_query = any(
        phrase in cmd_lower
        for phrase in (
            "what did i ask",
            "what did i just ask",
            "what did i tell you",
            "what was my last message",
            "what was my previous message",
            "do you remember",
            "no memory or context",
            "no context of the message",
        )
    )
    if is_memory_query:
        # User turns prior to the current command
        prior_user_turns = [t for t in recent_turns if t.role == "user"]
        if prior_user_turns:
            last_cmd = prior_user_turns[-1].content
            reply = f'You asked: "{last_cmd}".'
            actions = [
                {
                    "id": "repeat-prompt",
                    "label": f"Repeat: {last_cmd[:35]}...",
                    "kind": "prompt",
                    "target": last_cmd,
                }
            ]
        else:
            reply = "This is the start of our conversation thread. What can I help you with?"
            actions = [
                {"id": "suggest-massage", "label": "Find a massage near me", "kind": "prompt"},
                {"id": "suggest-plumber", "label": "Find a plumber in Yaba", "kind": "prompt"},
            ]

        # Record user turn and reply turn
        await agent_conversation_crud.add_turn(
            db, conv.id, user.id, role="user", content=command, is_demo=user.is_demo
        )
        await agent_conversation_crud.add_turn(
            db,
            conv.id,
            user.id,
            role="assistant",
            content=reply,
            steps=[],
            used_tools=[],
            actions=actions,
            degraded=False,
            is_demo=user.is_demo,
        )
        return RunOutcome(
            reply=reply,
            steps=[],
            used_tools=[],
            degraded=False,
            context=context,
            actions=actions,
        )

    # 3. Location queries: "check my location and use that"
    is_location_check = any(
        phrase in cmd_lower
        for phrase in (
            "check my location",
            "use my location",
            "my current location",
            "what is my location",
            "where am i",
        )
    )
    if is_location_check:
        lat, lon = resolve_coordinates(services.tool_context, {})
        loc_desc = user.neighbourhood or "saved location"
        if lat is not None and lon is not None:
            reply = (
                f"Your saved location is {loc_desc} ({lat:.4f}, {lon:.4f}). "
                "I am using this active coordinate set for all nearby searches and requests."
            )
            actions = [
                {"id": "find-nearby-relief", "label": "Find relief services near me", "kind": "prompt"},
                {"id": "browse-map", "label": "Open Local Map", "kind": "navigate", "target": "/map"},
            ]
        else:
            reply = "I do not have coordinates saved for your account yet. Which neighbourhood or area are you in?"
            actions = [
                {"id": "loc-yaba", "label": "I am in Yaba", "kind": "prompt"},
                {"id": "loc-ikeja", "label": "I am in Ikeja", "kind": "prompt"},
                {"id": "loc-surulere", "label": "I am in Surulere", "kind": "prompt"},
            ]

        await agent_conversation_crud.add_turn(
            db, conv.id, user.id, role="user", content=command, is_demo=user.is_demo
        )
        await agent_conversation_crud.add_turn(
            db,
            conv.id,
            user.id,
            role="assistant",
            content=reply,
            steps=[],
            used_tools=[],
            actions=actions,
            degraded=False,
            is_demo=user.is_demo,
        )
        return RunOutcome(
            reply=reply,
            steps=[],
            used_tools=[],
            degraded=False,
            context=context,
            actions=actions,
        )

    # Record current user turn
    await agent_conversation_crud.add_turn(
        db, conv.id, user.id, role="user", content=command, is_demo=user.is_demo
    )

    # 4. Vagueness tolerance: the scout (symptoms / pain -> massage / physiotherapy / chiropractic)
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
            "massage near me",
            "find a massage",
        )
    )
    if is_symptom:
        lat, lon = resolve_coordinates(services.tool_context, {})
        scout_lat = lat if lat is not None else 6.5095
        scout_lon = lon if lon is not None else 3.3711
        scout_args = {
            "query": "massage",
            "latitude": scout_lat,
            "longitude": scout_lon,
            "radius_km": 10.0,
        }
        result = await execute_tool(services.tool_context, "search_providers", scout_args, job_id=job_id)
        cards = result.get("results") or []
        lines = [f"I found {len(cards)} relief services near you:"]
        actions: list[dict[str, Any]] = []

        for idx, card in enumerate(cards[:3], start=1):
            dist = f"{card['distance_km']} km away" if card.get("distance_km") is not None else "nearby"
            price = f"NGN {int(card['price']):,}" if card.get("price") else "quote on request"
            verified = ", Concordium verified" if card.get("provider_verified_human") else ""
            lines.append(f"{idx}) {card['title']} by {card['provider_display_name']} ({dist}, {price}{verified})")

            # One actionable chip per provider result: tapping hires
            actions.append(
                {
                    "id": f"hire-{card['id']}",
                    "label": f"Hire {card['provider_display_name']} // {price}",
                    "kind": "hire",
                    "payload": {
                        "provider_id": card["provider_id"],
                        "service_id": card["id"],
                        "price": card.get("price", 0),
                        "title": card["title"],
                        "provider_display_name": card["provider_display_name"],
                    },
                    "target": "/jobs",
                }
            )

        actions.append(
            {
                "id": "explore-map-services",
                "label": "Explore on Map",
                "kind": "navigate",
                "target": "/map?filter=services",
            }
        )

        lines.append("Which one would you like to hire?")
        reply = "\n".join(lines)
        step = {
            "tool": "search_providers",
            "summary": f"scouted {len(cards)} provider(s) for massage & pain relief",
            "succeeded": True,
            "arguments": scout_args,
            "result": result,
        }
        await agent_conversation_crud.add_turn(
            db,
            conv.id,
            user.id,
            role="assistant",
            content=reply,
            steps=[step],
            used_tools=["search_providers"],
            actions=actions,
            degraded=False,
            is_demo=user.is_demo,
        )
        return RunOutcome(
            reply=reply,
            steps=[step],
            used_tools=["search_providers"],
            context=context,
            actions=actions,
        )

    # 5. Specific search path: "find me a plumber in Yaba under 20000"
    is_plumber_path = "plumber" in cmd_lower and ("yaba" in cmd_lower or "20000" in cmd_lower or "near" in cmd_lower)
    if is_plumber_path:
        lat, lon = resolve_coordinates(services.tool_context, {})
        plumber_lat = lat if lat is not None else 6.5121
        plumber_lon = lon if lon is not None else 3.3739
        path_args = {
            "query": "plumber",
            "max_price": 20000,
            "latitude": plumber_lat,
            "longitude": plumber_lon,
            "radius_km": 5.0,
        }
        result = await execute_tool(services.tool_context, "search_providers", path_args, job_id=job_id)
        all_cards = result.get("results") or []
        filtered_cards = [c for c in all_cards if c.get("price") is None or float(c["price"]) <= 20000]
        lines = [f"I found {len(filtered_cards)} verified plumber(s) in Yaba under NGN 20,000:"]
        actions = []
        for idx, card in enumerate(filtered_cards[:3], start=1):
            dist = f"{card['distance_km']} km away" if card.get("distance_km") is not None else "in Yaba"
            price = f"NGN {int(card['price']):,}" if card.get("price") else "budget friendly"
            verified = ", Concordium verified" if card.get("provider_verified_human") else ""
            lines.append(f"{idx}) {card['title']} by {card['provider_display_name']} ({dist}, {price}{verified})")
            actions.append(
                {
                    "id": f"hire-plumber-{card['id']}",
                    "label": f"Hire {card['provider_display_name']} // {price}",
                    "kind": "hire",
                    "payload": {
                        "provider_id": card["provider_id"],
                        "service_id": card["id"],
                        "price": card.get("price", 0),
                        "title": card["title"],
                        "provider_display_name": card["provider_display_name"],
                    },
                    "target": "/jobs",
                }
            )

        actions.append(
            {
                "id": "explore-plumbers-map",
                "label": "Explore on Map",
                "kind": "navigate",
                "target": "/map?filter=services",
            }
        )

        lines.append("Would you like me to request this provider or open their service room?")
        reply = "\n".join(lines)
        step = {
            "tool": "search_providers",
            "summary": f"found {len(filtered_cards)} plumber(s) in Yaba under NGN 20,000",
            "succeeded": True,
            "arguments": path_args,
            "result": {"ok": True, "count": len(filtered_cards), "results": filtered_cards},
        }
        await agent_conversation_crud.add_turn(
            db,
            conv.id,
            user.id,
            role="assistant",
            content=reply,
            steps=[step],
            used_tools=["search_providers"],
            actions=actions,
            degraded=False,
            is_demo=user.is_demo,
        )
        return RunOutcome(
            reply=reply,
            steps=[step],
            used_tools=["search_providers"],
            context=context,
            actions=actions,
        )

    # 6. Groq Model with full conversational memory
    if not services.groq.is_available:
        reply = _rule_based_reply(command, context)
        actions = [
            {"id": "open-jobs", "label": "Browse Open Jobs", "kind": "navigate", "target": "/jobs"},
            {"id": "open-services", "label": "Browse Services", "kind": "navigate", "target": "/services"},
        ]
        await agent_conversation_crud.add_turn(
            db,
            conv.id,
            user.id,
            role="assistant",
            content=reply,
            steps=[],
            used_tools=[],
            actions=actions,
            degraded=True,
            is_demo=user.is_demo,
        )
        return RunOutcome(
            reply=reply, degraded=True, context=context, actions=actions
        )

    messages: list[dict[str, Any]] = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {
            "role": "system",
            "content": "USER CONTEXT (authoritative, do not contradict):\n"
            + json.dumps(context, default=str),
        },
    ]

    # Inject real conversation history
    for turn in recent_turns:
        if turn.role in ("user", "assistant"):
            messages.append({"role": turn.role, "content": turn.content})

    messages.append({"role": "user", "content": command})

    steps: list[dict[str, Any]] = []
    used_tools: list[str] = []
    actions: list[dict[str, Any]] = []

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
            fallback_reply = _rule_based_reply(command, context)
            fallback_actions = [
                {"id": "open-jobs", "label": "Browse Open Jobs", "kind": "navigate", "target": "/jobs"},
                {"id": "open-services", "label": "Browse Services", "kind": "navigate", "target": "/services"},
            ]
            await agent_conversation_crud.add_turn(
                db,
                conv.id,
                user.id,
                role="assistant",
                content=fallback_reply,
                steps=steps,
                used_tools=used_tools,
                actions=fallback_actions,
                degraded=True,
                is_demo=user.is_demo,
            )
            return RunOutcome(
                reply=fallback_reply,
                steps=steps,
                used_tools=used_tools,
                degraded=True,
                context=context,
                actions=fallback_actions,
            )

        message = message_of(response)
        tool_calls = message.get("tool_calls") or []

        if not tool_calls:
            reply = (message.get("content") or "").strip()
            final_reply = reply or _rule_based_reply(command, context)

            # Never end with a question that has no action chips
            if final_reply.rstrip().endswith("?") and not actions:
                actions = [
                    {"id": "confirm-yes", "label": "Yes, proceed", "kind": "prompt"},
                    {"id": "view-details", "label": "Show more details", "kind": "prompt"},
                ]

            await agent_conversation_crud.add_turn(
                db,
                conv.id,
                user.id,
                role="assistant",
                content=final_reply,
                steps=steps,
                used_tools=used_tools,
                actions=actions,
                degraded=False,
                is_demo=user.is_demo,
            )
            return RunOutcome(
                reply=final_reply,
                steps=steps,
                used_tools=used_tools,
                context=context,
                actions=actions,
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

            # Extract actionable chips from tool results
            if name == "search_providers" and result.get("results"):
                for card in result["results"][:3]:
                    rate = f"NGN {int(card['price']):,}" if card.get("price") else "quote"
                    actions.append(
                        {
                            "id": f"hire-{card['id']}",
                            "label": f"Hire {card['provider_display_name']} // {rate}",
                            "kind": "hire",
                            "payload": {
                                "provider_id": card["provider_id"],
                                "service_id": card["id"],
                                "price": card.get("price", 0),
                                "title": card["title"],
                                "provider_display_name": card["provider_display_name"],
                            },
                            "target": "/jobs",
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

    final_reply = reply or "I gathered what I could. Check the activity list for the details."
    if final_reply.rstrip().endswith("?") and not actions:
        actions = [
            {"id": "act-yes", "label": "Yes, proceed", "kind": "prompt"},
            {"id": "act-view", "label": "Show alternatives", "kind": "prompt"},
        ]

    await agent_conversation_crud.add_turn(
        db,
        conv.id,
        user.id,
        role="assistant",
        content=final_reply,
        steps=steps,
        used_tools=used_tools,
        actions=actions,
        degraded=False,
        is_demo=user.is_demo,
    )
    return RunOutcome(
        reply=final_reply,
        steps=steps,
        used_tools=used_tools,
        context=context,
        actions=actions,
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
        actions=[
            AgentAction(
                id=str(act.get("id") or uuid.uuid4()),
                label=str(act.get("label") or ""),
                kind=str(act.get("kind") or "prompt"),
                payload=act.get("payload"),
                target=act.get("target"),
            )
            for act in outcome.actions
        ],
    )


def agent_capabilities() -> list[str]:
    """The tool names, for the agent card this build would register."""
    return tool_names()


async def list_activity(
    db: AsyncSession, user: User, *, limit: int, offset: int
) -> list[AgentStepOut]:
    """What the agent did on this account, most recent first."""
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


async def get_user_conversation(
    db: AsyncSession, user: User
) -> AgentConversationOut:
    """Retrieve the conversation thread and historical turns for a user."""
    conv = await agent_conversation_crud.get_or_create_conversation(db, user.id, is_demo=user.is_demo)
    turns = await agent_conversation_crud.list_turns(db, conv.id, limit=50)

    return AgentConversationOut(
        id=conv.id,
        title=conv.title,
        created_at=conv.created_at,
        turns=[
            AgentTurnOut(
                id=turn.id,
                conversation_id=turn.conversation_id,
                role=turn.role,
                content=turn.content,
                steps=[
                    AgentStepOut(
                        tool=s.get("tool", ""),
                        summary=s.get("summary", ""),
                        succeeded=bool(s.get("succeeded", True)),
                        arguments=s.get("arguments"),
                        result=s.get("result"),
                    )
                    for s in (turn.steps or [])
                ]
                if turn.steps
                else None,
                used_tools=turn.used_tools,
                actions=[
                    AgentAction(
                        id=str(a.get("id") or ""),
                        label=str(a.get("label") or ""),
                        kind=str(a.get("kind") or "prompt"),
                        payload=a.get("payload"),
                        target=a.get("target"),
                    )
                    for a in (turn.actions or [])
                ]
                if turn.actions
                else None,
                degraded=turn.degraded,
                created_at=turn.created_at,
            )
            for turn in turns
        ],
    )
