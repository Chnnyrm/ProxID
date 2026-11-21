"""Agent routes: run a command, inspect the tool log, read the agent card."""

from __future__ import annotations


from fastapi import APIRouter, Depends, Query
from sqlalchemy.ext.asyncio import AsyncSession

from ....core.container import Container
from ....core.errors import NotConfiguredError
from ....schemas.agent import AgentRunOut, AgentRunRequest, AgentStepOut
from ...deps import CurrentUser, get_container, get_current_user, get_db

router = APIRouter()


@router.post("/run", response_model=AgentRunOut)
async def run(
    payload: AgentRunRequest,
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> AgentRunOut:
    """Ask the agent to do something, and report what it actually did.

    With no Groq key the agent answers in a degraded mode that says so, rather than
    failing the request or pretending it reasoned.
    """
    from ....services.agent_service import run_agent, to_agent_run_out

    services = container.agent_services(db, current_user)
    outcome = await run_agent(services, payload.command, job_id=payload.job_id)
    await container.concordium.audit.record(
        db,
        action="run_agent",
        subject_type="user",
        subject_id=str(current_user.id),
        outcome="success",
        actor_id=current_user.id,
        detail={"tools": outcome.used_tools, "degraded": outcome.degraded},
    )
    return to_agent_run_out(outcome)


@router.get("/tools")
async def tools(container: Container = Depends(get_container)) -> dict[str, object]:
    """The tool names this build exposes, with whether the model is configured."""
    from ....services.agent_tools import tool_names

    return {
        "tools": tool_names(),
        "llm_configured": container.groq.is_available,
        "model": container.groq.model if container.groq.is_available else None,
    }


@router.get("/log", response_model=list[AgentStepOut])
async def log(
    limit: int = Query(default=50, ge=1, le=200),
    offset: int = Query(default=0, ge=0),
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> list[AgentStepOut]:
    """What the agent did on this account, most recent first."""
    from ....services.agent_service import list_activity

    return await list_activity(db, current_user, limit=limit, offset=offset)


@router.get("/card")
async def card(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    """The agent card this build would register, and whether it can be verified.

    The card is real: it lists the tools the agent actually has, the limits it runs
    under, and the badge extension block a verifier looks for. The registration is not,
    and the response says so rather than showing an invented agent id.
    """
    from ....services.agent_service import agent_capabilities
    from ....services.concordium.registry_service import build_agent_card

    card_payload = build_agent_card(
        name=f"{current_user.display_name} agent",
        description="Books local services, messages providers and reports on jobs.",
        account_address=current_user.agent_account_address,
        owner_account=current_user.concordium_account_address,
        tool_names=agent_capabilities(),
        card_url=current_user.agent_card_url or "",
    ).to_payload()

    verification = await container.concordium.registry.verify_registered_agent(
        agent_id=current_user.cis8004_agent_id or "",
        live_card=card_payload,
        live_card_url=current_user.agent_card_url,
    )
    return {
        "card": card_payload,
        "registered": current_user.cis8004_agent_id is not None,
        "agent_id": current_user.cis8004_agent_id,
        "agent_verified": current_user.agent_verified,
        "agent_account_address": current_user.agent_account_address,
        "registry_configured": container.concordium.registry.is_configured,
        "registry_address": container.concordium.registry.expected_registry,
        "verification": {
            "valid": verification.valid,
            "checks": [
                {"name": check.name, "passed": check.passed, "detail": check.detail}
                for check in verification.checks
            ],
            "failed": verification.failed,
        },
        "spending_limits": container.spending.describe_limits(),
        "is_demo": current_user.is_demo,
    }


@router.post("/register")
async def register_agent(
    db: AsyncSession = Depends(get_db),
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    """Register the agent on chain.

    Not configured: raises ``NotConfiguredError``, which the transport renders as a 503
    with a sentence that says nothing was registered. A registration is refused without
    the agent's own account, because an agent that borrows the human's identity is
    exactly what the delegated-identity design exists to avoid.
    """
    from ....services.agent_service import agent_capabilities
    from ....services.concordium.registry_service import build_agent_card

    if not current_user.agent_account_address:
        raise NotConfiguredError(
            "the agent identity (no agent account address)", operation="register_agent"
        )
    card = build_agent_card(
        name=f"{current_user.display_name} agent",
        description="Books local services, messages providers and reports on jobs.",
        account_address=current_user.agent_account_address,
        owner_account=current_user.concordium_account_address,
        tool_names=agent_capabilities(),
        card_url=current_user.agent_card_url or "",
    )
    registration = await container.concordium.registry.register_agent(
        account_address=current_user.agent_account_address, card=card
    )
    await container.concordium.audit.record(
        db,
        action="register_agent",
        subject_type="user",
        subject_id=str(current_user.id),
        outcome="success",
        actor_id=current_user.id,
        detail={"configured": True},
    )
    return {"agent_id": registration.agent_id, "agent_card_url": registration.agent_card_url}


@router.get("/identity")
async def agent_identity(
    container: Container = Depends(get_container),
    current_user: CurrentUser = Depends(get_current_user),
) -> dict[str, object]:
    """The agent's own scoped identity, kept separate from the human's.

    Concordium's Agent IDP issues that credential after the human reveals one attribute
    with a zero-knowledge proof. Agent IDP is DevNet only, so the boundary is left here
    and nothing is called.
    """
    return {
        "agent_account_address": current_user.agent_account_address,
        "agent_verified": current_user.agent_verified,
        "agent_verification_ref": current_user.agent_verification_ref,
        "human_verified": current_user.concordium_verified,
        "human_account_address": current_user.concordium_account_address,
        "idp_configured": bool(container.settings.FEATURE_AGENT_IDP and container.settings.CONCORDIUM_AGENT_IDP_URL),
        "separate_account": bool(
            current_user.agent_account_address
            and current_user.agent_account_address != current_user.concordium_account_address
        ),
        "is_demo": current_user.is_demo,
        "note": (
            "The agent holds its own scoped identity and its own low-balance account. It "
            "never spends from the human's account."
            if current_user.agent_account_address
            else "No agent account has been issued on this deployment."
        ),
    }
