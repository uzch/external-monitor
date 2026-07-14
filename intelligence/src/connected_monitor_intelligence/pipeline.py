from __future__ import annotations

from datetime import UTC, datetime
from hashlib import sha256
from urllib.parse import urlparse

from .artifacts import ArtifactStore
from .brave import BraveDiscovery
from .config import Settings, settings
from .contracts import (
    AccountContext,
    BriefDraft,
    EntityMatch,
    FactExtraction,
    MemorySummary,
    ResearchPlan,
    RunState,
    SignalAssessment,
    VerificationResult,
)
from .embeddings import EmbeddingUnavailable, embed_text
from .maas import MaaSClient
from .retrieval import AcquiredDocument, RetrievalRouter
from .store import IntelligenceStore
from .tavily_api import TavilyApiConnector
from .tavily_mcp import TavilyMcpConnector


class IntelligencePipeline:
    def __init__(self, configured_settings: Settings = settings):
        self.settings = configured_settings
        self.store = IntelligenceStore()
        self.artifacts = ArtifactStore(configured_settings)
        self.maas = MaaSClient(configured_settings, self.store, self.artifacts)
        self.brave = BraveDiscovery(configured_settings, self.store, self.artifacts)
        self.tavily_api = TavilyApiConnector(configured_settings, self.store, self.artifacts)
        self.tavily_mcp = TavilyMcpConnector(configured_settings, self.store, self.artifacts)
        self.retrieval = RetrievalRouter(configured_settings)

    def validate_readiness(self) -> list[str]:
        blockers = []
        if not self.settings.maas_configured:
            blockers.append("MaaS reasoning is not configured.")
        if not self.settings.discovery_configured:
            blockers.append("No live discovery provider is configured.")
        return blockers

    async def plan(self, run_id: str, replan_reason: str | None = None) -> list[str]:
        task_id = self.store.start_task(run_id, "research_planning", {"replan_reason": replan_reason})
        try:
            run = self._run(run_id)
            account = AccountContext.model_validate(run.account_context)
            prior = run.plan_data or {}
            try:
                account_memory = self.store.retrieve_memory(
                    "account",
                    account.name.casefold(),
                    embed_text(f"{account.name}\n{run.focus or ''}"),
                )
            except EmbeddingUnavailable as error:
                account_memory = []
                self.store.record_learning(run_id, "memory_unavailable", {"message": str(error)})
            plan = await self.maas.complete(
                run_id,
                "planning",
                "Create a bounded public-web research plan. Select where to look and queries that could increase evidence coverage. Do not draw conclusions. Query wording must be account-agnostic and grounded in the supplied context.",
                {
                    "account": account.model_dump(),
                    "focus": run.focus,
                    "timeframe": run.timeframe,
                    "prior_plan": prior,
                    "account_memory": account_memory,
                    "replan_reason": replan_reason,
                },
                ResearchPlan,
            )
            plan_revision = self.store.save_plan(run_id, plan.model_dump(), plan.coverage_limitations)
            query_ids = [
                f"{plan_revision}:{index}:{query}"
                for index, query in enumerate(plan.queries[: self.settings.max_queries])
            ]
            self.store.record_learning(
                run_id,
                "research_plan",
                {"revision": plan_revision, "plan": plan.model_dump(), "replan_reason": replan_reason},
            )
            self.store.finish_task(task_id, {"plan_revision": plan_revision, "query_count": len(query_ids)})
            return query_ids
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            raise

    async def discover(self, run_id: str, query_token: str, kind: str) -> list[str]:
        revision_text, _, query = query_token.partition(":")
        _, _, query = query.partition(":")
        revision = int(revision_text)
        task_id = self.store.start_task(
            run_id, "discovery", {"query": query, "kind": kind, "plan_revision": revision}
        )
        try:
            plan = self._run(run_id).plan_data or {}
            result = await self._discover_with_policy(
                run_id, revision, query, str(plan.get("source_plan") or "Research-plan query"), kind
            )
            self.store.finish_task(
                task_id,
                {
                    "query_id": result.query_id,
                    "result_ids": result.result_ids,
                    "provider": result.provider,
                    "operation": result.operation,
                },
            )
            return result.result_ids
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            raise

    def select_resources(self, run_id: str) -> list[str]:
        task_id = self.store.start_task(
            run_id, "resource_selection", {"policy": "provider_rank_domain_diversity"}
        )
        try:
            ids = [
                result.id
                for result in self.store.list_selectable_discovery_results(
                    run_id, self.settings.max_resources
                )
            ]
            self.store.record_learning(
                run_id,
                "source_selection",
                {"selected_result_ids": ids, "strategy": "provider_rank_domain_diversity"},
            )
            self.store.finish_task(task_id, {"selected_result_ids": ids})
            return ids
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            raise

    async def acquire(self, run_id: str, discovery_result_id: str) -> str | None:
        task_id = self.store.start_task(run_id, "acquisition", {"discovery_result_id": discovery_result_id})
        try:
            result = self.store.get_discovery_result(discovery_result_id)
            if not result:
                raise KeyError(f"Unknown discovery result {discovery_result_id}")
            document, raw_artifact_id, provider_operation = await self._acquire_with_policy(run_id, result)
            evidence = self.store.record_evidence(run_id, result.id, raw_artifact_id, document)
            self.store.record_learning(
                run_id,
                "acquisition",
                {
                    "discovery_result_id": result.id,
                    "evidence_id": evidence.id,
                    "discovery_provider": result.provider,
                    "acquisition_provider_operation": provider_operation,
                    "extraction_method": document.extraction_method,
                    "quality": document.extraction_quality,
                    "diagnostics": document.diagnostics,
                },
            )
            self.store.finish_task(
                task_id,
                {
                    "evidence_id": evidence.id,
                    "extraction_method": document.extraction_method,
                    "text_length": len(document.text),
                },
            )
            return evidence.id
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            return None

    async def _discover_with_policy(self, run_id: str, revision: int, query: str, rationale: str, kind: str):
        topic = "news" if kind == "news" else "general"
        providers = []
        if self.settings.tavily_api_configured:
            providers.append(("tavily_api", f"tavily_api_{topic}_search", self.tavily_api.search))
        if self.settings.tavily_mcp_configured:
            providers.append(("tavily_mcp", f"tavily_mcp_{topic}_search", self.tavily_mcp.search))
        if self.settings.brave_configured:
            providers.append(("brave", f"brave_{kind}_search", self.brave.search))
        errors: list[dict[str, str]] = []
        for provider, operation, search in providers:
            try:
                result = await search(run_id, revision, query, rationale, topic if provider != "brave" else kind)
                if result.result_ids:
                    return _DiscoveryOutcome(result.query_id, result.result_ids, provider, operation)
                errors.append({"provider": provider, "operation": operation, "error": "no_results"})
            except Exception as error:
                errors.append({"provider": provider, "operation": operation, "error": str(error)[:500]})
        self.store.record_learning(
            run_id,
            "provider_fallback_exhausted",
            {"stage": "discovery", "query": query, "kind": kind, "errors": errors},
        )
        raise RuntimeError("No configured discovery provider returned results.")

    async def _acquire_with_policy(self, run_id: str, discovery_result) -> tuple[AcquiredDocument, str, str]:
        if discovery_result.provider == "tavily_api" and self.settings.tavily_api_configured:
            try:
                extracted = await self.tavily_api.extract(run_id, discovery_result.url)
                return self._document_from_tavily_extract(discovery_result.url, extracted.raw, "tavily_api_extract"), extracted.artifact_id, "tavily_api_extract"
            except Exception as error:
                self.store.record_learning(
                    run_id,
                    "provider_fallback",
                    {
                        "stage": "acquisition",
                        "provider": "tavily_api",
                        "operation": "tavily_api_extract",
                        "url": discovery_result.url,
                        "error": str(error)[:500],
                    },
                )
        if discovery_result.provider == "tavily_mcp" and self.settings.tavily_mcp_configured:
            try:
                extracted = await self.tavily_mcp.extract(run_id, discovery_result.url)
                return self._document_from_tavily_extract(discovery_result.url, extracted.raw, "tavily_mcp_extract"), extracted.artifact_id, "tavily_mcp_extract"
            except Exception as error:
                self.store.record_learning(
                    run_id,
                    "provider_fallback",
                    {
                        "stage": "acquisition",
                        "provider": "tavily_mcp",
                        "operation": "tavily_mcp_extract",
                        "url": discovery_result.url,
                        "error": str(error)[:500],
                    },
                )
        document = await self.retrieval.acquire(discovery_result.url)
        raw_artifact = self.store.record_artifact(
            run_id,
            "source_response",
            self.artifacts.put_bytes(run_id, "source_response", document.content_type, document.body),
            document.canonical_url,
        )
        return document, raw_artifact.id, "system_controlled_retrieval"

    @staticmethod
    def _document_from_tavily_extract(url: str, raw: dict, method: str) -> AcquiredDocument:
        item = IntelligencePipeline._first_tavily_extract_item(raw)
        text = str(item.get("raw_content") or item.get("content") or item.get("text") or "").strip()
        canonical_url = str(item.get("url") or url)
        publisher = urlparse(canonical_url).hostname or "unknown"
        diagnostics = ["provider_extract_input_not_verified_evidence"]
        if not text:
            diagnostics.append("provider_extract_returned_no_text")
        body = text.encode("utf-8")
        return AcquiredDocument(
            canonical_url=canonical_url,
            content_type="text/plain",
            body=body,
            text=text,
            title=item.get("title") if isinstance(item.get("title"), str) else None,
            publisher=publisher.removeprefix("www."),
            publication_date=None,
            retrieved_at=datetime.now(UTC),
            extraction_method=method,
            extraction_quality=min(1.0, len(text) / 3000) if text else 0.0,
            structure={"provider_extract": True, "source": method},
            diagnostics=diagnostics,
        )

    @staticmethod
    def _first_tavily_extract_item(raw: dict) -> dict:
        result = raw.get("result") if isinstance(raw, dict) else None
        candidates = []
        if isinstance(raw.get("results"), list):
            candidates = raw["results"]
        elif isinstance(result, dict) and isinstance(result.get("results"), list):
            candidates = result["results"]
        elif isinstance(result, dict):
            content = result.get("content")
            if isinstance(content, list):
                for item in content:
                    if isinstance(item, dict) and isinstance(item.get("json"), dict):
                        nested = item["json"].get("results")
                        if isinstance(nested, list):
                            candidates = nested
                            break
        return next((item for item in candidates if isinstance(item, dict)), {})

    async def extract_and_resolve(self, run_id: str, evidence_id: str) -> list[str]:
        task_id = self.store.start_task(run_id, "evidence_extraction", {"evidence_id": evidence_id})
        try:
            evidence = next(
                (item for item in self.store.list_evidence(run_id) if item.id == evidence_id), None
            )
            if not evidence or not evidence.text:
                self.store.finish_task(
                    task_id, {"claim_ids": [], "reason": "No extractable acquired source text"}
                )
                return []
            run = self._run(run_id)
            account = AccountContext.model_validate(run.account_context)
            extraction = await self.maas.complete(
                run_id,
                "extraction",
                "Extract only bounded external facts from the acquired source. Each supporting excerpt must be copied exactly from the source text. Return no fact if the source does not support it.",
                {
                    "source": {
                        "evidence_id": evidence.id,
                        "url": evidence.canonical_url,
                        "publisher": evidence.publisher,
                        "publication_date": evidence.publication_date.isoformat()
                        if evidence.publication_date
                        else None,
                        "text": evidence.text[:18000],
                    }
                },
                FactExtraction,
                [evidence.id],
            )
            segment = self.store.get_evidence_segment(evidence.id)
            claim_ids: list[str] = []
            for fact in extraction.facts:
                if not segment or fact.supporting_excerpt not in segment.text:
                    continue
                entity = await self._entity_match(run_id, account, fact.external_fact, evidence.id)
                if not entity.matched:
                    continue
                cluster_key = sha256(self._normalize_fact(fact.external_fact).encode()).hexdigest()
                claim = self.store.record_claim(
                    run_id,
                    fact.external_fact,
                    entity.match_basis,
                    fact.uncertainty,
                    cluster_key,
                    "matched",
                    segment.id,
                )
                self.store.record_account_event_edge(account.name, cluster_key, evidence.id)
                claim_ids.append(claim.id)
            self.store.finish_task(
                task_id, {"claim_ids": claim_ids, "extracted_fact_count": len(extraction.facts)}
            )
            return claim_ids
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            return []

    async def verify_and_rank(self, run_id: str, claim_id: str, sort_order: int) -> str | None:
        task_id = self.store.start_task(run_id, "verification_and_ranking", {"claim_id": claim_id})
        try:
            claim = next((item for item in self.store.list_claims(run_id) if item.id == claim_id), None)
            if not claim:
                raise KeyError(f"Unknown claim {claim_id}")
            sources = self.store.evidence_for_claim(claim_id)
            evidence_payload = [
                {
                    "id": evidence.id,
                    "url": evidence.canonical_url,
                    "publisher": evidence.publisher,
                    "excerpt": segment.text[:4000],
                }
                for evidence, segment in sources
            ]
            verification = await self.maas.complete(
                run_id,
                "verification",
                "Verify the proposed external fact using only the acquired evidence. Mark insufficient when there is no direct support. Cite only evidence IDs provided.",
                {"claim": claim.external_fact, "evidence": evidence_payload},
                VerificationResult,
                [claim.id],
            )
            valid_ids = {item["id"] for item in evidence_payload}
            if not set(verification.cited_evidence_ids).issubset(valid_ids):
                verification = VerificationResult(
                    state="insufficient",
                    rationale="Verification returned invalid evidence references.",
                    cited_evidence_ids=[],
                )
            verification_record = self.store.record_verification(
                claim.id,
                verification.state,
                verification.rationale,
                verification.cited_evidence_ids,
                self._run(run_id).policy_version,
            )
            if verification.state != "supported":
                assessment = SignalAssessment(
                    disposition="abstain",
                    priority_tier="none",
                    disposition_rationale="Evidence was not sufficient to promote this candidate.",
                    uncertainty=verification.rationale,
                    red_hat_relevance_hypothesis="Evidence is insufficient for a bounded relevance hypothesis.",
                    validation_question="What additional public evidence would be needed to validate this candidate?",
                )
            else:
                assessment = await self.maas.complete(
                    run_id,
                    "relevance_ranking",
                    "Assess a verified external fact through a bounded Red Hat lens. Keep fact, hypothesis, uncertainty, and validation question separate. Do not claim customer intent, fit, demand, opportunity, ownership, deployment, or renewal.",
                    {
                        "external_fact": claim.external_fact,
                        "account_match_basis": claim.account_match_basis,
                        "verification": verification.model_dump(),
                        "evidence": evidence_payload,
                    },
                    SignalAssessment,
                    [claim.id, verification_record.id],
                )
            signal = self.store.record_signal(
                run_id, claim.id, verification_record.id, assessment, sort_order
            )
            self.store.record_learning(
                run_id,
                "signal_decision",
                {
                    "signal_id": signal.id,
                    "claim_id": claim.id,
                    "verification": verification.state,
                    "disposition": assessment.disposition,
                    "priority": assessment.priority_tier,
                },
            )
            self.store.finish_task(
                task_id,
                {
                    "signal_id": signal.id,
                    "verification_state": verification.state,
                    "disposition": assessment.disposition,
                },
            )
            return signal.id
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            return None

    async def synthesize(self, run_id: str) -> str:
        task_id = self.store.start_task(run_id, "brief_synthesis", {})
        try:
            run = self._run(run_id)
            signals = self.store.list_signals(run_id)
            if not signals:
                brief = BriefDraft(
                    executive_summary="No verified account-relevant external signal was promoted in this bounded research run.",
                    unknowns_and_guardrails=[
                        "No promoted signal should be interpreted as complete external-world coverage.",
                        *run.coverage_limitations,
                    ],
                )
                self.store.set_run_state(run_id, RunState.ABSTAINED)
            else:
                payload = [
                    {
                        "disposition": signal.disposition,
                        "priority": signal.priority_tier,
                        "fact": self.store.claim_for_signal(signal.id)[1].external_fact,
                        "hypothesis": signal.relevance_hypothesis,
                        "validation_question": signal.validation_question,
                        "uncertainty": signal.uncertainty,
                    }
                    for signal in signals
                    if self.store.claim_for_signal(signal.id)
                ]
                brief = await self.maas.complete(
                    run_id,
                    "synthesis",
                    "Write a concise evidence-backed account brief. Do not turn hypotheses into facts. State important unknowns and guardrails explicitly.",
                    {"signals": payload, "coverage_limitations": run.coverage_limitations},
                    BriefDraft,
                    [signal.id for signal in signals],
                )
                self.store.set_run_state(
                    run_id,
                    RunState.COMPLETED
                    if any(signal.disposition == "keep" for signal in signals)
                    else RunState.PARTIAL,
                )
            record = self.store.record_brief(
                run_id,
                brief.executive_summary,
                list(dict.fromkeys([*brief.unknowns_and_guardrails, *run.coverage_limitations])),
            )
            self.store.finish_task(task_id, {"brief_id": record.id, "signal_count": len(signals)})
            return record.id
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            self.store.set_run_state(run_id, RunState.FAILED, str(error))
            raise

    async def consolidate_memory(self, run_id: str) -> str | None:
        run = self._run(run_id)
        brief = self.store.get_brief(run_id)
        if not brief:
            return None
        task_id = self.store.start_task(run_id, "memory_consolidation", {"brief_id": brief.id})
        try:
            summary = await self.maas.complete(
                run_id,
                "memory_consolidation",
                "Create a concise durable memory summary from this evidence-backed brief. Do not add claims.",
                {"brief": brief.executive_summary, "guardrails": brief.unknowns_and_guardrails},
                MemorySummary,
                [brief.id],
            )
            account = AccountContext.model_validate(run.account_context)
            memory_id = self.store.record_memory(
                "account",
                account.name.casefold(),
                "episodic_summary",
                summary.summary,
                {"run_id": run_id, "brief_id": brief.id},
                summary.salience,
                embed_text(summary.summary),
            )
            self.store.finish_task(task_id, {"memory_id": memory_id})
            return memory_id
        except Exception as error:
            self.store.fail_task(task_id, str(error))
            return None

    def replay(self, run_id: str) -> str:
        return self.store.create_replay_manifest(run_id)

    def _run(self, run_id: str):
        run = self.store.get_run(run_id)
        if not run:
            raise KeyError(f"Unknown research run {run_id}")
        return run

    async def _entity_match(
        self, run_id: str, account: AccountContext, fact: str, evidence_id: str
    ) -> EntityMatch:
        aliases = [account.name, *account.aliases]
        if any(alias.casefold() in fact.casefold() for alias in aliases):
            return EntityMatch(
                matched=True,
                match_basis="Exact account name or configured alias appears in the extracted fact.",
                uncertainty="Alias matching does not establish ownership, intent, or complete entity resolution.",
            )
        return await self.maas.complete(
            run_id,
            "entity_resolution",
            "Determine whether the external fact refers to the supplied account or an alias. Abstain when identity is ambiguous.",
            {"account": account.model_dump(), "external_fact": fact, "evidence_id": evidence_id},
            EntityMatch,
            [evidence_id],
        )

    @staticmethod
    def _normalize_fact(value: str) -> str:
        return " ".join(value.casefold().split())


class _DiscoveryOutcome:
    def __init__(self, query_id: str, result_ids: list[str], provider: str, operation: str):
        self.query_id = query_id
        self.result_ids = result_ids
        self.provider = provider
        self.operation = operation
