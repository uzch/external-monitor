from __future__ import annotations

import asyncio
from contextlib import asynccontextmanager
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from temporalio.client import Client

from .artifacts import ArtifactStore
from .config import settings
from .contracts import (
    AccountContext,
    BriefView,
    FeedbackCreate,
    OutcomeCreate,
    PolicyCandidateCreate,
    PolicyEvaluationRequest,
    ResearchRunCreate,
    RunSummary,
    SignalView,
)
from .pipeline import IntelligencePipeline
from .store import IntelligenceStore
from .workflows import ResearchWorkflow


@asynccontextmanager
async def lifespan(_: FastAPI):
    ArtifactStore(settings).ensure_bucket()
    yield


app = FastAPI(title="Connected Monitor Intelligence API", version="2.0.0", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://127.0.0.1:8787",
        "http://localhost:8787",
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    ],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


@app.get("/health")
async def health() -> dict:
    blockers = IntelligencePipeline().validate_readiness()
    return {"status": "ready" if not blockers else "degraded", "blockers": blockers, "runtime": "fastapi"}


@app.get("/v2/capabilities")
async def capabilities() -> dict:
    blockers = IntelligencePipeline().validate_readiness()
    return {
        "reasoning": {"provider": "red_hat_maas", "available": settings.maas_configured},
        "discovery": {
            "selection_policy": ["tavily_api", "tavily_mcp", "brave"],
            "tavily_api": {
                "available": settings.tavily_api_configured,
                "operations": ["search", "extract"] if settings.tavily_api_configured else [],
            },
            "tavily_mcp": {
                "available": settings.tavily_mcp_configured,
                "operations": ["search", "extract", "crawl", "map"]
                if settings.tavily_mcp_configured
                else [],
            },
            "brave": {
                "available": settings.brave_configured,
                "operations": ["web_search", "news_search"] if settings.brave_configured else [],
            },
        },
        "acquisition": {"html": True, "pdf": True, "browser": True},
        "blockers": blockers,
    }


@app.post("/v2/research-runs", response_model=RunSummary, status_code=202)
async def start_research_run(request: ResearchRunCreate) -> RunSummary:
    pipeline = IntelligencePipeline()
    blockers = pipeline.validate_readiness()
    if blockers:
        raise HTTPException(
            status_code=503,
            detail={
                "message": "Autonomous research cannot start until required providers are configured.",
                "blockers": blockers,
            },
        )
    workflow_id = f"research-{uuid4()}"
    run = pipeline.store.create_run(request, workflow_id)
    try:
        client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)
        await client.start_workflow(
            ResearchWorkflow.run, run.id, id=workflow_id, task_queue=settings.temporal_task_queue
        )
    except Exception as error:
        pipeline.store.set_run_state(run.id, "blocked", f"Temporal orchestration is unavailable: {error}")
        raise HTTPException(status_code=503, detail="Temporal orchestration is unavailable") from error
    return _run_summary(run)


@app.get("/v2/research-runs/{run_id}", response_model=RunSummary)
async def get_research_run(run_id: str) -> RunSummary:
    run = _require_run(run_id)
    return _run_summary(run)


@app.get("/v2/research-runs/{run_id}/events")
async def research_events(run_id: str) -> StreamingResponse:
    _require_run(run_id)

    async def event_stream():
        previous: str | None = None
        while True:
            run = _require_run(run_id)
            tasks = IntelligenceStore().list_tasks(run_id)
            payload = {
                "run": _run_summary(run).model_dump(mode="json"),
                "tasks": [
                    {
                        "type": task.task_type,
                        "state": task.state,
                        "error": task.error,
                        "updated_at": task.updated_at.isoformat(),
                    }
                    for task in tasks
                ],
            }
            import json

            encoded = json.dumps(payload, default=str, separators=(",", ":"))
            if encoded != previous:
                yield f"event: research-update\ndata: {encoded}\n\n"
                previous = encoded
            if run.state in {"completed", "partial", "abstained", "blocked", "failed", "cancelled"}:
                return
            await asyncio.sleep(1)

    return StreamingResponse(
        event_stream(), media_type="text/event-stream", headers={"Cache-Control": "no-cache"}
    )


@app.get("/v2/research-runs/{run_id}/brief", response_model=BriefView)
async def get_brief(run_id: str) -> BriefView:
    store = IntelligenceStore()
    run = _require_run(run_id)
    brief = store.get_brief(run_id)
    signals = [_signal_view(store, signal.id) for signal in store.list_signals(run_id)]
    return BriefView(
        run=_run_summary(run),
        executive_summary=brief.executive_summary if brief else None,
        top_signals=[item for item in signals if item.disposition == "keep"],
        watch_items=[item for item in signals if item.disposition == "watch"],
        rejected_items=[item for item in signals if item.disposition == "reject"],
        abstained_items=[item for item in signals if item.disposition == "abstain"],
        unknowns_and_guardrails=brief.unknowns_and_guardrails if brief else run.coverage_limitations,
    )


@app.get("/v2/research-runs/{run_id}/trace")
async def get_trace(run_id: str) -> dict:
    _require_run(run_id)
    store = IntelligenceStore()
    tasks = store.list_tasks(run_id)
    return {
        "run_id": run_id,
        "tasks": [
            {
                "id": task.id,
                "type": task.task_type,
                "state": task.state,
                "input": task.input_data,
                "output": task.output_data,
                "rationale": task.decision_rationale,
                "error": task.error,
                "started_at": task.started_at,
                "finished_at": task.finished_at,
            }
            for task in tasks
        ],
    }


