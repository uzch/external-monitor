from __future__ import annotations

import asyncio

from temporalio.client import Client
from temporalio.worker import Worker

from . import activities
from .config import settings
from .workflows import ResearchWorkflow


async def run_worker() -> None:
    client = await Client.connect(settings.temporal_address, namespace=settings.temporal_namespace)
    worker = Worker(
        client,
        task_queue=settings.temporal_task_queue,
        workflows=[ResearchWorkflow],
        activities=[
            activities.set_run_state,
            activities.plan_research,
            activities.discover_resource,
            activities.select_resources,
            activities.acquire_resource,
            activities.extract_evidence,
            activities.verify_and_rank_claim,
            activities.synthesize_brief,
            activities.consolidate_memory,
            activities.create_replay_manifest,
            activities.fail_research_run,
        ],
    )
    await worker.run()


if __name__ == "__main__":
    asyncio.run(run_worker())
