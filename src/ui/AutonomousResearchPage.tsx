import { FormEvent, useEffect, useState } from "react";
import { intelligenceApi, IntelligenceBrief, IntelligenceRun } from "../services/intelligenceApi";
import { formatDateTime } from "./format";
import { InvalidDataState } from "./InvalidDataState";

const terminalStates = new Set(["completed", "partial", "abstained", "blocked", "failed", "cancelled"]);
const activeRunStorageKey = "connected-monitor.activeResearchRunId";

export function AutonomousResearchPage() {
  const [accountName, setAccountName] = useState("");
  const [aliases, setAliases] = useState("");
  const [focus, setFocus] = useState("");
  const [timeframe, setTimeframe] = useState("quarter");
  const [run, setRun] = useState<IntelligenceRun>();
  const [brief, setBrief] = useState<IntelligenceBrief>();
  const [error, setError] = useState<unknown>();
  const [isStarting, setIsStarting] = useState(false);

  useEffect(() => {
    const queryRunId = new URLSearchParams(window.location.search).get("runId")?.trim();
    const savedRunId = queryRunId || window.localStorage.getItem(activeRunStorageKey);
    if (!savedRunId) {
      return;
    }
    if (queryRunId) {
      window.localStorage.setItem(activeRunStorageKey, queryRunId);
    }
    intelligenceApi.run(savedRunId).then(setRun).catch(() => {
      window.localStorage.removeItem(activeRunStorageKey);
    });
  }, []);

  useEffect(() => {
    if (!run || terminalStates.has(run.state)) {
      return;
    }
    const timer = window.setInterval(() => {
      intelligenceApi.run(run.id).then(setRun).catch(setError);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [run]);

  useEffect(() => {
    if (run && terminalStates.has(run.state)) {
      intelligenceApi.brief(run.id).then(setBrief).catch(setError);
    }
  }, [run?.id, run?.state]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(undefined);
    setBrief(undefined);
    setIsStarting(true);
    try {
      const nextRun = await intelligenceApi.startRun({
        account: { name: accountName, aliases: aliases.split(",").map((value) => value.trim()).filter(Boolean) },
        focus: focus || undefined,
        timeframe,
      });
      window.localStorage.setItem(activeRunStorageKey, nextRun.id);
      setRun(nextRun);
    } catch (startError) {
      setError(startError);
    } finally {
      setIsStarting(false);
    }
  }

  if (error) {
    return <InvalidDataState error={error} />;
  }

  return (
    <section className="page-grid intelligence-page">
      <div className="panel controls-panel">
        <div className="section-heading">
          <div>
            <p className="eyebrow">Autonomous research</p>
            <h2>Start an evidence-backed brief</h2>
          </div>
        </div>
        <p className="muted-text">The system plans, discovers, retrieves, verifies, and reports with explicit uncertainty.</p>
        <form className="setup-form" onSubmit={submit}>
          <label>
            Account name
            <input value={accountName} onChange={(event) => setAccountName(event.target.value)} required />
          </label>
          <label>
            Aliases
            <input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Optional comma-separated aliases" />
          </label>
          <label>
            Research focus
            <input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Optional area to investigate" />
          </label>
          <label>
            Timeframe
            <select value={timeframe} onChange={(event) => setTimeframe(event.target.value)}>
              <option value="month">Last month</option>
              <option value="quarter">Last quarter</option>
              <option value="year">Last year</option>
              <option value="all">No date preference</option>
            </select>
          </label>
          <button type="submit" disabled={isStarting}>{isStarting ? "Starting research..." : "Start research"}</button>
        </form>
      </div>

      {run ? <RunStatus run={run} onCancel={() => intelligenceApi.cancel(run.id).then(() => intelligenceApi.run(run.id)).then(setRun).catch(setError)} /> : null}
      {brief ? <BriefView brief={brief} /> : null}
    </section>
  );
}

function RunStatus({ run, onCancel }: { run: IntelligenceRun; onCancel: () => void }) {
  const isTerminal = terminalStates.has(run.state);
  return (
    <div className="panel">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Research run</p>
          <h2>{run.state.replaceAll("_", " ")}</h2>
        </div>
        {!isTerminal ? <button type="button" className="secondary-button" onClick={onCancel}>Cancel</button> : null}
      </div>
      <p className="ranking-note">Started {formatDateTime(run.created_at)}. Progress reflects persisted backend stages.</p>
      {run.blocked_reason ? <p className="form-error">{run.blocked_reason}</p> : null}
      {run.coverage_limitations.length > 0 ? <ul className="detail-list">{run.coverage_limitations.map((item) => <li key={item}>{item}</li>)}</ul> : null}
    </div>
  );
}

function BriefView({ brief }: { brief: IntelligenceBrief }) {
  const groups = [["Top signals to validate", brief.top_signals], ["Watch items", brief.watch_items], ["Rejected or abstained", [...brief.rejected_items, ...brief.abstained_items]]] as const;
  return (
    <div className="panel brief-panel">
      <div className="section-heading"><div><p className="eyebrow">Account signal brief</p><h2>{brief.executive_summary ?? "No brief is available yet."}</h2></div></div>
      {groups.map(([title, signals]) => signals.length ? <section className="brief-group" key={title}><h3>{title}</h3>{signals.map((signal) => <article className="signal-card" key={signal.id}><p className="eyebrow">{signal.priority_tier} priority - {signal.verification_state}</p><h4>{signal.external_fact}</h4><p>{signal.red_hat_relevance_hypothesis ?? "No validation action recommended."}</p><p className="muted-text">Validate: {signal.validation_question ?? "No validation action recommended."}</p><details><summary>Evidence and uncertainty</summary><p>{signal.excerpt}</p><a href={signal.source_url} target="_blank" rel="noreferrer">{signal.publisher}</a><p>{signal.uncertainty}</p></details><div className="button-row"><FeedbackButton runId={brief.run.id} signalId={signal.id} feedbackType="useful">Useful</FeedbackButton><FeedbackButton runId={brief.run.id} signalId={signal.id} feedbackType="not_useful">Not useful</FeedbackButton><FeedbackButton runId={brief.run.id} signalId={signal.id} feedbackType="wrong_relevance">Wrong angle</FeedbackButton></div></article>)}</section> : null)}
      {brief.unknowns_and_guardrails.length ? <section className="brief-group"><h3>Unknowns and guardrails</h3><ul className="detail-list">{brief.unknowns_and_guardrails.map((item) => <li key={item}>{item}</li>)}</ul></section> : null}
    </div>
  );
}

function FeedbackButton({ runId, signalId, feedbackType, children }: { runId: string; signalId: string; feedbackType: string; children: string }) {
  const [saved, setSaved] = useState(false);
  return <button type="button" className="secondary-button" disabled={saved} onClick={() => intelligenceApi.feedback(runId, signalId, feedbackType).then(() => setSaved(true))}>{saved ? "Saved" : children}</button>;
}
