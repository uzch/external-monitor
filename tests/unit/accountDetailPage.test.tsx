import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AccountDetailPage } from "../../src/ui/AccountDetailPage";
import { connectedApi } from "../../src/services/connectedApi";

vi.mock("../../src/services/connectedApi", () => ({
  connectedApi: {
    accountDetail: vi.fn(),
  },
}));

const mockedApi = vi.mocked(connectedApi);

describe("AccountDetailPage", () => {
  beforeEach(() => {
    mockedApi.accountDetail.mockReset();
  });

  it("shows API errors on a direct account route", async () => {
    mockedApi.accountDetail.mockRejectedValue(new Error("Account not found"));

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
