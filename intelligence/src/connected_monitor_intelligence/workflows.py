from __future__ import annotations

import asyncio
from datetime import timedelta

from temporalio import workflow

with workflow.unsafe.imports_passed_through():
    from .config import settings


ACTIVITY_TIMEOUT = timedelta(minutes=4)


@workflow.defn
class ResearchWorkflow:
    @workflow.run
    async def run(self, run_id: str) -> dict:
        try:
            await workflow.execute_activity(
                "set_run_state",
                {"run_id": run_id, "state": "planning"},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
            )
            query_tokens = await workflow.execute_activity(
                "plan_research", {"run_id": run_id}, start_to_close_timeout=ACTIVITY_TIMEOUT
            )
            signal_ids = await self._research_iteration(run_id, query_tokens)
            if not signal_ids and settings.max_plan_revisions > 1:
                query_tokens = await workflow.execute_activity(
                    "plan_research",
                    {
                        "run_id": run_id,
                        "replan_reason": "No promoted evidence after the first bounded research pass. Seek source diversity or resolve coverage gaps.",
                    },
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                )
                signal_ids = await self._research_iteration(run_id, query_tokens)
            await workflow.execute_activity(
                "set_run_state",
                {"run_id": run_id, "state": "synthesizing"},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
            )
            brief_id = await workflow.execute_activity(
                "synthesize_brief", {"run_id": run_id}, start_to_close_timeout=ACTIVITY_TIMEOUT
            )
            memory_id = await workflow.execute_activity(
                "consolidate_memory", {"run_id": run_id}, start_to_close_timeout=ACTIVITY_TIMEOUT
            )
            replay_manifest_id = await workflow.execute_activity(
                "create_replay_manifest", {"run_id": run_id}, start_to_close_timeout=ACTIVITY_TIMEOUT
            )
            return {
                "brief_id": brief_id,
                "signal_ids": signal_ids,
                "memory_id": memory_id,
                "replay_manifest_id": replay_manifest_id,
            }
        except Exception as error:
            await workflow.execute_activity(
                "fail_research_run",
                {"run_id": run_id, "message": str(error)},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
            )
            raise

    async def _research_iteration(self, run_id: str, query_tokens: list[str]) -> list[str]:
        await workflow.execute_activity(
            "set_run_state",
            {"run_id": run_id, "state": "discovering"},
            start_to_close_timeout=ACTIVITY_TIMEOUT,
        )
        discovery_batches = await asyncio.gather(
            *[
                workflow.execute_activity(
                    "discover_resource",
                    {"run_id": run_id, "query_token": query, "kind": kind},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                )
                for query in query_tokens
                for kind in ("web", "news")
            ]
        )
        if not any(discovery_batches):
            return []
        await workflow.execute_activity(
            "set_run_state", {"run_id": run_id, "state": "acquiring"}, start_to_close_timeout=ACTIVITY_TIMEOUT
        )
        resources = await workflow.execute_activity(
            "select_resources", {"run_id": run_id}, start_to_close_timeout=ACTIVITY_TIMEOUT
        )
        evidence_ids = await asyncio.gather(
            *[
                workflow.execute_activity(
                    "acquire_resource",
                    {"run_id": run_id, "discovery_result_id": resource_id},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                )
                for resource_id in resources
            ]
        )
        acquired = [item for item in evidence_ids if item]
        if not acquired:
            return []
        await workflow.execute_activity(
            "set_run_state", {"run_id": run_id, "state": "analyzing"}, start_to_close_timeout=ACTIVITY_TIMEOUT
        )
        claim_batches = await asyncio.gather(
            *[
                workflow.execute_activity(
                    "extract_evidence",
                    {"run_id": run_id, "evidence_id": evidence_id},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                )
                for evidence_id in acquired
            ]
        )
        claims = [claim for batch in claim_batches for claim in batch]
        signal_ids = await asyncio.gather(
            *[
                workflow.execute_activity(
                    "verify_and_rank_claim",
                    {"run_id": run_id, "claim_id": claim_id, "sort_order": index},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                )
                for index, claim_id in enumerate(claims)
            ]
        )
        return [signal_id for signal_id in signal_ids if signal_id]
