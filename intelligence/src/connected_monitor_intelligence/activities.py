from __future__ import annotations

from temporalio import activity

from .contracts import RunState
from .pipeline import IntelligencePipeline


def _pipeline() -> IntelligencePipeline:
    return IntelligencePipeline()


@activity.defn(name="set_run_state")
async def set_run_state(input_data: dict) -> None:
    _pipeline().store.set_run_state(input_data["run_id"], RunState(input_data["state"]))


@activity.defn(name="plan_research")
async def plan_research(input_data: dict) -> list[str]:
    return await _pipeline().plan(input_data["run_id"], input_data.get("replan_reason"))


@activity.defn(name="discover_resource")
async def discover_resource(input_data: dict) -> list[str]:
    return await _pipeline().discover(input_data["run_id"], input_data["query_token"], input_data["kind"])


@activity.defn(name="select_resources")
async def select_resources(input_data: dict) -> list[str]:
    return _pipeline().select_resources(input_data["run_id"])


@activity.defn(name="acquire_resource")
async def acquire_resource(input_data: dict) -> str | None:
    return await _pipeline().acquire(input_data["run_id"], input_data["discovery_result_id"])


@activity.defn(name="extract_evidence")
async def extract_evidence(input_data: dict) -> list[str]:
    return await _pipeline().extract_and_resolve(input_data["run_id"], input_data["evidence_id"])


@activity.defn(name="verify_and_rank_claim")
async def verify_and_rank_claim(input_data: dict) -> str | None:
    return await _pipeline().verify_and_rank(
        input_data["run_id"], input_data["claim_id"], input_data["sort_order"]
    )


@activity.defn(name="synthesize_brief")
async def synthesize_brief(input_data: dict) -> str:
    return await _pipeline().synthesize(input_data["run_id"])


@activity.defn(name="consolidate_memory")
async def consolidate_memory(input_data: dict) -> str | None:
    return await _pipeline().consolidate_memory(input_data["run_id"])


@activity.defn(name="create_replay_manifest")
async def create_replay_manifest(input_data: dict) -> str:
    return _pipeline().replay(input_data["run_id"])


@activity.defn(name="fail_research_run")
async def fail_research_run(input_data: dict) -> None:
    _pipeline().store.set_run_state(input_data["run_id"], RunState.FAILED, input_data["message"])
