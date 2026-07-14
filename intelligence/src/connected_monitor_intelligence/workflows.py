from __future__ import annotations

import asyncio
from datetime import timedelta

from temporalio import workflow
from temporalio.common import RetryPolicy

with workflow.unsafe.imports_passed_through():
    from .config import settings


ACTIVITY_TIMEOUT = timedelta(minutes=4)
NO_AUTOMATIC_RETRY = RetryPolicy(maximum_attempts=1)


@workflow.defn
class ResearchWorkflow:
    @workflow.run
    async def run(self, run_id: str) -> dict:
        try:
            await workflow.execute_activity(
                "set_run_state",
                {"run_id": run_id, "state": "planning"},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
                retry_policy=NO_AUTOMATIC_RETRY,
            )
            query_tokens = await workflow.execute_activity(
                "plan_research",
                {"run_id": run_id},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
                retry_policy=NO_AUTOMATIC_RETRY,
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
                    retry_policy=NO_AUTOMATIC_RETRY,
                )
                signal_ids = await self._research_iteration(run_id, query_tokens)
            await workflow.execute_activity(
                "set_run_state",
                {"run_id": run_id, "state": "synthesizing"},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
                retry_policy=NO_AUTOMATIC_RETRY,
            )
            brief_id = await workflow.execute_activity(
                "synthesize_brief",
                {"run_id": run_id},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
                retry_policy=NO_AUTOMATIC_RETRY,
            )
            memory_id = await workflow.execute_activity(
                "consolidate_memory",
                {"run_id": run_id},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
                retry_policy=NO_AUTOMATIC_RETRY,
            )
            replay_manifest_id = await workflow.execute_activity(
                "create_replay_manifest",
                {"run_id": run_id},
                start_to_close_timeout=ACTIVITY_TIMEOUT,
                retry_policy=NO_AUTOMATIC_RETRY,
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
                retry_policy=NO_AUTOMATIC_RETRY,
            )
            raise

    async def _research_iteration(self, run_id: str, query_tokens: list[str]) -> list[str]:
        await workflow.execute_activity(
            "set_run_state",
            {"run_id": run_id, "state": "discovering"},
            start_to_close_timeout=ACTIVITY_TIMEOUT,
            retry_policy=NO_AUTOMATIC_RETRY,
        )
        discovery_batches = await asyncio.gather(
            *[
                workflow.execute_activity(
                    "discover_resource",
                    {"run_id": run_id, "query_token": query, "kind": kind},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                    retry_policy=NO_AUTOMATIC_RETRY,
                )
                for query in query_tokens
                for kind in ("web", "news")
            ]
        )
        if not any(discovery_batches):
            return []
        await workflow.execute_activity(
            "set_run_state",
            {"run_id": run_id, "state": "acquiring"},
            start_to_close_timeout=ACTIVITY_TIMEOUT,
            retry_policy=NO_AUTOMATIC_RETRY,
        )
        resources = await workflow.execute_activity(
            "select_resources",
            {"run_id": run_id},
            start_to_close_timeout=ACTIVITY_TIMEOUT,
            retry_policy=NO_AUTOMATIC_RETRY,
        )
        evidence_ids = []
        for resource_id in resources:
            evidence_ids.append(
                await workflow.execute_activity(
                    "acquire_resource",
                    {"run_id": run_id, "discovery_result_id": resource_id},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                    retry_policy=NO_AUTOMATIC_RETRY,
                )
            )
        acquired = [item for item in evidence_ids if item]
        if not acquired:
            return []
        await workflow.execute_activity(
            "set_run_state",
            {"run_id": run_id, "state": "analyzing"},
            start_to_close_timeout=ACTIVITY_TIMEOUT,
            retry_policy=NO_AUTOMATIC_RETRY,
        )
        claims: list[str] = []
        for evidence_id in acquired:
            claims.extend(
                await workflow.execute_activity(
                    "extract_evidence",
                    {"run_id": run_id, "evidence_id": evidence_id},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                    retry_policy=NO_AUTOMATIC_RETRY,
                )
            )
            if len(claims) >= settings.max_candidate_claims:
                break
        claims = claims[: settings.max_candidate_claims]
        signal_ids = []
        for index, claim_id in enumerate(claims):
            signal_ids.append(
                await workflow.execute_activity(
                    "verify_and_rank_claim",
                    {"run_id": run_id, "claim_id": claim_id, "sort_order": index},
                    start_to_close_timeout=ACTIVITY_TIMEOUT,
                    retry_policy=NO_AUTOMATIC_RETRY,
                )
            )
        return [signal_id for signal_id in signal_ids if signal_id]
