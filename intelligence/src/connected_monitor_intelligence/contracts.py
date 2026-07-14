from __future__ import annotations

from datetime import datetime
from enum import StrEnum
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, HttpUrl, field_validator, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class RunState(StrEnum):
    QUEUED = "queued"
    PLANNING = "planning"
    DISCOVERING = "discovering"
    ACQUIRING = "acquiring"
    ANALYZING = "analyzing"
    SYNTHESIZING = "synthesizing"
    COMPLETED = "completed"
    PARTIAL = "partial"
    ABSTAINED = "abstained"
    BLOCKED = "blocked"
    FAILED = "failed"
    CANCELLED = "cancelled"


class AccountContext(StrictModel):
    name: Annotated[str, Field(min_length=1, max_length=300)]
    aliases: list[Annotated[str, Field(min_length=1, max_length=300)]] = Field(
        default_factory=list, max_length=30
    )
    context: Annotated[str | None, Field(max_length=4000)] = None

    @field_validator("aliases")
    @classmethod
    def normalize_aliases(cls, aliases: list[str]) -> list[str]:
        return list(dict.fromkeys(alias for alias in aliases if alias))


class ResearchRunCreate(StrictModel):
    account: AccountContext
    focus: Annotated[str | None, Field(max_length=2000)] = None
    timeframe: Literal["day", "week", "month", "quarter", "year", "all"] = "quarter"


class ResearchPlan(StrictModel):
    source_plan: Annotated[str, Field(min_length=1, max_length=3000)]
    queries: list[Annotated[str, Field(min_length=1, max_length=500)]] = Field(min_length=1, max_length=12)
    coverage_limitations: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(
        default_factory=list, max_length=12
    )
    unresolved_questions: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(
        default_factory=list, max_length=12
    )


class ExtractedFact(StrictModel):
    external_fact: Annotated[str, Field(min_length=1, max_length=2000)]
    supporting_excerpt: Annotated[str, Field(min_length=1, max_length=3000)]
    uncertainty: Annotated[str, Field(min_length=1, max_length=1000)]


class FactExtraction(StrictModel):
    facts: list[ExtractedFact] = Field(default_factory=list, max_length=12)


class EntityMatch(StrictModel):
    matched: bool
    match_basis: Annotated[str, Field(min_length=1, max_length=1000)]
    uncertainty: Annotated[str, Field(min_length=1, max_length=1000)]


class VerificationResult(StrictModel):
    state: Literal["supported", "insufficient", "contradicted"]
    rationale: Annotated[str, Field(min_length=1, max_length=2000)]
    cited_evidence_ids: list[Annotated[str, Field(min_length=1)]] = Field(default_factory=list, max_length=12)


class SignalAssessment(StrictModel):
    disposition: Literal["keep", "watch", "reject", "abstain"]
    priority_tier: Literal["high", "medium", "low", "none"]
    disposition_rationale: Annotated[str, Field(min_length=1, max_length=2000)]
    red_hat_relevance_hypothesis: Annotated[str | None, Field(max_length=2000)] = None
    validation_question: Annotated[str | None, Field(max_length=2000)] = None
    uncertainty: Annotated[str, Field(min_length=1, max_length=1000)]

    @model_validator(mode="after")
    def validate_visible_signal_boundaries(self) -> SignalAssessment:
        if self.disposition != "reject" and not self.red_hat_relevance_hypothesis:
            raise ValueError("Non-rejected signals require a bounded Red Hat relevance hypothesis")
        if self.disposition != "reject" and not self.validation_question:
            raise ValueError("Non-rejected signals require a validation question")
        for value in (
            self.disposition_rationale,
            self.red_hat_relevance_hypothesis,
            self.validation_question,
        ):
            if value and has_unbounded_prohibited_claim(value):
                raise ValueError(
                    "Interpretation must not present unsupported intent, fit, demand, opportunity, ownership, renewal, or deployment claims"
                )
        return self


class BriefDraft(StrictModel):
    executive_summary: Annotated[str, Field(min_length=1, max_length=3000)]
    unknowns_and_guardrails: list[Annotated[str, Field(min_length=1, max_length=1000)]] = Field(
        min_length=1, max_length=12
    )

    @field_validator("executive_summary")
    @classmethod
    def bounded_summary(cls, value: str) -> str:
        if has_unbounded_prohibited_claim(value):
            raise ValueError("Executive summary contains an unsupported claim")
        return value


class MemorySummary(StrictModel):
    summary: Annotated[str, Field(min_length=1, max_length=2000)]
    salience: Annotated[float, Field(ge=0, le=1)]


class FeedbackCreate(StrictModel):
    feedback_type: Literal[
        "useful",
        "not_useful",
        "already_known",
        "wrong_entity",
        "weak_source",
        "wrong_relevance",
        "missing_event",
        "incorrect_claim",
        "follow_up_requested",
    ]
    notes: Annotated[str | None, Field(max_length=4000)] = None


class OutcomeCreate(StrictModel):
    outcome_type: Literal["validated", "not_validated", "acted_on", "not_actionable", "unknown"]
    notes: Annotated[str | None, Field(max_length=4000)] = None


class RunSummary(StrictModel):
    id: str
    state: RunState
    account: AccountContext
    focus: str | None
    timeframe: str
    created_at: datetime
    updated_at: datetime
    coverage_limitations: list[str]
    blocked_reason: str | None


class SignalView(StrictModel):
    id: str
    external_fact: str
    excerpt: str
    source_url: HttpUrl
    publisher: str
    publication_date: datetime | None
    retrieved_at: datetime
    disposition: str
    priority_tier: str
    disposition_rationale: str
    red_hat_relevance_hypothesis: str | None
    validation_question: str | None
    uncertainty: str
    verification_state: str
    evidence_ids: list[str]
    feedback_types: list[str]


class BriefView(StrictModel):
    run: RunSummary
    executive_summary: str | None
    top_signals: list[SignalView]
    watch_items: list[SignalView]
    rejected_items: list[SignalView]
    abstained_items: list[SignalView]
    unknowns_and_guardrails: list[str]


class PolicyEvaluationRequest(StrictModel):
    candidate_policy_version: Annotated[str, Field(min_length=1, max_length=100)]
    replay_manifest_id: Annotated[str, Field(min_length=1)]


class PolicyCandidateCreate(StrictModel):
    id: Annotated[str, Field(min_length=1, max_length=100, pattern=r"^[a-z0-9][a-z0-9._-]+$")]
    policy_type: Annotated[str, Field(min_length=1, max_length=100)]
    configuration: dict
    base_policy_id: Annotated[str, Field(min_length=1, max_length=100)] = "baseline-v1"


_PROHIBITED = (
    "customer intent",
    "intends to",
    "plans to buy",
    "will buy",
    "is a red hat customer",
    "owns red hat",
    "demand for red hat",
    "confirmed fit",
    "confirmed opportunity",
    "will deploy",
    "will renew",
)
_BOUNDING = (
    "may",
    "might",
    "could",
    "possible",
    "hypothesis",
    "validate",
    "whether",
    "unknown",
    "uncertain",
    "not confirmed",
)


def has_unbounded_prohibited_claim(value: str) -> bool:
    normalized = value.lower()
    return any(term in normalized for term in _PROHIBITED) and not any(
        bound in normalized for bound in _BOUNDING
    )
