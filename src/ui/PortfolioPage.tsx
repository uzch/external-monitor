import { FormEvent, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  AccountSummaryDto,
  HealthDto,
  MonitorRun,
  MonitoredAccount,
  PortfolioDto,
  SourceRegistration,
} from "../domain/connectedContracts";
import { connectedApi } from "../services/connectedApi";
import { formatDateTime, formatScore } from "./format";
import { InvalidDataState } from "./InvalidDataState";

export function PortfolioPage() {
  const [health, setHealth] = useState<HealthDto>();
  const [portfolio, setPortfolio] = useState<PortfolioDto>();
  const [accounts, setAccounts] = useState<MonitoredAccount[]>([]);
  const [sources, setSources] = useState<SourceRegistration[]>([]);
  const [runs, setRuns] = useState<MonitorRun[]>([]);
  const [error, setError] = useState<unknown>();
  const [isRunning, setIsRunning] = useState(false);

  async function refresh() {
    const [healthResult, portfolioResult, accountsResult, sourcesResult, runsResult] =
      await Promise.all([
        connectedApi.health(),
        connectedApi.portfolio(),
        connectedApi.accounts(),
        connectedApi.sourceRegistrations(),
        connectedApi.monitorRuns(),
      ]);
    setHealth(healthResult);
    setPortfolio(portfolioResult);
    setAccounts(accountsResult);
    setSources(sourcesResult);
    setRuns(runsResult);
  }

  useEffect(() => {
    refresh().catch(setError);
  }, []);

  async function startRun() {
    setIsRunning(true);
    try {
      await connectedApi.startMonitorRun();
      await refresh();
    } catch (runError) {
      setError(runError);
    } finally {
      setIsRunning(false);
    }
  }

  if (error) {
    return <InvalidDataState error={error} />;
  }

  if (!health || !portfolio) {
    return <section className="panel empty-state">Loading Connected Monitor v1...</section>;
  }

  return (
    <section className="page-grid">
      <div className="panel controls-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Runtime setup</p>
            <h2>Monitored accounts and sources</h2>
          </div>
        </div>

        <div className={health.evaluator === "configured" ? "notice muted" : "notice"}>
          {health.evaluator === "configured"
            ? "Semantic evaluator configured. Evidence-backed evaluated records may produce Red Hat relevance hypotheses."
            : "Semantic evaluator is not configured. Retrieved candidates remain awaiting evaluation and are not Red Hat-priority claims."}
        </div>

        <div className="notice muted">{portfolio.coverageNotice}</div>

        <button type="button" onClick={startRun} disabled={isRunning || sources.length === 0}>
          {isRunning ? "Running monitor..." : "Run monitor now"}
        </button>

        <AccountForm onCreated={refresh} />
        <SourceForm accounts={accounts.filter((account) => account.status === "active")} onCreated={refresh} />
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Ranked accounts</p>
            <h2>{portfolio.accounts.length} active monitored accounts</h2>
          </div>
          {portfolio.latestRun ? (
            <p className="ranking-note">
              Latest run: {portfolio.latestRun.state} at {formatDateTime(portfolio.latestRun.updatedAt)}
            </p>
          ) : (
            <p className="ranking-note">No monitor run has completed yet.</p>
          )}
        </div>

        {portfolio.accounts.length === 0 ? (
          <div className="empty-state">Add an account and an active RSS/Atom source to start monitoring.</div>
        ) : (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Sources</th>
                  <th>Rank score</th>
                  <th>Evaluated</th>
                  <th>Awaiting</th>
                  <th>Abstained/degraded/failed</th>
                  <th>Latest evaluated evidence</th>
                </tr>
              </thead>
              <tbody>
                {portfolio.accounts.map((summary) => (
                  <AccountRow key={summary.account.id} summary={summary} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Run history</p>
            <h2>Manual monitor runs</h2>
          </div>
        </div>
        {runs.length === 0 ? (
          <div className="empty-state">No monitor runs recorded.</div>
        ) : (
          <div className="run-list">
            {runs.map((run) => (
              <div className="run-item" key={run.id}>
                <strong>{run.state}</strong>
                <span>{formatDateTime(run.updatedAt)}</span>
                <span>{run.warningCount} warnings / {run.errorCount} errors</span>
                {run.diagnostics.length > 0 ? <span>{run.diagnostics.length} degraded-mode notices</span> : null}
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
function AccountRow({ summary }: { summary: AccountSummaryDto }) {
  return (
    <tr>
      <td>
        <Link to={`/accounts/${summary.account.id}`} className="account-link">
          {summary.account.name}
        </Link>
        <span>{summary.account.sector ?? summary.account.hierarchyLabel}</span>
      </td>
      <td>{summary.sourceCount} active</td>
      <td>{formatScore(summary.rankingScore)}</td>
      <td>{summary.evaluatedSignalCount}</td>
      <td>{summary.awaitingEvaluationCount}</td>
      <td>
        {summary.abstainedCount} / {summary.degradedCount} / {summary.failedEvaluationCount}
      </td>
      <td>
        {summary.latestEvaluatedEvent ? (
          <>
            <strong>{summary.latestEvaluatedEvent.title}</strong>
            <span>{formatDateTime(summary.latestEvaluatedEvent.publicationDate)}</span>
          </>
        ) : (
          <span className="muted-text">No evaluated semantic signal</span>
        )}
      </td>
    </tr>
  );
}

function AccountForm({ onCreated }: { onCreated: () => Promise<void> }) {
  const [name, setName] = useState("");
  const [aliases, setAliases] = useState("");
  const [sector, setSector] = useState("");
  const [error, setError] = useState<string>();

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      await connectedApi.createAccount({
        name,
        aliases: aliases.split(",").map((alias) => alias.trim()).filter(Boolean),
        sector: sector || undefined,
      });
      setName("");
      setAliases("");
      setSector("");
      await onCreated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    }
  }

  return (
    <form className="setup-form" onSubmit={submit}>
      <h3>Add monitored account</h3>
      <label>
        Account name
        <input value={name} onChange={(event) => setName(event.target.value)} required />
      </label>
      <label>
        Aliases
        <input
          value={aliases}
          onChange={(event) => setAliases(event.target.value)}
          placeholder="Comma-separated aliases"
        />
      </label>
      <label>
        Sector
        <input value={sector} onChange={(event) => setSector(event.target.value)} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit">Add account</button>
    </form>
  );
}

function SourceForm({
  accounts,
  onCreated,
}: {
  accounts: MonitoredAccount[];
  onCreated: () => Promise<void>;
}) {
  const [accountId, setAccountId] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!accountId && accounts[0]) {
      setAccountId(accounts[0].id);
    }
  }, [accountId, accounts]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    try {
      await connectedApi.createSourceRegistration({ accountId, displayName, url });
      setDisplayName("");
      setUrl("");
      await onCreated();
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : String(createError));
    }
  }

  return (
    <form className="setup-form" onSubmit={submit}>
      <h3>Register RSS/Atom source</h3>
      <label>
        Account
        <select value={accountId} onChange={(event) => setAccountId(event.target.value)} required>
          {accounts.map((account) => (
            <option key={account.id} value={account.id}>
              {account.name}
            </option>
          ))}
        </select>
      </label>
      <label>
        Source name
        <input value={displayName} onChange={(event) => setDisplayName(event.target.value)} required />
      </label>
      <label>
        RSS/Atom URL
        <input value={url} onChange={(event) => setUrl(event.target.value)} required />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <button type="submit" disabled={accounts.length === 0}>
        Register source
      </button>
    </form>
  );
}
