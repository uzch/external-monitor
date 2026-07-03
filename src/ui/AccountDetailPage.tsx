import { Link, useParams, useSearchParams } from "react-router-dom";
import { SignalRecord } from "../domain/contracts";
import { getApplicationServices } from "../services/applicationServices";
import { formatDate, formatDateTime, formatScore } from "./format";
import { InvalidDataState } from "./InvalidDataState";

export function AccountDetailPage() {
  const { accountId } = useParams();
  const [searchParams] = useSearchParams();
  const scopeId = searchParams.get("scope");
  let detail: ReturnType<
    ReturnType<typeof getApplicationServices>["accountService"]["getAccountDetail"]
  >;

  try {
    const { accountService } = getApplicationServices();
    detail = accountId ? accountService.getAccountDetail(accountId) : undefined;
  } catch (error) {
    return <InvalidDataState error={error} />;
  }

  if (!detail) {
    return (
      <section className="panel empty-state">
        <h2>Account not found</h2>
        <Link to={scopeId ? `/?scope=${scopeId}` : "/"}>Back to portfolio</Link>
      </section>
    );
  }

  return (
    <section className="detail-layout">
      <Link to={scopeId ? `/?scope=${scopeId}` : "/"} className="back-link">
        Back to portfolio
      </Link>

      <div className="panel account-summary">
        <div>
          <p className="eyebrow">Account detail</p>
          <h2>{detail.account.name}</h2>
          <p>{detail.account.sector}</p>
        </div>
        <div>
          <span className={`badge ${detail.mappingStatus}`}>{detail.mappingLabel}</span>
          <p>{detail.mappingDetail}</p>
        </div>
      </div>

      <div className="panel pulse-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Account status</p>
            <h2>Account Pulse</h2>
            <p>{detail.pulse.summary}</p>
          </div>
        </div>
        <dl className="pulse-grid">
          <div>
            <dt>Latest qualifying event</dt>
            <dd>
              {detail.pulse.latestQualifyingEvent
                ? `${detail.pulse.latestQualifyingEvent.title} (${formatDate(
                    detail.pulse.latestQualifyingEvent.publicationDate,
                  )})`
                : "None loaded"}
            </dd>
          </div>
          <div>
            <dt>Validation action</dt>
            <dd>{detail.pulse.suggestedValidationAction ?? "No qualifying action loaded."}</dd>
          </div>
          <div>
            <dt>Loaded hierarchy paths</dt>
            <dd>{detail.hierarchyPaths.join("; ")}</dd>
          </div>
        </dl>
      </div>

      <SignalSection
        title="Prioritized signals"
        emptyText="No prioritized signals are loaded for this account."
        signals={detail.prioritizedSignals}
      />

      <SignalSection
        title="Lower-priority and audit signals"
        emptyText="No lower-priority signals are loaded for this account."
        signals={detail.lowerPrioritySignals}
      />
    </section>
  );
}

function SignalSection({
  title,
  emptyText,
  signals,
}: {
  title: string;
  emptyText: string;
  signals: SignalRecord[];
}) {
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Signal evidence</p>
          <h2>{title}</h2>
        </div>
      </div>
      {signals.length === 0 ? (
        <div className="empty-state">{emptyText}</div>
      ) : (
        <div className="signal-list">
          {signals.map((signal) => (
            <SignalCard key={signal.event.id} signal={signal} />
          ))}
        </div>
      )}
    </div>
  );
}

function SignalCard({ signal }: { signal: SignalRecord }) {
  return (
    <article className="signal-card">
      <div className="signal-card-header">
        <div>
          <span className={`badge ${signal.evaluation.disposition}`}>
            {signal.evaluation.disposition}
          </span>
          <h3>{signal.event.title}</h3>
        </div>
        <div className="score-block">
          <span>Priority</span>
          <strong>{formatScore(signal.evaluation.priorityScore)}</strong>
        </div>
      </div>

      <div className="signal-grid">
        <section>
          <h4>External fact</h4>
          <p>{signal.event.externalFact}</p>
        </section>
        <section>
          <h4>Source evidence</h4>
          <dl>
            <div>
              <dt>Publisher</dt>
              <dd>{signal.event.sourceName}</dd>
            </div>
            <div>
              <dt>URL</dt>
              <dd>
                <a href={signal.event.sourceUrl}>{signal.event.sourceUrl}</a>
              </dd>
            </div>
            <div>
              <dt>Publication date</dt>
              <dd>{formatDateTime(signal.event.publicationDate)}</dd>
            </div>
            <div>
              <dt>Retrieved</dt>
              <dd>{formatDateTime(signal.event.retrievedAt)}</dd>
            </div>
            <div>
              <dt>Source type</dt>
              <dd>{signal.event.sourceType}</dd>
            </div>
            <div>
              <dt>Source reference</dt>
              <dd>
                {signal.event.sourceRef.fixture} / {signal.event.sourceRef.recordId}
              </dd>
            </div>
          </dl>
        </section>
        <section>
          <h4>Red Hat relevance hypothesis</h4>
          <p>{signal.evaluation.generalRedHatRelevance}</p>
          {signal.evaluation.accountSpecificRelevance ? (
            <p>{signal.evaluation.accountSpecificRelevance}</p>
          ) : (
            <p className="muted-text">No account-specific relevance is loaded.</p>
          )}
        </section>
        <section>
          <h4>Validation action</h4>
          <p>{signal.evaluation.validationAction}</p>
        </section>
        <section>
          <h4>Evaluation metadata</h4>
          <dl>
            <div>
              <dt>Rationale</dt>
              <dd>{signal.evaluation.rationale}</dd>
            </div>
            <div>
              <dt>Factor scores</dt>
              <dd>{JSON.stringify(signal.evaluation.factorScores)}</dd>
            </div>
            <div>
              <dt>Evaluated</dt>
              <dd>{formatDateTime(signal.evaluation.evaluatedAt)}</dd>
            </div>
            <div>
              <dt>Evaluator</dt>
              <dd>{signal.evaluation.evaluatorVersion}</dd>
            </div>
          </dl>
        </section>
      </div>
    </article>
  );
}
