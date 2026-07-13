import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDetailPage } from "../../src/ui/AccountDetailPage";
import { connectedApi } from "../../src/services/connectedApi";

vi.mock("../../src/services/connectedApi", () => ({
  connectedApi: {
    accountDetail: vi.fn(),
    accountSignalBrief: vi.fn(),
    researchCapabilities: vi.fn(),
  },
}));

const mockedApi = vi.mocked(connectedApi);

describe("AccountDetailPage", () => {
  beforeEach(() => {
    mockedApi.accountDetail.mockReset();
    mockedApi.accountSignalBrief.mockReset();
    mockedApi.researchCapabilities.mockReset();
  });

  it("shows API errors on a direct account route", async () => {
    mockedApi.accountDetail.mockRejectedValue(new Error("Account not found"));
    mockedApi.researchCapabilities.mockResolvedValue({
      reasoning: { available: false, provider: "maas", message: "MaaS is not configured." },
      retrieval: { available: true, provider: "application_controlled", message: "Retrieval is ready." },
      liveSearch: { available: false, message: "Search is not configured." },
    });

    render(
      <MemoryRouter initialEntries={["/accounts/acct-missing"]}>
        <Routes>
          <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.getByRole("alert")).toBeVisible());
    expect(screen.getByRole("alert")).toHaveTextContent("Connected Monitor v1 cannot load this view");
    expect(screen.getByRole("alert")).toHaveTextContent("Account not found");
  });
});
