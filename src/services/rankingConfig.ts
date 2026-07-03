import { Disposition } from "../domain/contracts";

export interface RankingConfig {
  dispositionWeights: Record<Disposition, number>;
  factorWeights: Record<string, number>;
  additionalQualifyingSignalWeight: number;
  maxAdditionalQualifyingSignals: number;
}

export const defaultRankingConfig: RankingConfig = {
  dispositionWeights: {
    prioritized: 100,
    monitor: 45,
    context: 10,
    duplicate: 0,
    excluded: 0,
  },
  factorWeights: {
    evidenceStrength: 2,
    relevanceStrength: 3,
    recency: 1,
  },
  additionalQualifyingSignalWeight: 5,
  maxAdditionalQualifyingSignals: 3,
};

export const rankingRuleSummary =
  "Account ranking uses only fixture evidence and fixture relevance evaluations. " +
  "Each non-duplicate, non-excluded signal contributes disposition weight + priorityScore + configured factor weights. " +
  "The account score is the highest qualifying signal plus a capped boost for additional qualifying signals. " +
  "Ties sort by latest qualifying publication date, then account name, then account id.";
