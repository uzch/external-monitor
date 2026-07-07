import { DataValidationError } from "../domain/validation";
import { createLocalFixtureProviders } from "../providers/localFixtureProviders";
import { AccountService } from "./accountService";
import { PortfolioService } from "./portfolioService";
import { RankingService } from "./rankingService";

export interface ApplicationServices {
  accountService: AccountService;
  portfolioService: PortfolioService;
  rankingService: RankingService;
}

let services: ApplicationServices | undefined;
let serviceError: DataValidationError | Error | undefined;

export function getApplicationServices(): ApplicationServices {
  if (serviceError) {
    throw serviceError;
  }

  if (!services) {
    try {
      const providers = createLocalFixtureProviders();
      const rankingService = new RankingService();
      services = {
        rankingService,
        portfolioService: new PortfolioService(providers, rankingService),
        accountService: new AccountService(providers),
      };
    } catch (error) {
      serviceError = error instanceof Error ? error : new Error(String(error));
      throw serviceError;
    }
  }

  return services;
}
