from __future__ import annotations

from datetime import datetime
from uuid import uuid4

from pgvector.sqlalchemy import Vector
from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, UniqueConstraint, func
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column
from sqlalchemy.types import JSON


def json_column():
    return JSON().with_variant(JSONB, "postgresql")


class Base(DeclarativeBase):
    pass


class Timestamped:
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False
    )


class ResearchRun(Timestamped, Base):
    __tablename__ = "intelligence_research_runs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="queued", index=True)
    account_context: Mapped[dict] = mapped_column(json_column(), nullable=False)
    focus: Mapped[str | None] = mapped_column(Text)
    timeframe: Mapped[str] = mapped_column(String(32), nullable=False)
    policy_version: Mapped[str] = mapped_column(String(100), nullable=False, default="baseline-v1")
    plan_revision: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    plan_data: Mapped[dict | None] = mapped_column(json_column())
    coverage_limitations: Mapped[list] = mapped_column(json_column(), nullable=False, default=list)
    blocked_reason: Mapped[str | None] = mapped_column(Text)
    temporal_workflow_id: Mapped[str | None] = mapped_column(String(128), unique=True)


class ResearchTask(Timestamped, Base):
    __tablename__ = "intelligence_research_tasks"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    parent_task_id: Mapped[str | None] = mapped_column(
        ForeignKey("intelligence_research_tasks.id", ondelete="SET NULL")
    )
    task_type: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="queued")
    input_data: Mapped[dict] = mapped_column(json_column(), nullable=False, default=dict)
    output_data: Mapped[dict | None] = mapped_column(json_column())
    decision_rationale: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class Artifact(Timestamped, Base):
    __tablename__ = "intelligence_artifacts"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    artifact_class: Mapped[str] = mapped_column(String(64), nullable=False)
    content_type: Mapped[str] = mapped_column(String(200), nullable=False)
    object_key: Mapped[str] = mapped_column(String(500), nullable=False, unique=True)
    sha256: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    byte_count: Mapped[int] = mapped_column(Integer, nullable=False)
    source_url: Mapped[str | None] = mapped_column(Text)
    retention_class: Mapped[str] = mapped_column(String(64), nullable=False, default="research_evidence")


class DiscoveryQuery(Timestamped, Base):
    __tablename__ = "intelligence_discovery_queries"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    plan_revision: Mapped[int] = mapped_column(Integer, nullable=False)
    query: Mapped[str] = mapped_column(Text, nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    request_parameters: Mapped[dict] = mapped_column(json_column(), nullable=False, default=dict)
    provider_request_id: Mapped[str | None] = mapped_column(String(200))
    executed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


class DiscoveryResult(Timestamped, Base):
    __tablename__ = "intelligence_discovery_results"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    query_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_discovery_queries.id", ondelete="CASCADE"), index=True
    )
    raw_artifact_id: Mapped[str] = mapped_column(ForeignKey("intelligence_artifacts.id", ondelete="RESTRICT"))
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    operation: Mapped[str] = mapped_column(String(64), nullable=False)
    provider_result_id: Mapped[str | None] = mapped_column(String(300))
    rank_position: Mapped[int] = mapped_column(Integer, nullable=False)
    url: Mapped[str] = mapped_column(Text, nullable=False)
    title: Mapped[str | None] = mapped_column(Text)
    snippet: Mapped[str | None] = mapped_column(Text)
    publication_metadata: Mapped[dict] = mapped_column(json_column(), nullable=False, default=dict)
    provider_metadata: Mapped[dict] = mapped_column(json_column(), nullable=False, default=dict)


class Evidence(Timestamped, Base):
    __tablename__ = "intelligence_evidence"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    discovery_result_id: Mapped[str | None] = mapped_column(
        ForeignKey("intelligence_discovery_results.id", ondelete="SET NULL")
    )
    raw_artifact_id: Mapped[str] = mapped_column(ForeignKey("intelligence_artifacts.id", ondelete="RESTRICT"))
    canonical_url: Mapped[str] = mapped_column(Text, nullable=False)
    publisher: Mapped[str] = mapped_column(String(300), nullable=False)
    publication_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    retrieved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    extraction_method: Mapped[str] = mapped_column(String(64), nullable=False)
    extraction_quality: Mapped[float] = mapped_column(Float, nullable=False)
    content_fingerprint: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    text: Mapped[str] = mapped_column(Text, nullable=False)
    structure: Mapped[dict] = mapped_column(json_column(), nullable=False, default=dict)
    access_limitations: Mapped[list] = mapped_column(json_column(), nullable=False, default=list)


