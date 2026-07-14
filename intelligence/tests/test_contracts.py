import pytest
from pydantic import ValidationError

from connected_monitor_intelligence.contracts import AccountContext, ResearchPlan, SignalAssessment


def test_research_plan_rejects_unbounded_query_sets() -> None:
    with pytest.raises(ValidationError):
        ResearchPlan(source_plan="Plan", queries=[], coverage_limitations=[], unresolved_questions=[])


def test_account_context_keeps_only_unique_aliases() -> None:
    context = AccountContext(name="Generic organization", aliases=["Generic", "Generic"])
    assert context.aliases == ["Generic"]


def test_signal_assessment_rejects_unbounded_customer_claim() -> None:
    with pytest.raises(ValidationError):
        SignalAssessment(
            disposition="keep",
            priority_tier="high",
            disposition_rationale="The organization will buy a product.",
            red_hat_relevance_hypothesis="This is a confirmed opportunity.",
            validation_question="Validate the claim.",
            uncertainty="Low",
        )


def test_rejected_noise_needs_no_relevance_or_action() -> None:
    assessment = SignalAssessment(
        disposition="reject",
        priority_tier="none",
        disposition_rationale="The acquired evidence does not match the account context.",
        uncertainty="Not applicable because the item is rejected as noise.",
    )
    assert assessment.red_hat_relevance_hypothesis is None
