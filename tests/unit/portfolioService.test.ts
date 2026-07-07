import { describe, expect, it } from "vitest";
import { createLocalFixtureProviders } from "../../src/providers/localFixtureProviders";
import { AccountService } from "../../src/services/accountService";
import { PortfolioService } from "../../src/services/portfolioService";
import { RankingService } from "../../src/services/rankingService";

describe("portfolio and account services", () => {
  const providers = createLocalFixtureProviders();
  const portfolioService = new PortfolioService(providers, new RankingService());
  const accountService = new AccountService(providers);

  it("filters mapped accounts by selected hierarchy scope and descendants", () => {
    const portfolio = portfolioService.getPortfolio("region-east");

    expect(portfolio.accounts.map((account) => account.account.id)).toEqual([
      "acct-nova-bank",
      "acct-pioneer-utilities",
      "acct-metro-transit",
      "acct-cascade-health",
      "acct-lakeview-insurance",
      "acct-urban-college",
    ]);
  });

  it("surfaces incomplete mapping language without claiming ownership", () => {
    const portfolio = portfolioService.getPortfolio("region-east");
    const cascade = portfolio.accounts.find(
      (account) => account.account.id === "acct-cascade-health",
    );

    expect(portfolio.hasIncompleteMapping).toBe(true);
    expect(cascade?.mappingLabel).toBe("Mapped accounts only.");
    expect(cascade?.mappingDetail).toContain("Coverage may be incomplete");
  });

  it("supports accounts with no qualifying signals", () => {
    const detail = accountService.getAccountDetail("acct-urban-college");

    expect(detail?.pulse.qualifyingCount).toBe(0);
    expect(detail?.pulse.summary).toBe(
      "No qualifying fixture signals are loaded for this account.",
    );
  });

  it("separates external fact, relevance hypothesis, and validation action", () => {
    const detail = accountService.getAccountDetail("acct-nova-bank");
    const signal = detail?.prioritizedSignals[0];

    expect(signal?.event.externalFact).toContain("announced");
    expect(signal?.evaluation.generalRedHatRelevance).toContain("may be worth validating");
    expect(signal?.evaluation.validationAction).toContain("Validate");
  });
});
