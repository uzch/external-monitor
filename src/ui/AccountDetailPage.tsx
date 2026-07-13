import { FormEvent, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  AccountDetailDto,
  CandidateEventRecord,
  EvaluationRecord,
  SourceRegistration,
} from "../domain/connectedContracts";
import {
  AccountTeamFeedback,
  AccountSignalBriefDto,
  AccountTeamFeedbackType,
  ResearchCapabilityStatus,
  ResearchSignal,
} from "../domain/researchContracts";
import { connectedApi } from "../services/connectedApi";
import { formatDateTime, formatScore } from "./format";
import { InvalidDataState } from "./InvalidDataState";

export function AccountDetailPage() {
  const { accountId } = useParams();
  const [detail, setDetail] = useState<AccountDetailDto>();
  const [brief, setBrief] = useState<AccountSignalBriefDto>();
  const [capabilities, setCapabilities] = useState<ResearchCapabilityStatus>();
  const [error, setError] = useState<unknown>();

  async function refresh() {
    if (!accountId) {
      throw new Error("Missing account id");
    }
    const [detailResult, briefResult, capabilityResult] = await Promise.all([
      connectedApi.accountDetail(accountId),
      connectedApi.accountSignalBrief(accountId),
      connectedApi.researchCapabilities(),
    ]);
    setDetail(detailResult);
    setBrief(briefResult);
    setCapabilities(capabilityResult);
  }

  useEffect(() => {
    refresh().catch(setError);
  }, [accountId]);

  if (error) {
    return <InvalidDataState error={error} />;
  }

  if (!detail || !brief || !capabilities) {
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

      <AccountSignalBriefPanel brief={brief} onChanged={refresh} />

      <ResearchReadinessPanel capabilities={capabilities} />

      <details className="panel debug-section">
        <summary>Monitor substrate and debug records</summary>
        <div className="debug-content">
          <div>
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
        </div>
      </details>
    </section>
  );
}

