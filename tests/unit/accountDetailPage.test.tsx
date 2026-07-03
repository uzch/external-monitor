import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DataValidationError } from "../../src/domain/validation";
import { AccountDetailPage } from "../../src/ui/AccountDetailPage";
import { getApplicationServices } from "../../src/services/applicationServices";

vi.mock("../../src/services/applicationServices", () => ({
  getApplicationServices: vi.fn(),
}));

const mockedGetApplicationServices = vi.mocked(getApplicationServices);

describe("AccountDetailPage", () => {
  beforeEach(() => {
    mockedGetApplicationServices.mockReset();
  });

  it("shows invalid fixture data state when services fail on a direct account route", () => {
    mockedGetApplicationServices.mockImplementation(() => {
      throw new DataValidationError(["Evaluation eval-1 rationale contains prohibited overclaim"]);
    });

    render(
      <MemoryRouter initialEntries={["/accounts/acct-nova-bank?scope=region-east"]}>
        <Routes>
          <Route path="/accounts/:accountId" element={<AccountDetailPage />} />
        </Routes>
      </MemoryRouter>,
    );

    expect(screen.getByRole("alert")).toHaveTextContent("Invalid fixture data");
    expect(screen.getByRole("alert")).toHaveTextContent(
      "Evaluation eval-1 rationale contains prohibited overclaim",
    );
  });
});
