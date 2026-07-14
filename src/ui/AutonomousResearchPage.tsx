import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  FeedbackReason,
  FeedbackVerdict,
  IntelligenceBrief,
  IntelligenceRun,
  IntelligenceSignal,
  SignalDisposition,
  SignalLedger,
  intelligenceApi,
} from "../services/intelligenceApi";
import { formatDateTime } from "./format";
import { InvalidDataState } from "./InvalidDataState";

const activeRunStorageKey = "connected-monitor.activeResearchRunId";
const terminalStates = new Set(["completed", "partial", "abstained", "blocked", "failed", "cancelled"]);
const dispositionOrder: SignalDisposition[] = ["keep", "watch", "reject", "abstain"];
const feedbackReasons: Array<{ value: FeedbackReason; label: string }> = [
  { value: "wrong_relevance", label: "Wrong angle" },
  { value: "incorrect_claim", label: "Incorrect claim" },
  { value: "weak_source", label: "Weak source" },
  { value: "already_known", label: "Already known" },
  { value: "wrong_entity", label: "Wrong entity" },
];

type View = "brief" | "runs" | "ledger";

export function AutonomousResearchPage() {
  const [view, setView] = useState<View>("brief");
  const [runs, setRuns] = useState<IntelligenceRun[]>([]);
  const [run, setRun] = useState<IntelligenceRun>();
  const [brief, setBrief] = useState<IntelligenceBrief>();
  const [ledger, setLedger] = useState<SignalLedger>();
  const [error, setError] = useState<unknown>();
  const [loading, setLoading] = useState(true);

  async function loadRuns() {
    const loaded = await intelligenceApi.runs();
    setRuns(loaded);
    return loaded;
  }

  async function openRun(runId: string, nextView: View = "brief") {
    setError(undefined);
    const loadedRun = await intelligenceApi.run(runId);
    window.localStorage.setItem(activeRunStorageKey, runId);
    setRun(loadedRun);
    setView(nextView);
    if (terminalStates.has(loadedRun.state)) {
      const [loadedBrief, loadedLedger] = await Promise.all([
        intelligenceApi.brief(runId),
        intelligenceApi.ledger(runId),
      ]);
      setBrief(loadedBrief);
      setLedger(loadedLedger);
    } else {
      setBrief(undefined);
      setLedger(undefined);
    }
  }

  useEffect(() => {
    const runId = new URLSearchParams(window.location.search).get("runId")?.trim()
      || window.localStorage.getItem(activeRunStorageKey);
    loadRuns()
      .then(async () => {
        if (runId) await openRun(runId);
      })
      .catch((loadError) => {
        window.localStorage.removeItem(activeRunStorageKey);
        setError(loadError);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!run || terminalStates.has(run.state)) return;
    const timer = window.setInterval(() => {
      intelligenceApi.run(run.id)
        .then((updated) => {
          setRun(updated);
          if (terminalStates.has(updated.state)) return openRun(updated.id, view);
          return undefined;
        })
        .catch(setError);
    }, 1500);
    return () => window.clearInterval(timer);
  }, [run?.id, run?.state, view]);

  async function onStarted(nextRun: IntelligenceRun) {
    setRun(nextRun);
    setBrief(undefined);
    setLedger(undefined);
    setView("brief");
    window.localStorage.setItem(activeRunStorageKey, nextRun.id);
    await loadRuns();
  }

  async function refreshSignals() {
    if (!run) return;
    const [loadedBrief, loadedLedger] = await Promise.all([intelligenceApi.brief(run.id), intelligenceApi.ledger(run.id)]);
    setBrief(loadedBrief);
    setLedger(loadedLedger);
    await loadRuns();
  }

  if (error) return <InvalidDataState error={error} />;

  return (
    <section className="research-workspace" aria-busy={loading}>
      <header className="research-topbar">
        <div>
          <p className="workspace-kicker">Connected Monitor</p>
          <h2>Account research</h2>
        </div>
        <div className="workspace-nav" aria-label="Research navigation">
          <button className={view === "brief" ? "is-active" : ""} onClick={() => setView("brief")}>Current brief</button>
          <button className={view === "runs" ? "is-active" : ""} onClick={() => setView("runs")}>View all runs</button>
          {run && ledger ? <button className={view === "ledger" ? "is-active" : ""} onClick={() => setView("ledger")}>Evaluated signals</button> : null}
        </div>
      </header>

      {view === "runs" ? <RunHistory runs={runs} onOpen={(id) => void openRun(id)} /> : null}
      {view === "ledger" && run && ledger ? <SignalLedgerView ledger={ledger} onBack={() => setView("brief")} onFeedbackSaved={() => void refreshSignals()} /> : null}
      {view === "brief" ? (
        <>
          {!run ? <ResearchIntake onStarted={onStarted} /> : null}
          {run ? <RunHero run={run} onLedger={() => setView("ledger")} onRuns={() => setView("runs")} onCancel={() => intelligenceApi.cancel(run.id).then(() => openRun(run.id)).catch(setError)} /> : null}
          {run && !terminalStates.has(run.state) ? <ProgressState run={run} /> : null}
          {brief ? <BriefSurface brief={brief} onLedger={() => setView("ledger")} onFeedbackSaved={() => void refreshSignals()} /> : null}
          {run && terminalStates.has(run.state) && !brief ? <TerminalEmptyState run={run} /> : null}
        </>
      ) : null}
    </section>
  );
}

function ResearchIntake({ onStarted }: { onStarted: (run: IntelligenceRun) => Promise<void> }) {
  const [accountName, setAccountName] = useState("");
  const [aliases, setAliases] = useState("");
  const [focus, setFocus] = useState("");
  const [timeframe, setTimeframe] = useState("quarter");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>();
  async function submit(event: FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(undefined);
    try {
      await onStarted(await intelligenceApi.startRun({
        account: { name: accountName, aliases: aliases.split(",").map((item) => item.trim()).filter(Boolean) },
        focus: focus || undefined,
        timeframe,
      }));
    } catch (startError) {
      setError(startError instanceof Error ? startError.message : "Research could not start.");
    } finally {
      setSubmitting(false);
    }
  }
  return <div className="research-intake">
    <div className="intake-copy"><p className="workspace-kicker">External intelligence</p><h1>Start with the account, not the sources.</h1><p>Research is evidence-bound. The brief separates facts, hypotheses, and validation questions.</p></div>
    <form className="intake-form" onSubmit={submit}>
      <label>Account name<input value={accountName} onChange={(event) => setAccountName(event.target.value)} required autoFocus /></label>
      <label>Focus<input value={focus} onChange={(event) => setFocus(event.target.value)} placeholder="Optional research focus" /></label>
      <label>Aliases<input value={aliases} onChange={(event) => setAliases(event.target.value)} placeholder="Optional, comma separated" /></label>
      <label>Timeframe<select value={timeframe} onChange={(event) => setTimeframe(event.target.value)}><option value="month">Last month</option><option value="quarter">Last quarter</option><option value="year">Last year</option><option value="all">No date preference</option></select></label>
      {error ? <p className="inline-error" role="alert">{error}</p> : null}
      <button className="primary-action" disabled={submitting}>{submitting ? "Starting research" : "Start research"}</button>
    </form>
  </div>;
}

function RunHero({ run, onLedger, onRuns, onCancel }: { run: IntelligenceRun; onLedger: () => void; onRuns: () => void; onCancel: () => void }) {
  const active = !terminalStates.has(run.state);
  return <section className="run-hero">
    <div><p className="workspace-kicker">{active ? "Research in progress" : "Research brief"}</p><h1>{run.account.name}</h1><p>{run.focus || "Open-ended external change research"}</p><div className="run-meta"><span>{labelState(run.state)}</span><span>{labelTimeframe(run.timeframe)}</span><span>Started {formatDateTime(run.created_at)}</span></div></div>
    <div className="run-actions"><button className="quiet-action" onClick={onRuns}>View all runs</button>{active ? <button className="quiet-action" onClick={onCancel}>Cancel research</button> : <button className="primary-action" onClick={onLedger}>View all evaluated signals</button>}</div>
  </section>;
}

function ProgressState({ run }: { run: IntelligenceRun }) {
  const stages = ["planning", "discovering", "acquiring", "analyzing", "synthesizing"];
  const activeIndex = Math.max(0, stages.indexOf(run.state));
  return <section className="research-progress" aria-live="polite"><p>Research is active. Progress reflects persisted backend work.</p><ol>{stages.map((stage, index) => <li className={index <= activeIndex ? "complete" : ""} key={stage}>{stage}</li>)}</ol>{run.coverage_limitations.length ? <Limitations items={run.coverage_limitations} /> : null}</section>;
}

function BriefSurface({ brief, onLedger, onFeedbackSaved }: { brief: IntelligenceBrief; onLedger: () => void; onFeedbackSaved: () => void }) {
  const noteworthy = [...brief.top_signals, ...brief.watch_items];
  return <div className="brief-layout">
    <main className="brief-main"><section className="summary-block"><p className="workspace-kicker">Executive summary</p><h2>{brief.executive_summary || "No seller-ready brief was produced."}</h2><CountStrip counts={brief.run.disposition_counts} onLedger={onLedger} /></section>
      {noteworthy.length ? <section className="signal-section"><div className="section-title"><div><p className="workspace-kicker">Noteworthy findings</p><h2>What deserves attention</h2></div><button className="text-action" onClick={onLedger}>View all evaluated signals</button></div>{noteworthy.map((signal) => <SignalFeature key={signal.id} signal={signal} runId={brief.run.id} onFeedbackSaved={onFeedbackSaved} />)}</section> : <TerminalEmptyState run={brief.run} />}
    </main>
    <aside className="brief-aside"><Limitations items={brief.unknowns_and_guardrails} title="Unknowns and guardrails" /><p className="feedback-note">Feedback is collected for evaluation. It does not automatically retrain or modify the system.</p></aside>
  </div>;
}

function SignalFeature({ signal, runId, onFeedbackSaved }: { signal: IntelligenceSignal; runId: string; onFeedbackSaved: () => void }) {
  return <article className="signal-feature"><div className="signal-label"><span className={`disposition ${signal.disposition}`}>{signal.disposition}</span><span>{signal.priority_tier} priority</span><span>{signal.verification_state}</span></div><h3>{signal.external_fact}</h3><div className="signal-columns"><div><p className="field-label">Why it may matter</p><p>{signal.red_hat_relevance_hypothesis || "No validation action recommended."}</p></div><div><p className="field-label">Validate next</p><p>{signal.validation_question || "No validation action recommended."}</p></div></div><details><summary>Inspect evidence and decision trace</summary><SignalAudit signal={signal} /></details><FeedbackEditor runId={runId} signal={signal} onSaved={onFeedbackSaved} /></article>;
}

function SignalLedgerView({ ledger, onBack, onFeedbackSaved }: { ledger: SignalLedger; onBack: () => void; onFeedbackSaved: () => void }) {
  const [disposition, setDisposition] = useState<SignalDisposition | "all">("all");
  const [priority, setPriority] = useState("all");
  const [verification, setVerification] = useState("all");
  const [source, setSource] = useState("");
  const [feedback, setFeedback] = useState<FeedbackVerdict | "all">("all");
  const signals = useMemo(() => ledger.signals.filter((signal) => (disposition === "all" || signal.disposition === disposition) && (priority === "all" || signal.priority_tier === priority) && (verification === "all" || signal.verification_state === verification) && (!source || `${signal.publisher} ${signal.source_url}`.toLowerCase().includes(source.toLowerCase())) && (feedback === "all" || signal.feedback.current?.verdict === feedback)), [ledger, disposition, priority, verification, source, feedback]);
  return <section className="ledger-surface"><header className="ledger-header"><div><p className="workspace-kicker">Complete evaluated-signal ledger</p><h1>{ledger.run.account.name}</h1><p>Search results and provider snippets remain outside this ledger until evaluated against acquired evidence.</p></div><button className="quiet-action" onClick={onBack}>Back to brief</button></header><div className="ledger-filters" aria-label="Signal filters"><label>Disposition<select value={disposition} onChange={(event) => setDisposition(event.target.value as SignalDisposition | "all")}><option value="all">All dispositions</option>{dispositionOrder.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label>Priority<select value={priority} onChange={(event) => setPriority(event.target.value)}><option value="all">All priorities</option><option value="high">High</option><option value="medium">Medium</option><option value="low">Low</option><option value="none">None</option></select></label><label>Verification<select value={verification} onChange={(event) => setVerification(event.target.value)}><option value="all">All verification</option><option value="supported">Supported</option><option value="insufficient">Insufficient</option><option value="contradicted">Contradicted</option></select></label><label>Source<input value={source} onChange={(event) => setSource(event.target.value)} placeholder="Publisher or URL" /></label><label>Feedback<select value={feedback} onChange={(event) => setFeedback(event.target.value as FeedbackVerdict | "all")}><option value="all">All feedback</option><option value="useful">Useful</option><option value="not_useful">Not useful</option><option value="unsure">Unsure</option></select></label></div><p className="ledger-count">Showing {signals.length} of {ledger.signals.length} evaluated candidates.</p><div className="ledger-list">{signals.map((signal) => <article className="ledger-row" key={signal.id}><div className="signal-label"><span className={`disposition ${signal.disposition}`}>{signal.disposition}</span><span>{signal.priority_tier}</span><span>{signal.verification_state}</span></div><h2>{signal.external_fact}</h2><p>{signal.disposition_rationale}</p><details><summary>Open complete audit</summary><SignalAudit signal={signal} /></details><FeedbackEditor runId={ledger.run.id} signal={signal} onSaved={onFeedbackSaved} /></article>)}</div></section>;
}

function SignalAudit({ signal }: { signal: IntelligenceSignal }) {
  return <div className="signal-audit"><div><p className="field-label">Account match basis</p><p>{signal.account_match_basis}</p></div><div><p className="field-label">Verification rationale</p><p>{signal.verification_rationale}</p></div><div><p className="field-label">Uncertainty</p><p>{signal.uncertainty}</p></div><div><p className="field-label">Evidence</p><p>{signal.excerpt}</p><a href={signal.source_url} target="_blank" rel="noreferrer">{signal.publisher} - source document</a><p className="audit-muted">Published {signal.publication_date ? formatDateTime(signal.publication_date) : "date unknown"}. Retrieved {formatDateTime(signal.retrieved_at)}. Evidence IDs: {signal.evidence_ids.join(", ")}.</p></div><div><p className="field-label">Discovery provenance</p>{signal.query_provenance.length ? <ul>{signal.query_provenance.map((item) => <li key={`${item.discovery_result_id}-${item.evidence_id}`}>{item.provider} {item.operation}, rank {item.rank_position}, query: {item.query}</li>)}</ul> : <p>Source was acquired without retained discovery-query provenance.</p>}<p className="audit-muted">Discovery metadata identifies how the source was found. It is not evidence.</p></div>{signal.feedback.history.length ? <div><p className="field-label">Feedback history</p><ol>{signal.feedback.history.map((item) => <li key={item.id}>Revision {item.revision}: {item.verdict} - {formatDateTime(item.created_at)}</li>)}</ol></div> : null}{signal.feedback.state === "legacy_unresolved" ? <p className="inline-error">Legacy feedback tags are retained but unresolved: {signal.feedback.legacy_tags.join(", ")}.</p> : null}</div>;
}

function FeedbackEditor({ runId, signal, onSaved }: { runId: string; signal: IntelligenceSignal; onSaved: () => void }) {
  const current = signal.feedback.current;
  const [open, setOpen] = useState(false);
  const [verdict, setVerdict] = useState<FeedbackVerdict>(current?.verdict || "useful");
  const [reasons, setReasons] = useState<FeedbackReason[]>(current?.reasons || []);
  const [explanation, setExplanation] = useState(current?.explanation || "");
  const [error, setError] = useState<string>();
  const [saving, setSaving] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setSaving(true); setError(undefined); try { await intelligenceApi.feedback(runId, signal.id, { verdict, reasons, explanation: explanation || undefined, expected_revision: current?.revision || 0 }); setOpen(false); onSaved(); } catch (saveError) { setError(saveError instanceof Error ? saveError.message : "Feedback could not be saved."); } finally { setSaving(false); } }
  if (!open) return <div className="feedback-summary"><span>{current ? `Current feedback: ${current.verdict.replaceAll("_", " ")}` : signal.feedback.state === "legacy_unresolved" ? "Legacy feedback needs review" : "No feedback yet"}</span><button className="text-action" onClick={() => setOpen(true)}>{current ? "Edit feedback" : "Add feedback"}</button></div>;
  return <form className="feedback-editor" onSubmit={submit}><fieldset><legend>Current verdict</legend>{(["useful", "not_useful", "unsure"] as FeedbackVerdict[]).map((item) => <label key={item}><input type="radio" checked={verdict === item} onChange={() => setVerdict(item)} />{item.replaceAll("_", " ")}</label>)}</fieldset><fieldset><legend>Optional reasons</legend>{feedbackReasons.map((reason) => <label key={reason.value}><input type="checkbox" checked={reasons.includes(reason.value)} onChange={() => setReasons((currentReasons) => currentReasons.includes(reason.value) ? currentReasons.filter((item) => item !== reason.value) : [...currentReasons, reason.value])} />{reason.label}</label>)}</fieldset><label>Explanation {verdict === "not_useful" ? "(required)" : "(optional)"}<textarea value={explanation} onChange={(event) => setExplanation(event.target.value)} required={verdict === "not_useful"} /></label>{error ? <p className="inline-error" role="alert">{error}</p> : null}<div><button className="quiet-action" type="button" onClick={() => setOpen(false)}>Cancel</button><button className="primary-action" disabled={saving}>{saving ? "Saving" : "Save feedback"}</button></div></form>;
}

function RunHistory({ runs, onOpen }: { runs: IntelligenceRun[]; onOpen: (id: string) => void }) { return <section className="runs-surface"><header><p className="workspace-kicker">Persisted research</p><h1>All runs</h1><p>Newest first. Reopen any completed, partial, or blocked run with its evaluated-signal ledger.</p></header>{runs.length ? <div className="run-list">{runs.map((run) => <button className="run-list-row" key={run.id} onClick={() => onOpen(run.id)}><span className="run-state">{labelState(run.state)}</span><span><strong>{run.account.name}</strong><small>{run.focus || "Open-ended external change research"}</small></span><span>{labelTimeframe(run.timeframe)}<small>{formatDateTime(run.updated_at)}</small></span><span className="run-counts">{countLabel(run.disposition_counts)}</span></button>)}</div> : <Empty title="No persisted research runs" detail="Start research for an account to create the first durable brief." />}</section>; }
function CountStrip({ counts, onLedger }: { counts: Record<SignalDisposition, number>; onLedger: () => void }) { return <div className="count-strip">{dispositionOrder.map((item) => <div key={item}><strong>{counts[item] || 0}</strong><span>{item}</span></div>)}<button className="text-action" onClick={onLedger}>View all evaluated signals</button></div>; }
function Limitations({ items, title = "Coverage and guardrails" }: { items: string[]; title?: string }) { return <section className="limitations"><p className="field-label">{title}</p>{items.length ? <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul> : <p>No additional limitations were recorded.</p>}</section>; }
function TerminalEmptyState({ run }: { run: IntelligenceRun }) { const blocked = run.state === "blocked" || run.state === "failed"; return <Empty title={blocked ? "Research did not produce a brief" : run.state === "abstained" ? "No signal met the evidence threshold" : "A brief is not available"} detail={run.blocked_reason || "The completed run retained its trace and limitations. No unsupported conclusion is shown."} />; }
function Empty({ title, detail }: { title: string; detail: string }) { return <section className="empty-research-state"><h2>{title}</h2><p>{detail}</p></section>; }
function labelState(state: string) { return state.replaceAll("_", " "); }
function labelTimeframe(timeframe: string) { return timeframe === "all" ? "No date preference" : `Last ${timeframe}`; }
function countLabel(counts: Record<SignalDisposition, number>) { return `${counts.keep || 0} keep, ${counts.watch || 0} watch, ${counts.reject || 0} reject, ${counts.abstain || 0} abstain`; }