function AccountSignalBriefPanel({
  brief,
  onChanged,
}: {
  brief: AccountSignalBriefDto;
  onChanged: () => Promise<void>;
}) {
  const [copyMessage, setCopyMessage] = useState<string>();

  async function copyBrief() {
    const markdown = buildBriefMarkdown(brief);
    await navigator.clipboard.writeText(markdown);
    setCopyMessage("Copied brief Markdown.");
  }

  return (
    <div className="panel brief-panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Account-team output</p>
          <h2>Account Signal Brief</h2>
        </div>
        <div className="brief-actions">
          {brief.latestResearchRun ? (
            <p className="ranking-note">
              Imported {formatDateTime(brief.latestResearchRun.importedAt)} from {brief.latestResearchRun.importSource}
            </p>
          ) : (
            <p className="ranking-note">No live research run yet.</p>
          )}
          <button type="button" onClick={copyBrief}>Copy Brief as Markdown</button>
          {copyMessage ? <p className="form-success">{copyMessage}</p> : null}
        </div>
      </div>

      <section className="brief-summary">
        <h3>Executive summary</h3>
        <p>{brief.executiveSummary}</p>
      </section>

      <ResearchProcessSummary brief={brief} />

      <FeedbackSummary summary={brief.feedbackSummary} />

      <ResearchSignalSection
        title="Top signals to validate"
        emptyText="No kept signals are ready for account-team validation."
        signals={brief.topSignalsToValidate}
        feedback={brief.feedback}
        onChanged={onChanged}
      />

      <ResearchSignalSection
        title="Watch items"
        emptyText="No watch items are recorded."
        signals={brief.watchItems}
        feedback={brief.feedback}
        onChanged={onChanged}
      />

      <ResearchSignalSection
        title="Rejected noise"
        emptyText="No rejected noise has been recorded."
        signals={brief.rejectedNoise}
        feedback={brief.feedback}
        onChanged={onChanged}
      />

      <div className="brief-columns">
        <section>
          <h3>Account-team validation questions</h3>
          {brief.validationQuestions.length === 0 ? (
            <p className="muted-text">No validation questions yet.</p>
          ) : (
            <ul>
              {brief.validationQuestions.map((question) => (
                <li key={question}>{question}</li>
              ))}
            </ul>
          )}
        </section>
        <section>
          <h3>Unknowns and guardrails</h3>
          <ul>
            {brief.unknownsAndGuardrails.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </section>
      </div>

      <EvidenceTable signals={brief.evidenceTable} />
    </div>
  );
}

function ResearchProcessSummary({ brief }: { brief: AccountSignalBriefDto }) {
  const run = brief.latestResearchRun;

  return (
    <section className="brief-process">
      <h3>Research process and coverage</h3>
      <div className="brief-columns">
        <section>
          <h4>Source plan</h4>
          <p>{run?.sourcePlan || "No source plan imported yet."}</p>
        </section>
        <ListSection title="Sources checked" values={run?.sourcesChecked ?? []} emptyText="No sources checked recorded." />
        <ListSection title="Search queries used" values={run?.searchQueriesUsed ?? []} emptyText="No search queries recorded." />
        <ListSection title="Source gaps" values={run?.sourceGaps ?? []} emptyText="No source gaps recorded." />
        <ListSection
          title="Coverage limitations"
          values={run?.coverageLimitations ?? []}
          emptyText="No coverage limitations recorded."
        />
      </div>
    </section>
  );
}

function ListSection({
  title,
  values,
  emptyText,
}: {
  title: string;
  values: string[];
  emptyText: string;
}) {
  return (
    <section>
      <h4>{title}</h4>
      {values.length === 0 ? (
        <p className="muted-text">{emptyText}</p>
      ) : (
        <ul>
          {values.map((value) => (
            <li key={value}>{value}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function FeedbackSummary({ summary }: { summary: AccountSignalBriefDto["feedbackSummary"] }) {
  return (
    <section className="feedback-summary">
      <h3>Feedback summary</h3>
      <div className="feedback-pills">
        {feedbackTypes.map((type) => (
          <span key={type}>{feedbackLabel(type)}: {summary[type]}</span>
        ))}
      </div>
    </section>
  );
}

function ResearchReadinessPanel({ capabilities }: { capabilities: ResearchCapabilityStatus }) {
  const status = [
    { label: "Reasoning", value: capabilities.reasoning },
    { label: "Evidence retrieval", value: capabilities.retrieval },
    { label: "Live public-web search", value: capabilities.liveSearch },
  ];

  return (
    <section className="panel research-readiness" aria-labelledby="research-readiness-title">
      <p className="eyebrow">Autonomous research</p>
      <h2 id="research-readiness-title">Research readiness</h2>
      <p className="ranking-note">
        The application owns research planning, source selection, and evidence handling. A seller never needs to paste sources or conclusions.
      </p>
      <div className="readiness-list">
        {status.map(({ label, value }) => (
          <div className="readiness-row" key={label}>
            <span className={`badge ${value.available ? "keep" : "abstain"}`}>
              {value.available ? "Ready" : "Blocked"}
            </span>
            <div>
              <strong>{label}</strong>
              <p>{value.message}</p>
            </div>
          </div>
        ))}
      </div>
      {!capabilities.liveSearch.available ? (
        <p className="notice">
          A live Account Signal Brief cannot begin until an approved public-web search capability is configured. No imported or RSS-only substitute is used.
        </p>
      ) : null}
    </section>
  );
}

function ResearchSignalSection({
  title,
  emptyText,
  signals,
  feedback,
  onChanged,
}: {
  title: string;
  emptyText: string;
  signals: ResearchSignal[];
  feedback: AccountTeamFeedback[];
  onChanged: () => Promise<void>;
}) {
  return (
    <section className="brief-section">
      <h3>{title}</h3>
      {signals.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="signal-list">
          {signals.map((signal) => (
            <ResearchSignalCard
              key={signal.id}
              signal={signal}
              feedback={feedback.filter((item) => item.researchSignalId === signal.id)}
              onChanged={onChanged}
            />
          ))}
        </div>
      )}
    </section>
  );
}

function ResearchSignalCard({
  signal,
  feedback,
  onChanged,
}: {
  signal: ResearchSignal;
  feedback: AccountTeamFeedback[];
  onChanged: () => Promise<void>;
}) {
  return (
    <article className="signal-card research-signal-card">
      <div className="signal-card-header">
        <div>
          <span className={`badge ${signal.disposition}`}>{signal.disposition}</span>
          <span className={`badge ${signal.priorityTier}`}>{signal.priorityTier}</span>
          <h3>{signal.externalFact}</h3>
        </div>
        <div className="score-block">
          <span>Uncertainty</span>
          <strong>{signal.uncertaintyState}</strong>
        </div>
      </div>
      <div className="signal-grid">
        <section>
          <h4>Source evidence</h4>
          <dl>
            <div>
              <dt>Publisher</dt>
              <dd>{signal.publisher}</dd>
            </div>
            <div>
              <dt>Category</dt>
              <dd>{signal.sourceCategory}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd><a href={signal.sourceUrl}>{signal.sourceUrl}</a></dd>
            </div>
            <div>
              <dt>Date</dt>
              <dd>{formatDateTime(signal.publicationDate ?? signal.retrievedAt)}</dd>
            </div>
          </dl>
        </section>
        <section>
          <h4>Excerpt used</h4>
          <p>{signal.excerpt}</p>
        </section>
        <section>
          <h4>Disposition rationale</h4>
          <p>{signal.dispositionRationale}</p>
          <p className="muted-text">Account match: {signal.accountMatchBasis}</p>
        </section>
        <section>
          <h4>Bounded Red Hat lens</h4>
          <p>{signal.redHatRelevanceHypothesis ?? "No Red Hat relevance hypothesis assigned to rejected noise."}</p>
          <p className="validation-question">
            {signal.validationQuestion ?? "No validation action recommended."}
          </p>
        </section>
      </div>
      <FeedbackHistory feedback={feedback} />
      <SignalFeedbackForm signalId={signal.id} onChanged={onChanged} />
    </article>
  );
}

function FeedbackHistory({ feedback }: { feedback: AccountTeamFeedback[] }) {
  if (feedback.length === 0) {
    return <p className="muted-text feedback-history">No saved feedback yet.</p>;
  }

  return (
    <section className="feedback-history">
      <h4>Saved feedback</h4>
      <ul>
        {feedback.map((item) => (
          <li key={item.id}>
            <strong>{feedbackLabel(item.feedbackType)}</strong>
            <span>{formatDateTime(item.createdAt)}</span>
            {item.notes ? <span>{item.notes}</span> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function SignalFeedbackForm({
  signalId,
  onChanged,
}: {
  signalId: string;
  onChanged: () => Promise<void>;
}) {
  const [feedbackType, setFeedbackType] = useState<AccountTeamFeedbackType>("useful");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState<string>();
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setMessage(undefined);
    setError(undefined);
    try {
      await connectedApi.recordSignalFeedback(signalId, {
        feedbackType,
        notes: notes || undefined,
      });
      setNotes("");
      setMessage("Feedback saved.");
      await onChanged();
    } catch (feedbackError) {
      setError(feedbackError instanceof Error ? feedbackError.message : String(feedbackError));
    }
  }

  return (
    <form className="feedback-form" onSubmit={submit}>
      <label>
        Account-team feedback
        <select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value as AccountTeamFeedbackType)}>
          <option value="useful">Useful</option>
          <option value="not_useful">Not useful</option>
          <option value="wrong_angle">Wrong angle</option>
          <option value="already_known">Already known</option>
          <option value="needs_better_source">Needs better source</option>
          <option value="follow_up_later">Follow up later</option>
        </select>
      </label>
      <label>
        Notes
        <input value={notes} onChange={(event) => setNotes(event.target.value)} />
      </label>
      <button type="submit">Save feedback</button>
      {message ? <p className="form-success">{message}</p> : null}
      {error ? <p className="form-error">{error}</p> : null}
    </form>
  );
}

function EvidenceTable({ signals }: { signals: ResearchSignal[] }) {
  if (signals.length === 0) {
    return <div className="empty-state">No evidence rows are available until live research completes.</div>;
  }

  return (
    <section className="brief-section">
      <h3>Evidence table</h3>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Disposition</th>
              <th>External fact</th>
              <th>Publisher</th>
              <th>Date</th>
              <th>Validation question</th>
            </tr>
          </thead>
          <tbody>
            {signals.map((signal) => (
              <tr key={signal.id}>
                <td><span className={`badge ${signal.disposition}`}>{signal.disposition}</span></td>
                <td>{signal.externalFact}</td>
                <td>{signal.publisher}</td>
                <td>{formatDateTime(signal.publicationDate ?? signal.retrievedAt)}</td>
                <td>{signal.validationQuestion ?? "No validation action recommended."}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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

function buildBriefMarkdown(brief: AccountSignalBriefDto): string {
  const lines = [
    `# Account Signal Brief: ${brief.account.name}`,
    "",
    "## Executive Summary",
    brief.executiveSummary,
    "",
    "## Research Process",
    `Source plan: ${brief.latestResearchRun?.sourcePlan ?? "Not recorded"}`,
    listMarkdown("Sources checked", brief.latestResearchRun?.sourcesChecked ?? []),
    listMarkdown("Search queries used", brief.latestResearchRun?.searchQueriesUsed ?? []),
    listMarkdown("Source gaps", brief.latestResearchRun?.sourceGaps ?? []),
    listMarkdown("Coverage limitations", brief.latestResearchRun?.coverageLimitations ?? []),
    "",
    signalMarkdown("Top Signals To Validate", brief.topSignalsToValidate),
    signalMarkdown("Watch Items", brief.watchItems),
    signalMarkdown("Rejected Noise", brief.rejectedNoise),
    "",
    listMarkdown("Unknowns And Guardrails", brief.unknownsAndGuardrails),
  ];
  return lines.filter((line) => line !== undefined).join("\n");
}

function listMarkdown(title: string, values: string[]): string {
  const items = values.length > 0 ? values.map((value) => `- ${value}`).join("\n") : "- None recorded.";
  return `\n## ${title}\n${items}`;
}

function signalMarkdown(title: string, signals: ResearchSignal[]): string {
  if (signals.length === 0) {
    return `## ${title}\n- None.`;
  }

  return [
    `## ${title}`,
    ...signals.map((signal) => [
      `- ${signal.externalFact}`,
      `  - Priority: ${signal.priorityTier}`,
      `  - Source: ${signal.publisher} - ${signal.sourceUrl}`,
      `  - Rationale: ${signal.dispositionRationale}`,
      `  - Hypothesis: ${signal.redHatRelevanceHypothesis ?? "None assigned."}`,
      `  - Validation: ${signal.validationQuestion ?? "No validation action recommended."}`,
    ].join("\n")),
  ].join("\n");
}

const feedbackTypes: AccountTeamFeedbackType[] = [
  "useful",
  "not_useful",
  "wrong_angle",
  "already_known",
  "needs_better_source",
  "follow_up_later",
];

function feedbackLabel(type: AccountTeamFeedbackType): string {
  return {
    useful: "Useful",
    not_useful: "Not useful",
    wrong_angle: "Wrong angle",
    already_known: "Already known",
    needs_better_source: "Needs better source",
    follow_up_later: "Follow up later",
  }[type];
}
