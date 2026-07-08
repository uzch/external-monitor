import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AccountDetailDto,
  CandidateEventRecord,
  EvaluationRecord,
  SourceRegistration,
} from "../domain/connectedContracts";
import { connectedApi } from "../services/connectedApi";
import { formatDateTime, formatScore } from "./format";
import { InvalidDataState } from "./InvalidDataState";

export function AccountDetailPage() {
  const { accountId } = useParams();
  const [detail, setDetail] = useState<AccountDetailDto>();
  const [error, setError] = useState<unknown>();

  async function refresh() {
    if (!accountId) {
      throw new Error("Missing account id");
    }
    setDetail(await connectedApi.accountDetail(accountId));
  }

  useEffect(() => {
    refresh().catch(setError);
  }, [accountId]);

  if (error) {
    return <InvalidDataState error={error} />;
  }

  if (!detail) {
    return <section className="panel empty-state">Loading account detail...</section>;
  }

  return (
    <section className="detail-layout">
      <Link to="/" className="back-link">
        Back to portfolio
      </Link>

      <div className="panel account-summary">
        <div>
          <p className="eyebrow">Account detail</p>
          <h2>{detail.account.name}</h2>
          <p>{detail.account.sector ?? detail.account.hierarchyLabel}</p>
        </div>
        <div>
          <span className={`badge ${detail.account.mappingStatus}`}>{detail.account.mappingStatus}</span>
          <p>{detail.coverageNotice}</p>
        </div>
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">{detail.sourceRegistrations.length} source registrations</p>
            <h2>Registered sources</h2>
          </div>
        </div>
        <div className="source-list">
          {detail.sourceRegistrations.map((source) => (
            <SourceRow key={source.id} source={source} onChanged={refresh} />
          ))}
        </div>
      </div>

      <SignalPairSection
        title="Evaluated semantic signals"
        emptyText="No evidence-backed semantic signals are evaluated for this account."
        pairs={detail.evaluatedSignals}
      />

      <CandidateSection
        title="Awaiting evaluation"
        emptyText="No candidates are awaiting evaluation."
        candidates={detail.awaitingEvaluation}
      />

      <SignalPairSection
        title="Abstained evaluations"
        emptyText="No evaluator abstentions are recorded."
        pairs={detail.abstainedSignals}
      />

      <SignalPairSection
        title="Degraded evaluations"
        emptyText="No degraded evaluations are recorded."
        pairs={detail.degradedSignals}
      />

      <SignalPairSection
        title="Failed evaluations"
        emptyText="No failed evaluations are recorded."
        pairs={detail.failedEvaluations}
      />
    </section>
  );
}

function SourceRow({
  source,
  onChanged,
}: {
  source: SourceRegistration;
  onChanged: () => Promise<void>;
}) {
  async function setState(state: SourceRegistration["state"]) {
    await connectedApi.updateSourceRegistration(source.id, { state });
    await onChanged();
  }

  return (
    <div className="source-row">
      <div>
        <strong>{source.displayName}</strong>
        <span>{source.url}</span>
        <span>State: {source.state}</span>
        {source.lastRetrievedAt ? <span>Last retrieved: {formatDateTime(source.lastRetrievedAt)}</span> : null}
      </div>
      <div className="source-actions">
        {source.state === "active" ? (
          <button type="button" onClick={() => setState("inactive")}>Deactivate</button>
        ) : (
          <button type="button" onClick={() => setState("active")}>Activate</button>
        )}
        <button type="button" onClick={() => setState("archived")}>Archive</button>
      </div>
    </div>
  );
}

function SignalPairSection({
  title,
  emptyText,
  pairs,
}: {
  title: string;
  emptyText: string;
  pairs: Array<{ candidate: CandidateEventRecord; evaluation: EvaluationRecord }>;
}) {
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Signal evidence</p>
          <h2>{title}</h2>
        </div>
      </div>
      {pairs.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="signal-list">
          {pairs.map((pair) => (
            <EvaluatedSignalCard key={pair.candidate.id} candidate={pair.candidate} evaluation={pair.evaluation} />
          ))}
        </div>
      )}
    </div>
  );
}

function CandidateSection({
  title,
  emptyText,
  candidates,
}: {
  title: string;
  emptyText: string;
  candidates: CandidateEventRecord[];
}) {
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Retrieved candidates</p>
          <h2>{title}</h2>
        </div>
      </div>
      {candidates.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="signal-list">
          {candidates.map((candidate) => (
            <CandidateCard key={candidate.id} candidate={candidate} />
          ))}
        </div>
      )}
    </div>
  );
}

