import {
  Account,
  AccountAssignment,
  ExternalEvent,
  MappingStatus,
  SignalRecord,
} from "../domain/contracts";
import { FoundationProviders } from "../providers/providerTypes";
import {
  lowestMappingStatus,
  mappingConfidenceLabel,
  mappingStatusDetail,
} from "./mappingLabels";
import { buildSignals } from "./portfolioService";

export interface AccountPulse {
  prioritizedCount: number;
  qualifyingCount: number;
  latestQualifyingEvent?: ExternalEvent;
  suggestedValidationAction?: string;
  summary: string;
}

export interface AccountDetailViewModel {
  account: Account;
  assignments: AccountAssignment[];
  hierarchyPaths: string[];
  mappingStatus: MappingStatus;
  mappingLabel: string;
  mappingDetail: string;
  pulse: AccountPulse;
  prioritizedSignals: SignalRecord[];
  lowerPrioritySignals: SignalRecord[];
}

export class AccountService {
  constructor(private readonly providers: FoundationProviders) {}

  getAccountDetail(accountId: string): AccountDetailViewModel | undefined {
    const account = this.providers
      .accountProvider
      .listAccounts()
      .find((candidate) => candidate.id === accountId);

    if (!account) {
      return undefined;
    }

    const assignments = this.providers
      .accountProvider
      .listAssignments()
      .filter((assignment) => assignment.accountId === accountId);
    const hierarchyNodes = this.providers.hierarchyProvider.listHierarchyNodes();
    const signals = buildSignals(
      accountId,
      this.providers.eventProvider.listEvents(),
      this.providers.relevanceEvaluationProvider.listEvaluations(),
    );
    const mappingStatus = lowestMappingStatus(assignments);

    return {
      account,
      assignments,
      hierarchyPaths: assignments.map((assignment) => {
        const node = hierarchyNodes.find(
          (hierarchyNode) => hierarchyNode.id === assignment.hierarchyNodeId,
        );
        return node?.path.join(" / ") ?? assignment.hierarchyNodeId;
      }),
      mappingStatus,
      mappingLabel: mappingConfidenceLabel(mappingStatus),
      mappingDetail: mappingStatusDetail(mappingStatus),
      pulse: this.buildPulse(signals),
      prioritizedSignals: signals.filter(
        (signal) => signal.evaluation.disposition === "prioritized",
      ),
      lowerPrioritySignals: signals.filter(
        (signal) => signal.evaluation.disposition !== "prioritized",
      ),
    };
  }

  private buildPulse(signals: SignalRecord[]): AccountPulse {
    const qualifyingSignals = signals.filter((signal) =>
      ["prioritized", "monitor", "context"].includes(signal.evaluation.disposition),
    );
    const prioritizedSignals = signals.filter(
      (signal) => signal.evaluation.disposition === "prioritized",
    );
    const latestQualifyingEvent = qualifyingSignals
      .map((signal) => signal.event)
      .sort((left, right) => Date.parse(right.publicationDate) - Date.parse(left.publicationDate))[0];
    const suggestedValidationAction = prioritizedSignals[0]?.evaluation.validationAction ??
      qualifyingSignals[0]?.evaluation.validationAction;

    return {
      prioritizedCount: prioritizedSignals.length,
      qualifyingCount: qualifyingSignals.length,
      latestQualifyingEvent,
      suggestedValidationAction,
      summary:
        qualifyingSignals.length > 0
          ? `${qualifyingSignals.length} qualifying fixture signal${
              qualifyingSignals.length === 1 ? "" : "s"
            }; ${prioritizedSignals.length} prioritized.`
          : "No qualifying fixture signals are loaded for this account.",
    };
  }
}