@app.post("/v2/research-runs/{run_id}/signals/{signal_id}/feedback", status_code=201)
async def record_feedback(run_id: str, signal_id: str, feedback: FeedbackCreate) -> dict:
    _require_signal(run_id, signal_id)
    event = IntelligenceStore().record_feedback(run_id, signal_id, feedback)
    return {"id": event.id, "created_at": event.created_at}


@app.post("/v2/research-runs/{run_id}/signals/{signal_id}/outcomes", status_code=201)
async def record_outcome(run_id: str, signal_id: str, outcome: OutcomeCreate) -> dict:
    _require_signal(run_id, signal_id)
    event = IntelligenceStore().record_outcome(run_id, signal_id, outcome.outcome_type, outcome.notes)
    return {"id": event.id, "created_at": event.created_at}


@app.post("/v2/research-runs/{run_id}/cancel", status_code=202)
async def cancel_run(run_id: str) -> Response:
    run = _require_run(run_id)
    if run.temporal_workflow_id:
        client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)
        await client.get_workflow_handle(run.temporal_workflow_id).cancel()
    IntelligenceStore().set_run_state(run_id, "cancelled")
    return Response(status_code=202)


@app.post("/v2/policy-evaluations", status_code=201)
async def evaluate_policy(request: PolicyEvaluationRequest) -> dict:
    evaluation = IntelligenceStore().evaluate_policy(
        request.candidate_policy_version, request.replay_manifest_id
    )
    return {
        "id": evaluation.id,
        "passed": evaluation.passed,
        "metrics": evaluation.metrics,
        "decision": evaluation.decision,
    }


@app.post("/v2/policy-versions", status_code=201)
async def create_candidate_policy(request: PolicyCandidateCreate) -> dict:
    try:
        policy = IntelligenceStore().create_candidate_policy(
            request.id,
            request.policy_type,
            request.configuration,
            request.base_policy_id,
        )
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"id": policy.id, "state": policy.state, "supersedes_id": policy.supersedes_id}


@app.post("/v2/policy-versions/{policy_id}/promote", status_code=200)
async def promote_policy(policy_id: str, evaluation_id: str) -> dict:
    try:
        policy = IntelligenceStore().promote_policy(policy_id, evaluation_id)
    except ValueError as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"id": policy.id, "state": policy.state}


@app.post("/v2/policy-versions/{policy_id}/rollback", status_code=200)
async def rollback_policy(policy_id: str) -> dict:
    try:
        policy = IntelligenceStore().rollback_policy(policy_id)
    except (KeyError, ValueError) as error:
        raise HTTPException(status_code=409, detail=str(error)) from error
    return {"id": policy.id, "state": policy.state}


def _require_run(run_id: str):
    run = IntelligenceStore().get_run(run_id)
    if not run:
        raise HTTPException(status_code=404, detail="Research run not found")
    return run


def _require_signal(run_id: str, signal_id: str) -> None:
    signal = IntelligenceStore().claim_for_signal(signal_id)
    if not signal or signal[0].run_id != run_id:
        raise HTTPException(status_code=404, detail="Research signal not found")


def _run_summary(run) -> RunSummary:
    return RunSummary(
        id=run.id,
        state=run.state,
        account=AccountContext.model_validate(run.account_context),
        focus=run.focus,
        timeframe=run.timeframe,
        created_at=run.created_at,
        updated_at=run.updated_at,
        coverage_limitations=run.coverage_limitations,
        blocked_reason=run.blocked_reason,
    )


def _signal_view(store: IntelligenceStore, signal_id: str) -> SignalView:
    result = store.claim_for_signal(signal_id)
    if not result:
        raise HTTPException(status_code=404, detail="Research signal not found")
    signal, claim, verification = result
    evidence_rows = store.evidence_for_claim(claim.id)
    evidence, segment = evidence_rows[0]
    return SignalView(
        id=signal.id,
        external_fact=claim.external_fact,
        excerpt=_evidence_preview(segment.text, claim.external_fact),
        source_url=evidence.canonical_url,
        publisher=evidence.publisher,
        publication_date=evidence.publication_date,
        retrieved_at=evidence.retrieved_at,
        disposition=signal.disposition,
        priority_tier=signal.priority_tier,
        disposition_rationale=signal.disposition_rationale,
        red_hat_relevance_hypothesis=signal.relevance_hypothesis,
        validation_question=signal.validation_question,
        uncertainty=signal.uncertainty,
        verification_state=verification.state,
        evidence_ids=[item[0].id for item in evidence_rows],
        feedback_types=[event.event_type for event in store.list_feedback(signal.id)],
    )


def _evidence_preview(text: str, external_fact: str, limit: int = 1200) -> str:
    if len(text) <= limit:
        return text
    meaningful_words = sorted(
        {word.strip(".,:;()[]{}\"'") for word in external_fact.split() if len(word) >= 7},
        key=len,
        reverse=True,
    )
    normalized = text.casefold()
    anchor = next(
        (normalized.find(word.casefold()) for word in meaningful_words if word.casefold() in normalized),
        0,
    )
    start = max(0, anchor - 240)
    end = min(len(text), start + limit)
    prefix = "..." if start else ""
    suffix = "..." if end < len(text) else ""
    return f"{prefix}{text[start:end].strip()}{suffix}"
