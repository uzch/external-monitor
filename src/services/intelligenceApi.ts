export type IntelligenceRunState =
  | "queued"
  | "planning"
  | "discovering"
  | "acquiring"
  | "analyzing"
  | "synthesizing"
  | "completed"
  | "partial"
  | "abstained"
  | "blocked"
  | "failed"
  | "cancelled";

export interface IntelligenceRun {
  id: string;
  state: IntelligenceRunState;
  account: { name: string; aliases: string[]; context?: string };
  focus?: string;
  timeframe: string;
  created_at: string;
  updated_at: string;
  coverage_limitations: string[];
  blocked_reason?: string;
}

export interface IntelligenceSignal {
  id: string;
  external_fact: string;
  excerpt: string;
  source_url: string;
  publisher: string;
  publication_date?: string;
  retrieved_at: string;
  disposition: "keep" | "watch" | "reject" | "abstain";
  priority_tier: "high" | "medium" | "low" | "none";
  disposition_rationale: string;
  red_hat_relevance_hypothesis?: string;
  validation_question?: string;
  uncertainty: string;
  verification_state: string;
  evidence_ids: string[];
}

export interface IntelligenceBrief {
  run: IntelligenceRun;
  executive_summary?: string;
  top_signals: IntelligenceSignal[];
  watch_items: IntelligenceSignal[];
  rejected_items: IntelligenceSignal[];
  abstained_items: IntelligenceSignal[];
  unknowns_and_guardrails: string[];
}

const baseUrl = (import.meta as ImportMeta & {
  env?: { VITE_INTELLIGENCE_API_BASE_URL?: string };
}).env?.VITE_INTELLIGENCE_API_BASE_URL ?? "http://127.0.0.1:8000";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "Content-Type": "application/json", ...init?.headers },
  });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    const detail = typeof body.detail === "string" ? body.detail : body.detail?.message;
    throw new Error(detail || `Intelligence request failed with ${response.status}`);
  }
  return response.status === 204 ? (undefined as T) : response.json() as Promise<T>;
}

export const intelligenceApi = {
  capabilities: () => request<{ blockers: string[] }>("/v2/capabilities"),
  startRun: (input: { account: { name: string; aliases: string[]; context?: string }; focus?: string; timeframe: string }) =>
    request<IntelligenceRun>("/v2/research-runs", { method: "POST", body: JSON.stringify(input) }),
  run: (id: string) => request<IntelligenceRun>(`/v2/research-runs/${id}`),
  brief: (id: string) => request<IntelligenceBrief>(`/v2/research-runs/${id}/brief`),
  feedback: (runId: string, signalId: string, feedbackType: string, notes?: string) =>
    request<void>(`/v2/research-runs/${runId}/signals/${signalId}/feedback`, {
      method: "POST",
      body: JSON.stringify({ feedback_type: feedbackType, notes }),
    }),
  cancel: (id: string) => request<void>(`/v2/research-runs/${id}/cancel`, { method: "POST" }),
};
