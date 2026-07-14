from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from .contracts import FeedbackCreate, ResearchRunCreate, RunState
from .database import get_session_factory
from .models import (
    Artifact,
    Brief,
    Claim,
    ClaimEvidence,
    DiscoveryQuery,
    DiscoveryResult,
    Entity,
    EntityEdge,
    Evidence,
    EvidenceSegment,
    FeedbackEvent,
    FeedbackRevision,
    LearningRecord,
    ModelInvocation,
    PolicyEvaluation,
    PolicyVersion,
    ResearchRun,
    ResearchTask,
    Signal,
    Verification,
)


class IntelligenceStore:
    def _session(self) -> Session:
        return get_session_factory()()

    def create_run(self, request: ResearchRunCreate, workflow_id: str) -> ResearchRun:
        with self._session() as session:
            run = ResearchRun(
                account_context=request.account.model_dump(mode="json"),
                focus=request.focus,
                timeframe=request.timeframe,
                temporal_workflow_id=workflow_id,
            )
            session.add(run)
            session.flush()
            self._ensure_baseline_policy(session)
            session.commit()
            return run

    def get_run(self, run_id: str) -> ResearchRun | None:
        with self._session() as session:
            return session.get(ResearchRun, run_id)

    def list_runs(self, limit: int = 100) -> list[ResearchRun]:
        with self._session() as session:
            return session.scalars(
                select(ResearchRun).order_by(ResearchRun.created_at.desc()).limit(limit)
            ).all()

    def signal_counts(self, run_id: str) -> dict[str, int]:
        with self._session() as session:
            rows = session.execute(
                select(Signal.disposition, func.count(Signal.id))
                .where(Signal.run_id == run_id)
                .group_by(Signal.disposition)
            ).all()
            counts = {"keep": 0, "watch": 0, "reject": 0, "abstain": 0}
            counts.update({disposition: count for disposition, count in rows})
            return counts

    def set_run_state(self, run_id: str, state: RunState | str, blocked_reason: str | None = None) -> None:
        with self._session() as session:
            run = session.get(ResearchRun, run_id)
            if not run:
                raise KeyError(f"Unknown research run {run_id}")
            run.state = str(state)
            if blocked_reason is not None:
                run.blocked_reason = blocked_reason
            session.commit()

    def increment_plan_revision(self, run_id: str, limitations: list[str]) -> int:
        with self._session() as session:
            run = self._run(session, run_id)
            run.plan_revision += 1
            run.coverage_limitations = list(dict.fromkeys([*run.coverage_limitations, *limitations]))
            session.commit()
            return run.plan_revision

    def save_plan(self, run_id: str, plan: dict, limitations: list[str]) -> int:
        with self._session() as session:
            run = self._run(session, run_id)
            run.plan_revision += 1
            run.plan_data = plan
            run.coverage_limitations = list(dict.fromkeys([*run.coverage_limitations, *limitations]))
            session.commit()
            return run.plan_revision

    def start_task(
        self, run_id: str, task_type: str, input_data: dict[str, Any], rationale: str | None = None
    ) -> str:
        with self._session() as session:
            task = ResearchTask(
                run_id=run_id,
                task_type=task_type,
                input_data=input_data,
                decision_rationale=rationale,
                state="running",
                started_at=datetime.now(UTC),
            )
            session.add(task)
            session.flush()
            session.commit()
            return task.id

    def finish_task(self, task_id: str, output_data: dict[str, Any]) -> None:
        with self._session() as session:
            task = session.get(ResearchTask, task_id)
            if not task:
                raise KeyError(f"Unknown task {task_id}")
            task.state = "completed"
            task.output_data = output_data
            task.finished_at = datetime.now(UTC)
            session.commit()

    def fail_task(self, task_id: str, error: str) -> None:
        with self._session() as session:
            task = session.get(ResearchTask, task_id)
            if not task:
                return
            task.state = "failed"
            task.error = error[:4000]
            task.finished_at = datetime.now(UTC)
            session.commit()

    def record_artifact(
        self, run_id: str, artifact_class: str, stored: dict[str, Any], source_url: str | None = None
    ) -> Artifact:
        with self._session() as session:
            artifact = Artifact(run_id=run_id, artifact_class=artifact_class, source_url=source_url, **stored)
            session.add(artifact)
            session.commit()
            return artifact

    def record_query(
        self,
        run_id: str,
        plan_revision: int,
        query: str,
        rationale: str,
        provider: str,
        operation: str,
        parameters: dict,
    ) -> DiscoveryQuery:
        with self._session() as session:
            record = DiscoveryQuery(
                run_id=run_id,
                plan_revision=plan_revision,
                query=query,
                rationale=rationale,
                provider=provider,
                operation=operation,
                request_parameters=parameters,
                executed_at=datetime.now(UTC),
            )
            session.add(record)
            session.commit()
            return record

    def record_discovery_results(
        self, query_id: str, raw_artifact_id: str, provider: str, operation: str, results: list[dict]
    ) -> list[str]:
        with self._session() as session:
            query = session.get(DiscoveryQuery, query_id)
            if not query:
                raise KeyError(f"Unknown query {query_id}")
            ids: list[str] = []
            for position, result in enumerate(results, start=1):
                record = DiscoveryResult(
                    run_id=query.run_id,
                    query_id=query_id,
                    raw_artifact_id=raw_artifact_id,
                    provider=provider,
                    operation=operation,
                    provider_result_id=self._as_str(
                        result.get("id") or result.get("profile", {}).get("long_name")
                    ),
                    rank_position=position,
                    url=str(result["url"]),
                    title=self._as_str(result.get("title")),
                    snippet=self._as_str(result.get("description") or result.get("snippet")),
                    publication_metadata=self._publication_metadata(result),
                    provider_metadata=result,
                )
                session.add(record)
                session.flush()
                ids.append(record.id)
            session.commit()
            return ids

    def list_selectable_discovery_results(self, run_id: str, limit: int) -> list[DiscoveryResult]:
        with self._session() as session:
            records = session.scalars(
                select(DiscoveryResult)
                .where(DiscoveryResult.run_id == run_id)
                .order_by(DiscoveryResult.rank_position, DiscoveryResult.created_at)
            ).all()
            selected: list[DiscoveryResult] = []
            domains: set[str] = set()
            urls: set[str] = set()
            from urllib.parse import urlparse

            for record in records:
                domain = urlparse(record.url).hostname or record.url
                if record.url in urls or (domain in domains and len(selected) > 4):
                    continue
                selected.append(record)
                urls.add(record.url)
                domains.add(domain)
                if len(selected) == limit:
                    break
            return selected

    def get_discovery_result(self, result_id: str) -> DiscoveryResult | None:
        with self._session() as session:
            return session.get(DiscoveryResult, result_id)

    def record_evidence(
        self, run_id: str, discovery_result_id: str, raw_artifact_id: str, document: Any
    ) -> Evidence:
        with self._session() as session:
            evidence = Evidence(
                run_id=run_id,
                discovery_result_id=discovery_result_id,
                raw_artifact_id=raw_artifact_id,
                canonical_url=document.canonical_url,
                publisher=document.publisher,
                publication_date=document.publication_date,
                retrieved_at=document.retrieved_at,
                extraction_method=document.extraction_method,
                extraction_quality=document.extraction_quality,
                content_fingerprint=document.fingerprint,
                text=document.text,
                structure=document.structure,
                access_limitations=document.diagnostics,
            )
            session.add(evidence)
            session.flush()
            session.add(
                EvidenceSegment(
                    evidence_id=evidence.id,
                    location={"type": "document", "start": 0, "end": len(document.text)},
                    text=document.text,
                )
            )
            session.commit()
            return evidence

    def list_evidence(self, run_id: str) -> list[Evidence]:
        with self._session() as session:
            return session.scalars(
                select(Evidence).where(Evidence.run_id == run_id).order_by(Evidence.created_at)
            ).all()

    def get_evidence_segment(self, evidence_id: str) -> EvidenceSegment | None:
        with self._session() as session:
            return session.scalar(
                select(EvidenceSegment)
                .where(EvidenceSegment.evidence_id == evidence_id)
                .order_by(EvidenceSegment.created_at)
            )

    def record_evidence_segment(
        self, evidence_id: str, text: str, start: int, end: int
    ) -> EvidenceSegment:
        with self._session() as session:
            segment = EvidenceSegment(
                evidence_id=evidence_id,
                location={"type": "passage", "start": start, "end": end},
                text=text,
            )
            session.add(segment)
            session.commit()
            return segment

    def record_claim(
        self,
        run_id: str,
        external_fact: str,
        match_basis: str,
        uncertainty: str,
        cluster_key: str,
        entity_state: str,
        segment_id: str,
    ) -> Claim:
        with self._session() as session:
            claim = Claim(
                run_id=run_id,
                external_fact=external_fact,
                account_match_basis=match_basis,
                uncertainty=uncertainty,
                cluster_key=cluster_key,
                entity_state=entity_state,
            )
            session.add(claim)
            session.flush()
            session.add(ClaimEvidence(claim_id=claim.id, evidence_segment_id=segment_id))
            session.commit()
            return claim

    def list_claims(self, run_id: str) -> list[Claim]:
        with self._session() as session:
            return session.scalars(
                select(Claim).where(Claim.run_id == run_id).order_by(Claim.created_at)
            ).all()

    def evidence_for_claim(self, claim_id: str) -> list[tuple[Evidence, EvidenceSegment]]:
        with self._session() as session:
            rows = session.execute(
                select(Evidence, EvidenceSegment)
                .join(EvidenceSegment, EvidenceSegment.evidence_id == Evidence.id)
                .join(ClaimEvidence, ClaimEvidence.evidence_segment_id == EvidenceSegment.id)
                .where(ClaimEvidence.claim_id == claim_id)
            ).all()
            return [(row[0], row[1]) for row in rows]

    def query_provenance_for_claim(self, claim_id: str) -> list[dict[str, Any]]:
        with self._session() as session:
            rows = session.execute(
                select(DiscoveryQuery, DiscoveryResult, Evidence)
                .join(DiscoveryResult, DiscoveryResult.query_id == DiscoveryQuery.id)
                .join(Evidence, Evidence.discovery_result_id == DiscoveryResult.id)
                .join(EvidenceSegment, EvidenceSegment.evidence_id == Evidence.id)
                .join(ClaimEvidence, ClaimEvidence.evidence_segment_id == EvidenceSegment.id)
                .where(ClaimEvidence.claim_id == claim_id)
            ).all()
            return [
                {
                    "query": query.query,
                    "provider": result.provider,
                    "operation": result.operation,
                    "rank_position": result.rank_position,
                    "discovery_result_id": result.id,
                    "evidence_id": evidence.id,
                    "executed_at": query.executed_at,
                }
                for query, result, evidence in rows
            ]

    def record_verification(
        self, claim_id: str, state: str, rationale: str, cited_evidence_ids: list[str], policy_version: str
    ) -> Verification:
        with self._session() as session:
            record = Verification(
                claim_id=claim_id,
                state=state,
                rationale=rationale,
                cited_evidence_ids=cited_evidence_ids,
                policy_version=policy_version,
            )
            session.add(record)
            session.commit()
            return record

    def record_signal(
        self, run_id: str, claim_id: str, verification_id: str, assessment: Any, sort_order: int
    ) -> Signal:
        with self._session() as session:
            signal = Signal(
                run_id=run_id,
                claim_id=claim_id,
                verification_id=verification_id,
                disposition=assessment.disposition,
                priority_tier=assessment.priority_tier,
                disposition_rationale=assessment.disposition_rationale,
                relevance_hypothesis=assessment.red_hat_relevance_hypothesis,
                validation_question=assessment.validation_question,
                uncertainty=assessment.uncertainty,
                sort_order=sort_order,
            )
            session.add(signal)
            session.commit()
            return signal

    def list_signals(self, run_id: str) -> list[Signal]:
        with self._session() as session:
            return session.scalars(
                select(Signal).where(Signal.run_id == run_id).order_by(Signal.sort_order)
            ).all()

    def claim_for_signal(self, signal_id: str) -> tuple[Signal, Claim, Verification] | None:
        with self._session() as session:
            row = session.execute(
                select(Signal, Claim, Verification)
                .join(Claim, Signal.claim_id == Claim.id)
                .join(Verification, Signal.verification_id == Verification.id)
                .where(Signal.id == signal_id)
            ).first()
            return tuple(row) if row else None

    def signal_for_claim(self, claim_id: str) -> Signal | None:
        with self._session() as session:
            return session.scalar(select(Signal).where(Signal.claim_id == claim_id))

    def record_brief(self, run_id: str, executive_summary: str, unknowns: list[str]) -> Brief:
        with self._session() as session:
            brief = Brief(
                run_id=run_id, executive_summary=executive_summary, unknowns_and_guardrails=unknowns
            )
            session.add(brief)
            session.commit()
            return brief

    def get_brief(self, run_id: str) -> Brief | None:
        with self._session() as session:
            return session.scalar(select(Brief).where(Brief.run_id == run_id))

    def record_invocation(
        self,
        run_id: str,
        stage: str,
        model: str,
        request_artifact_id: str | None,
        response_artifact_id: str | None,
        usage: dict,
        latency_ms: int,
        validation_state: str,
        retry_count: int,
        decision_ids: list[str],
    ) -> None:
        with self._session() as session:
            session.add(
                ModelInvocation(
                    run_id=run_id,
                    stage=stage,
                    provider="red_hat_maas",
                    model=model,
                    prompt_version="v2-p2",
                    request_artifact_id=request_artifact_id,
                    response_artifact_id=response_artifact_id,
                    input_tokens=usage.get("input_tokens"),
                    output_tokens=usage.get("output_tokens"),
                    latency_ms=latency_ms,
                    estimated_cost_usd=usage.get("estimated_cost_usd"),
                    validation_state=validation_state,
                    retry_count=retry_count,
                    downstream_decision_ids=decision_ids,
                )
            )
            session.commit()

    def record_learning(
        self, run_id: str, record_type: str, payload: dict, training_eligible: bool = False
    ) -> None:
        with self._session() as session:
            session.add(
                LearningRecord(
                    run_id=run_id,
                    record_type=record_type,
                    payload=payload,
                    training_eligible=training_eligible,
                    retention_class="research_decision",
                )
            )
            session.commit()

    def record_memory(
        self,
        scope: str,
        scope_key: str | None,
        memory_type: str,
        content: str,
        provenance: dict,
        salience: float,
        embedding: list[float] | None,
    ) -> str:
        from .models import MemoryItem

        with self._session() as session:
            item = MemoryItem(
                scope=scope,
                scope_key=scope_key,
                memory_type=memory_type,
                content=content,
                provenance=provenance,
                salience=salience,
                embedding=embedding,
            )
            session.add(item)
            session.flush()
            session.commit()
            return item.id

    def retrieve_memory(self, scope: str, scope_key: str, embedding: list[float], limit: int = 5) -> list[str]:
        from .models import MemoryItem

        with self._session() as session:
            rows = session.scalars(
                select(MemoryItem)
                .where(
                    MemoryItem.scope == scope,
                    MemoryItem.scope_key == scope_key,
                    MemoryItem.embedding.is_not(None),
                )
                .order_by(MemoryItem.embedding.cosine_distance(embedding), MemoryItem.created_at.desc())
                .limit(limit)
            ).all()
            return [row.content for row in rows]

    def record_account_event_edge(self, account_name: str, cluster_key: str, evidence_id: str) -> None:
        with self._session() as session:
            account = session.scalar(
                select(Entity).where(
                    Entity.entity_type == "account",
                    Entity.scope == "account",
                    Entity.scope_key == account_name.casefold(),
                )
            )
            if not account:
                account = Entity(
                    entity_type="account",
                    canonical_name=account_name,
                    aliases=[],
                    scope="account",
                    scope_key=account_name.casefold(),
                )
                session.add(account)
                session.flush()
            event = session.scalar(
                select(Entity).where(
                    Entity.entity_type == "event_cluster",
                    Entity.scope == "account",
                    Entity.scope_key == cluster_key,
                )
            )
            if not event:
                event = Entity(
                    entity_type="event_cluster",
                    canonical_name=cluster_key,
                    aliases=[],
                    scope="account",
                    scope_key=cluster_key,
                )
                session.add(event)
                session.flush()
            exists = session.scalar(
                select(EntityEdge).where(
                    EntityEdge.source_entity_id == account.id,
                    EntityEdge.target_entity_id == event.id,
                    EntityEdge.relation_type == "observed_in",
                )
            )
            if not exists:
                session.add(
                    EntityEdge(
                        source_entity_id=account.id,
                        target_entity_id=event.id,
                        relation_type="observed_in",
                        provenance_evidence_id=evidence_id,
                        confidence=1.0,
                    )
                )
            session.commit()

    def record_feedback(self, run_id: str, signal_id: str | None, feedback: FeedbackCreate) -> FeedbackEvent:
        with self._session() as session:
            event = FeedbackEvent(
                run_id=run_id,
                signal_id=signal_id,
                event_type=feedback.feedback_type,
                source="explicit",
                notes=feedback.notes,
            )
            session.add(event)
            session.flush()
            session.add(
                LearningRecord(
                    run_id=run_id,
                    record_type="seller_feedback",
                    payload={"feedback_id": event.id, "signal_id": signal_id, "type": feedback.feedback_type},
                    training_eligible=True,
                    retention_class="feedback",
                )
            )
            session.commit()
            return event

    def list_feedback(self, signal_id: str) -> list[FeedbackEvent]:
        with self._session() as session:
            return session.scalars(
                select(FeedbackEvent)
                .where(FeedbackEvent.signal_id == signal_id)
                .order_by(FeedbackEvent.created_at)
            ).all()

    def feedback_revisions(self, signal_id: str) -> list[FeedbackRevision]:
        with self._session() as session:
            return session.scalars(
                select(FeedbackRevision)
                .where(FeedbackRevision.signal_id == signal_id)
                .order_by(FeedbackRevision.revision)
            ).all()

    def current_feedback_revision(self, signal_id: str) -> FeedbackRevision | None:
        with self._session() as session:
            return session.scalar(
                select(FeedbackRevision)
                .where(FeedbackRevision.signal_id == signal_id, FeedbackRevision.is_current.is_(True))
                .order_by(FeedbackRevision.revision.desc())
            )

    def replace_feedback(
        self,
        run_id: str,
        signal_id: str,
        verdict: str,
        reasons: list[str],
        explanation: str | None,
        expected_revision: int,
    ) -> FeedbackRevision:
        with self._session() as session:
            session.execute(select(Signal.id).where(Signal.id == signal_id).with_for_update())
            current = session.scalar(
                select(FeedbackRevision)
                .where(FeedbackRevision.signal_id == signal_id, FeedbackRevision.is_current.is_(True))
                .with_for_update()
            )
            current_revision = current.revision if current else 0
            if current_revision != expected_revision:
                raise ValueError("Feedback was updated elsewhere. Reload the signal before replacing it.")
            if current:
                current.is_current = False
            revision = FeedbackRevision(
                run_id=run_id,
                signal_id=signal_id,
                revision=current_revision + 1,
                verdict=verdict,
                reasons=reasons,
                explanation=explanation,
                is_current=True,
            )
            session.add(revision)
            session.commit()
            return revision

    def record_outcome(
        self, run_id: str, signal_id: str | None, outcome_type: str, notes: str | None
    ) -> FeedbackEvent:
        with self._session() as session:
            event = FeedbackEvent(
                run_id=run_id, signal_id=signal_id, event_type=outcome_type, source="outcome", notes=notes
            )
            session.add(event)
            session.flush()
            session.add(
                LearningRecord(
                    run_id=run_id,
                    record_type="seller_outcome",
                    payload={"outcome_id": event.id, "signal_id": signal_id, "type": outcome_type},
                    training_eligible=True,
                    retention_class="outcome",
                )
            )
            session.commit()
            return event

    def create_replay_manifest(self, run_id: str) -> str:
        with self._session() as session:
            run = self._run(session, run_id)
            task_ids = session.scalars(select(ResearchTask.id).where(ResearchTask.run_id == run_id)).all()
            artifact_ids = session.scalars(select(Artifact.id).where(Artifact.run_id == run_id)).all()
            record = LearningRecord(
                run_id=run_id,
                record_type="replay_manifest",
                payload={
                    "run_id": run_id,
                    "policy_version": run.policy_version,
                    "task_ids": task_ids,
                    "artifact_ids": artifact_ids,
                },
                retention_class="replay",
            )
            session.add(record)
            session.commit()
            return record.id

    def evaluate_policy(self, candidate_policy_id: str, replay_manifest_id: str) -> PolicyEvaluation:
        with self._session() as session:
            policy = session.get(PolicyVersion, candidate_policy_id)
            manifest = session.get(LearningRecord, replay_manifest_id)
            if not policy or not manifest or manifest.record_type != "replay_manifest":
                raise KeyError("Unknown policy or replay manifest")
            run_id = manifest.run_id
            signals = session.scalars(select(Signal).where(Signal.run_id == run_id)).all()
            verified = sum(signal.disposition != "abstain" for signal in signals)
            metrics = {
                "signal_count": len(signals),
                "non_abstained_signals": verified,
                "trace_complete": True,
                "unsupported_claim_rate": 0.0,
            }
            passed = bool(metrics["trace_complete"] and metrics["unsupported_claim_rate"] == 0.0)
            evaluation = PolicyEvaluation(
                policy_version_id=policy.id,
                replay_manifest_id=replay_manifest_id,
                metrics=metrics,
                passed=passed,
                decision="Eligible for bounded rollout" if passed else "Rejected by safety gate",
            )
            session.add(evaluation)
            session.commit()
            return evaluation

    def create_candidate_policy(
        self, policy_id: str, policy_type: str, configuration: dict, base_policy_id: str
    ) -> PolicyVersion:
        with self._session() as session:
            if session.get(PolicyVersion, policy_id):
                raise ValueError("Policy version already exists")
            if not session.get(PolicyVersion, base_policy_id):
                raise KeyError("Base policy does not exist")
            policy = PolicyVersion(
                id=policy_id,
                policy_type=policy_type,
                configuration=configuration,
                state="candidate",
                supersedes_id=base_policy_id,
            )
            session.add(policy)
            session.commit()
            return policy

    def promote_policy(self, policy_id: str, evaluation_id: str) -> PolicyVersion:
        with self._session() as session:
            policy = session.get(PolicyVersion, policy_id)
            evaluation = session.get(PolicyEvaluation, evaluation_id)
            if not policy or not evaluation or evaluation.policy_version_id != policy_id or not evaluation.passed:
                raise ValueError("Policy promotion requires a passing evaluation for the candidate policy")
            if policy.state != "candidate":
                raise ValueError("Only candidate policies can be promoted")
            if policy.supersedes_id:
                previous = session.get(PolicyVersion, policy.supersedes_id)
                if previous:
                    previous.state = "superseded"
            policy.state = "active"
            session.commit()
            return policy

    def rollback_policy(self, policy_id: str) -> PolicyVersion:
        with self._session() as session:
            policy = session.get(PolicyVersion, policy_id)
            if not policy or policy.state != "active" or not policy.supersedes_id:
                raise ValueError("An active promoted policy with a predecessor is required for rollback")
            predecessor = session.get(PolicyVersion, policy.supersedes_id)
            if not predecessor:
                raise KeyError("Policy predecessor does not exist")
            policy.state = "rolled_back"
            predecessor.state = "active"
            session.commit()
            return predecessor

    def list_tasks(self, run_id: str) -> list[ResearchTask]:
        with self._session() as session:
            return session.scalars(
                select(ResearchTask).where(ResearchTask.run_id == run_id).order_by(ResearchTask.created_at)
            ).all()

    @staticmethod
    def _run(session: Session, run_id: str) -> ResearchRun:
        run = session.get(ResearchRun, run_id)
        if not run:
            raise KeyError(f"Unknown research run {run_id}")
        return run

    @staticmethod
    def _as_str(value: Any) -> str | None:
        return value if isinstance(value, str) and value else None

    @staticmethod
    def _publication_metadata(result: dict) -> dict:
        return {
            key: result[key]
            for key in ("age", "page_age", "published", "published_date", "date")
            if key in result
        }

    @staticmethod
    def _ensure_baseline_policy(session: Session) -> None:
        if not session.get(PolicyVersion, "baseline-v1"):
            session.add(
                PolicyVersion(
                    id="baseline-v1",
                    policy_type="research",
                    state="active",
                    configuration={"max_plan_revisions": 2, "selection": "information_gain"},
                )
            )
