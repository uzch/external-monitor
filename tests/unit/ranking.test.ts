import { describe, expect, it } from "vitest";
import { createLocalFixtureProviders } from "../../src/providers/localFixtureProviders";
import { PortfolioService } from "../../src/services/portfolioService";
import { defaultRankingConfig } from "../../src/services/rankingConfig";
import { RankingService } from "../../src/services/rankingService";

describe("fixture-mode ranking", () => {
  it("uses deterministic ranking based on configured evidence and relevance fields", () => {
    const providers = createLocalFixtureProviders();
    const portfolioService = new PortfolioService(providers, new RankingService());
    const portfolio = portfolioService.getPortfolio("geo-na");

    expect(portfolio.accounts[0].account.name).toBe("Nova Bank");
    expect(portfolio.accounts[0].rankingScore).toBe(221);
    expect(portfolio.accounts.map((account) => account.account.id)).toEqual(
      [...portfolio.accounts.map((account) => account.account.id)].sort((left, right) => {
        const leftAccount = portfolio.accounts.find((account) => account.account.id === left)!;
        const rightAccount = portfolio.accounts.find((account) => account.account.id === right)!;

        if (rightAccount.rankingScore !== leftAccount.rankingScore) {
          return rightAccount.rankingScore - leftAccount.rankingScore;
        }

        return leftAccount.account.name.localeCompare(rightAccount.account.name);
      }),
    );
  });

  it("keeps duplicate and excluded signals out of ranking contribution", () => {
    const rankingService = new RankingService(defaultRankingConfig);
    const providers = createLocalFixtureProviders();
    const portfolioService = new PortfolioService(providers, rankingService);
    const portfolio = portfolioService.getPortfolio("pod-west-commercial");
    const summit = portfolio.accounts.find(
      (rankedAccount) => rankedAccount.account.id === "acct-summit-retail",
    );
    const silverline = portfolio.accounts.find(
      (rankedAccount) => rankedAccount.account.id === "acct-silverline-media",
    );

    expect(summit?.signalCount).toBe(2);
    expect(summit?.qualifyingSignalCount).toBe(1);
    expect(silverline?.rankingScore).toBe(0);
  });
});