function EvaluatedSignalCard({
  candidate,
  evaluation,
}: {
  candidate: CandidateEventRecord;
  evaluation: EvaluationRecord;
}) {
  return (
    <article className="signal-card">
      <div className="signal-card-header">
        <div>
          <span className={`badge ${evaluation.state}`}>{evaluation.state}</span>
          <h3>{candidate.title}</h3>
        </div>
        <div className="score-block">
          <span>Semantic priority</span>
          <strong>{formatScore(evaluation.semanticPriorityScore ?? 0)}</strong>
        </div>
      </div>

      <EvidenceGrid candidate={candidate} />

      <div className="signal-grid">
        <section>
          <h4>Account-match basis</h4>
          <p>{evaluation.accountMatchBasis}</p>
        </section>
        <section>
          <h4>Red Hat relevance hypothesis</h4>
          <p>{evaluation.relevanceHypothesis ?? "No relevance hypothesis was produced."}</p>
          <p className="muted-text">Capability IDs: {evaluation.selectedCapabilityIds.join(", ") || "None"}</p>
        </section>
        <section>
          <h4>Validation action</h4>
          <p>{evaluation.validationAction ?? "No validation action was produced."}</p>
        </section>
        <section>
          <h4>Uncertainty and evaluation metadata</h4>
          <dl>
            <div>
              <dt>Uncertainty</dt>
              <dd>{evaluation.uncertainty ?? "Not provided"}</dd>
            </div>
            <div>
              <dt>Abstention reason</dt>
              <dd>{evaluation.abstentionReason ?? "Not applicable"}</dd>
            </div>
            <div>
              <dt>Evaluator</dt>
              <dd>{evaluation.evaluatorName} / {evaluation.evaluatorVersion}</dd>
            </div>
            <div>
              <dt>Policy</dt>
              <dd>{evaluation.evaluationPolicyVersion}</dd>
            </div>
            <div>
              <dt>Diagnostics</dt>
              <dd>{evaluation.diagnostics ?? "None"}</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}

function CandidateCard({ candidate }: { candidate: CandidateEventRecord }) {
  return (
    <article className="signal-card">
      <div className="signal-card-header">
        <div>
          <span className="badge awaiting_evaluation">awaiting_evaluation</span>
          <h3>{candidate.title}</h3>
        </div>
      </div>
      <EvidenceGrid candidate={candidate} />
      <div className="notice muted">
        This candidate is retrieved evidence only. It has not produced a Red Hat relevance hypothesis,
        validation action, or semantic priority claim.
      </div>
    </article>
  );
}

function EvidenceGrid({ candidate }: { candidate: CandidateEventRecord }) {
  return (
    <div className="signal-grid">
      <section>
        <h4>Retrieved fact</h4>
        <p>{candidate.externalFact}</p>
      </section>
      <section>
        <h4>Bounded evidence</h4>
        <dl>
          <div>
            <dt>Publisher</dt>
            <dd>{candidate.sourceName}</dd>
          </div>
          <div>
            <dt>URL</dt>
            <dd>
              <a href={candidate.canonicalUrl}>{candidate.canonicalUrl}</a>
            </dd>
          </div>
          <div>
            <dt>Publication date</dt>
            <dd>{formatDateTime(candidate.publicationDate)}</dd>
          </div>
          <div>
            <dt>Retrieved</dt>
            <dd>{formatDateTime(candidate.retrievedAt)}</dd>
          </div>
          <div>
            <dt>Fingerprint</dt>
            <dd>{candidate.contentFingerprint.slice(0, 16)}</dd>
          </div>
        </dl>
      </section>
      <section>
        <h4>Excerpt used</h4>
        <p>{candidate.excerpt}</p>
      </section>
      <section>
        <h4>Candidate metadata</h4>
        <dl>
          <div>
            <dt>Account match</dt>
            <dd>{candidate.accountMatchBasis}</dd>
          </div>
          <div>
            <dt>Prefilter</dt>
            <dd>{candidate.prefilterStatus}{candidate.prefilterReason ? `: ${candidate.prefilterReason}` : ""}</dd>
          </div>
          <div>
            <dt>Duplicate</dt>
            <dd>{candidate.isDuplicate ? "Duplicate candidate" : "Primary candidate"}</dd>
          </div>
        </dl>
      </section>
    </div>
  );
}
