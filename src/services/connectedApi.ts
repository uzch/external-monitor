import {
  AccountDetailDto,
  CreateAccountRequest,
  CreateSourceRegistrationRequest,
  HealthDto,
  MonitorRun,
  MonitoredAccount,
  PortfolioDto,
  SourceRegistration,
  UpdateAccountRequest,
  UpdateSourceRegistrationRequest,
} from "../domain/connectedContracts";

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(path, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(typeof body.error === "string" ? body.error : `Request failed with ${response.status}`);
  }

  return response.json() as Promise<T>;
}

export const connectedApi = {
  health: () => request<HealthDto>("/api/health"),
  portfolio: () => request<PortfolioDto>("/api/portfolio"),
  accountDetail: (accountId: string) => request<AccountDetailDto>(`/api/accounts/${accountId}`),
  accounts: () => request<MonitoredAccount[]>("/api/accounts"),
  createAccount: (input: CreateAccountRequest) =>
    request<MonitoredAccount>("/api/accounts", { method: "POST", body: JSON.stringify(input) }),
  updateAccount: (id: string, input: UpdateAccountRequest) =>
    request<MonitoredAccount>(`/api/accounts/${id}`, { method: "PATCH", body: JSON.stringify(input) }),
  sourceRegistrations: (accountId?: string) =>
    request<SourceRegistration[]>(
      accountId ? `/api/source-registrations?accountId=${encodeURIComponent(accountId)}` : "/api/source-registrations",
    ),
  createSourceRegistration: (input: CreateSourceRegistrationRequest) =>
    request<SourceRegistration>("/api/source-registrations", {
      method: "POST",
      body: JSON.stringify(input),
    }),
  updateSourceRegistration: (id: string, input: UpdateSourceRegistrationRequest) =>
    request<SourceRegistration>(`/api/source-registrations/${id}`, {
      method: "PATCH",
      body: JSON.stringify(input),
    }),
  startMonitorRun: (accountId?: string) =>
    request<MonitorRun>("/api/monitor-runs", {
      method: "POST",
      body: JSON.stringify(accountId ? { accountId } : {}),
    }),
  monitorRuns: () => request<MonitorRun[]>("/api/monitor-runs"),
};