class EvidenceSegment(Timestamped, Base):
    __tablename__ = "intelligence_evidence_segments"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    evidence_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_evidence.id", ondelete="CASCADE"), index=True
    )
    location: Mapped[dict] = mapped_column(json_column(), nullable=False)
    text: Mapped[str] = mapped_column(Text, nullable=False)


class Entity(Timestamped, Base):
    __tablename__ = "intelligence_entities"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    entity_type: Mapped[str] = mapped_column(String(64), nullable=False)
    canonical_name: Mapped[str] = mapped_column(String(500), nullable=False, index=True)
    aliases: Mapped[list] = mapped_column(json_column(), nullable=False, default=list)
    scope: Mapped[str] = mapped_column(String(32), nullable=False, default="account")
    scope_key: Mapped[str | None] = mapped_column(String(300))


class EntityEdge(Timestamped, Base):
    __tablename__ = "intelligence_entity_edges"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_entity_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_entities.id", ondelete="CASCADE"), index=True
    )
    target_entity_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_entities.id", ondelete="CASCADE"), index=True
    )
    relation_type: Mapped[str] = mapped_column(String(100), nullable=False)
    provenance_evidence_id: Mapped[str | None] = mapped_column(
        ForeignKey("intelligence_evidence.id", ondelete="SET NULL")
    )
    confidence: Mapped[float] = mapped_column(Float, nullable=False)


class Claim(Timestamped, Base):
    __tablename__ = "intelligence_claims"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    external_fact: Mapped[str] = mapped_column(Text, nullable=False)
    account_match_basis: Mapped[str] = mapped_column(Text, nullable=False)
    uncertainty: Mapped[str] = mapped_column(Text, nullable=False)
    cluster_key: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    entity_state: Mapped[str] = mapped_column(String(32), nullable=False)


class ClaimEvidence(Timestamped, Base):
    __tablename__ = "intelligence_claim_evidence"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_claims.id", ondelete="CASCADE"), index=True
    )
    evidence_segment_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_evidence_segments.id", ondelete="RESTRICT"), index=True
    )


class Verification(Timestamped, Base):
    __tablename__ = "intelligence_verifications"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    claim_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_claims.id", ondelete="CASCADE"), index=True
    )
    state: Mapped[str] = mapped_column(String(32), nullable=False)
    rationale: Mapped[str] = mapped_column(Text, nullable=False)
    cited_evidence_ids: Mapped[list] = mapped_column(json_column(), nullable=False, default=list)
    policy_version: Mapped[str] = mapped_column(String(100), nullable=False)


class Signal(Timestamped, Base):
    __tablename__ = "intelligence_signals"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    claim_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_claims.id", ondelete="CASCADE"), index=True
    )
    verification_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_verifications.id", ondelete="RESTRICT")
    )
    disposition: Mapped[str] = mapped_column(String(32), nullable=False)
    priority_tier: Mapped[str] = mapped_column(String(32), nullable=False)
    disposition_rationale: Mapped[str] = mapped_column(Text, nullable=False)
    relevance_hypothesis: Mapped[str | None] = mapped_column(Text)
    validation_question: Mapped[str | None] = mapped_column(Text)
    uncertainty: Mapped[str] = mapped_column(Text, nullable=False)
    sort_order: Mapped[int] = mapped_column(Integer, nullable=False)


class Brief(Timestamped, Base):
    __tablename__ = "intelligence_briefs"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), unique=True
    )
    executive_summary: Mapped[str] = mapped_column(Text, nullable=False)
    unknowns_and_guardrails: Mapped[list] = mapped_column(json_column(), nullable=False, default=list)


