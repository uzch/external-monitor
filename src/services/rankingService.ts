import { RelevanceEvaluation, SignalRecord } from "../domain/contracts";
import { defaultRankingConfig, RankingConfig } from "./rankingConfig";

const rankingEligibleDispositions = new Set(["prioritized", "monitor", "context"]);

export interface AccountRankingResult {
  score: number;
  highestPriority: number;
  latestQualifyingPublicationDate?: string;
  qualifyingSignalCount: number;
}

export class RankingService {
  constructor(private readonly config: RankingConfig = defaultRankingConfig) {}

  rankSignals(signals: SignalRecord[]): AccountRankingResult {
    const qualifyingSignals = signals.filter((signal) =>
      rankingEligibleDispositions.has(signal.evaluation.disposition),
    );

    const scoredSignals = qualifyingSignals
      .map((signal) => ({
        signal,
        score: this.scoreEvaluation(signal.evaluation),
      }))
      .sort((left, right) => {
        if (right.score !== left.score) {
          return right.score - left.score;
        }

        return (
          Date.parse(right.signal.event.publicationDate) -
          Date.parse(left.signal.event.publicationDate)
        );
      });

    const topSignal = scoredSignals[0];
    const extraSignalCount = Math.min(
      Math.max(scoredSignals.length - 1, 0),
      this.config.maxAdditionalQualifyingSignals,
    );
    const latestQualifyingPublicationDate = qualifyingSignals
      .map((signal) => signal.event.publicationDate)
      .sort((left, right) => Date.parse(right) - Date.parse(left))[0];

    return {
      score: topSignal
        ? topSignal.score + extraSignalCount * this.config.additionalQualifyingSignalWeight
        : 0,
      highestPriority: Math.max(
        0,
        ...qualifyingSignals.map((signal) => signal.evaluation.priorityScore),
      ),
      latestQualifyingPublicationDate,
      qualifyingSignalCount: qualifyingSignals.length,
    };
  }

  scoreEvaluation(evaluation: RelevanceEvaluation): number {
    const dispositionWeight = this.config.dispositionWeights[evaluation.disposition];
    const factorContribution = Object.entries(this.config.factorWeights).reduce(
      (total, [factorName, weight]) =>
        total + (evaluation.factorScores[factorName] ?? 0) * weight,
      0,
    );

    return dispositionWeight + evaluation.priorityScore + factorContribution;
  }
}