class ModelInvocation(Timestamped, Base):
    __tablename__ = "intelligence_model_invocations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    stage: Mapped[str] = mapped_column(String(100), nullable=False)
    provider: Mapped[str] = mapped_column(String(64), nullable=False)
    model: Mapped[str] = mapped_column(String(200), nullable=False)
    prompt_version: Mapped[str] = mapped_column(String(100), nullable=False)
    request_artifact_id: Mapped[str | None] = mapped_column(
        ForeignKey("intelligence_artifacts.id", ondelete="SET NULL")
    )
    response_artifact_id: Mapped[str | None] = mapped_column(
        ForeignKey("intelligence_artifacts.id", ondelete="SET NULL")
    )
    input_tokens: Mapped[int | None] = mapped_column(Integer)
    output_tokens: Mapped[int | None] = mapped_column(Integer)
    latency_ms: Mapped[int] = mapped_column(Integer, nullable=False)
    estimated_cost_usd: Mapped[float | None] = mapped_column(Float)
    validation_state: Mapped[str] = mapped_column(String(32), nullable=False)
    retry_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    downstream_decision_ids: Mapped[list] = mapped_column(json_column(), nullable=False, default=list)


class MemoryItem(Timestamped, Base):
    __tablename__ = "intelligence_memory_items"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    scope: Mapped[str] = mapped_column(String(32), nullable=False)
    scope_key: Mapped[str | None] = mapped_column(String(300))
    memory_type: Mapped[str] = mapped_column(String(64), nullable=False)
    content: Mapped[str] = mapped_column(Text, nullable=False)
    provenance: Mapped[dict] = mapped_column(json_column(), nullable=False)
    salience: Mapped[float] = mapped_column(Float, nullable=False)
    expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))
    supersedes_id: Mapped[str | None] = mapped_column(
        ForeignKey("intelligence_memory_items.id", ondelete="SET NULL")
    )
    embedding: Mapped[list[float] | None] = mapped_column(Vector(384))


class FeedbackEvent(Timestamped, Base):
    __tablename__ = "intelligence_feedback_events"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    signal_id: Mapped[str | None] = mapped_column(ForeignKey("intelligence_signals.id", ondelete="SET NULL"))
    event_type: Mapped[str] = mapped_column(String(100), nullable=False)
    source: Mapped[str] = mapped_column(String(32), nullable=False)
    notes: Mapped[str | None] = mapped_column(Text)
    confidence: Mapped[float] = mapped_column(Float, nullable=False, default=1.0)


class FeedbackRevision(Timestamped, Base):
    __tablename__ = "intelligence_feedback_revisions"
    __table_args__ = (
        UniqueConstraint("signal_id", "revision", name="uq_feedback_revision_signal_revision"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    signal_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_signals.id", ondelete="CASCADE"), index=True
    )
    revision: Mapped[int] = mapped_column(Integer, nullable=False)
    verdict: Mapped[str] = mapped_column(String(32), nullable=False)
    reasons: Mapped[list] = mapped_column(json_column(), nullable=False, default=list)
    explanation: Mapped[str | None] = mapped_column(Text)
    is_current: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, index=True)
    source: Mapped[str] = mapped_column(String(32), nullable=False, default="seller")


class LearningRecord(Timestamped, Base):
    __tablename__ = "intelligence_learning_records"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    run_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_research_runs.id", ondelete="CASCADE"), index=True
    )
    record_type: Mapped[str] = mapped_column(String(100), nullable=False)
    payload: Mapped[dict] = mapped_column(json_column(), nullable=False)
    training_eligible: Mapped[bool] = mapped_column(nullable=False, default=False)
    retention_class: Mapped[str] = mapped_column(String(64), nullable=False)


class PolicyVersion(Timestamped, Base):
    __tablename__ = "intelligence_policy_versions"
    id: Mapped[str] = mapped_column(String(100), primary_key=True)
    policy_type: Mapped[str] = mapped_column(String(100), nullable=False)
    configuration: Mapped[dict] = mapped_column(json_column(), nullable=False)
    state: Mapped[str] = mapped_column(String(32), nullable=False, default="candidate")
    supersedes_id: Mapped[str | None] = mapped_column(
        ForeignKey("intelligence_policy_versions.id", ondelete="SET NULL")
    )


class PolicyEvaluation(Timestamped, Base):
    __tablename__ = "intelligence_policy_evaluations"
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    policy_version_id: Mapped[str] = mapped_column(
        ForeignKey("intelligence_policy_versions.id", ondelete="CASCADE")
    )
    replay_manifest_id: Mapped[str] = mapped_column(String(36), nullable=False)
    metrics: Mapped[dict] = mapped_column(json_column(), nullable=False)
    passed: Mapped[bool] = mapped_column(nullable=False)
    decision: Mapped[str] = mapped_column(Text, nullable=False)
