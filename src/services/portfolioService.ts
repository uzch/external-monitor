import {
  Account,
  AccountAssignment,
  ExternalEvent,
  HierarchyNode,
  MappingStatus,
  RelevanceEvaluation,
  SignalRecord,
} from "../domain/contracts";
import { FoundationProviders } from "../providers/providerTypes";
import {
  lowestMappingStatus,
  mappingConfidenceLabel,
  mappingStatusDetail,
} from "./mappingLabels";
import { RankingService } from "./rankingService";

export interface ScopeOption {
  id: string;
  label: string;
  level: string;
  pathLabel: string;
}

export interface RankedAccount {
  account: Account;
  assignments: AccountAssignment[];
  hierarchyPaths: string[];
  mappingStatus: MappingStatus;
  mappingLabel: string;
  mappingDetail: string;
  rankingScore: number;
  highestPriority: number;
  latestQualifyingEvent?: ExternalEvent;
  signalCount: number;
  qualifyingSignalCount: number;
}

export interface PortfolioViewModel {
  selectedScope: ScopeOption;
  scopeOptions: ScopeOption[];
  accounts: RankedAccount[];
  hasIncompleteMapping: boolean;
  emptyReason?: string;
}

export class PortfolioService {
  constructor(
    private readonly providers: FoundationProviders,
    private readonly rankingService: RankingService,
  ) {}

  getScopeOptions(): ScopeOption[] {
    return this.providers
      .hierarchyProvider
      .listHierarchyNodes()
      .map((node) => ({
        id: node.id,
        label: node.label,
        level: node.level,
        pathLabel: node.path.join(" / "),
      }));
  }

  getDefaultScopeId(): string {
    return this.getScopeOptions()[0]?.id ?? "";
  }

  getPortfolio(scopeId: string): PortfolioViewModel {
    const hierarchyNodes = this.providers.hierarchyProvider.listHierarchyNodes();
    const selectedNode = hierarchyNodes.find((node) => node.id === scopeId) ?? hierarchyNodes[0];

    if (!selectedNode) {
      return {
        selectedScope: { id: "", label: "No scopes", level: "", pathLabel: "" },
        scopeOptions: [],
        accounts: [],
        hasIncompleteMapping: false,
        emptyReason: "No hierarchy scopes are loaded.",
      };
    }

    const descendantIds = this.findDescendantIds(selectedNode.id, hierarchyNodes);
    const assignmentsInScope = this.providers
      .accountProvider
      .listAssignments()
      .filter((assignment) => descendantIds.has(assignment.hierarchyNodeId));

    const accounts = this.providers.accountProvider.listAccounts();
    const events = this.providers.eventProvider.listEvents();
    const evaluations = this.providers.relevanceEvaluationProvider.listEvaluations();

    const rankedAccounts = accounts
      .map((account) => {
        const assignments = assignmentsInScope.filter(
          (assignment) => assignment.accountId === account.id,
        );

        if (assignments.length === 0) {
          return undefined;
        }

        return this.buildRankedAccount(
          account,
          assignments,
          hierarchyNodes,
          events,
          evaluations,
        );
      })
      .filter((account): account is RankedAccount => Boolean(account))
      .sort(compareRankedAccounts);

    return {
      selectedScope: toScopeOption(selectedNode),
      scopeOptions: this.getScopeOptions(),
      accounts: rankedAccounts,
      hasIncompleteMapping: rankedAccounts.some(
        (rankedAccount) => rankedAccount.mappingStatus !== "validated",
      ),
      emptyReason:
        rankedAccounts.length === 0 ? "No mapped accounts are loaded for this scope." : undefined,
    };
  }

  private buildRankedAccount(
    account: Account,
    assignments: AccountAssignment[],
    hierarchyNodes: HierarchyNode[],
    events: ExternalEvent[],
    evaluations: RelevanceEvaluation[],
  ): RankedAccount {
    const signals = buildSignals(account.id, events, evaluations);
    const ranking = this.rankingService.rankSignals(signals);
    const latestQualifyingEvent = ranking.latestQualifyingPublicationDate
      ? signals.find(
          (signal) => signal.event.publicationDate === ranking.latestQualifyingPublicationDate,
        )?.event
      : undefined;
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
      rankingScore: ranking.score,
      highestPriority: ranking.highestPriority,
      latestQualifyingEvent,
      signalCount: signals.length,
      qualifyingSignalCount: ranking.qualifyingSignalCount,
    };
  }

  private findDescendantIds(scopeId: string, nodes: HierarchyNode[]): Set<string> {
    const descendants = new Set<string>([scopeId]);
    let changed = true;

    while (changed) {
      changed = false;
      for (const node of nodes) {
        if (node.parentId && descendants.has(node.parentId) && !descendants.has(node.id)) {
          descendants.add(node.id);
          changed = true;
        }
      }
    }

    return descendants;
  }
}

export function buildSignals(
  accountId: string,
  events: ExternalEvent[],
  evaluations: RelevanceEvaluation[],
): SignalRecord[] {
  return events
    .filter((event) => event.accountId === accountId)
    .map((event) => {
      const evaluation = evaluations.find((candidate) => candidate.eventId === event.id);

      if (!evaluation) {
        throw new Error(`Missing evaluation for event ${event.id}`);
      }

      return { event, evaluation };
    })
    .sort((left, right) => {
      if (left.evaluation.disposition !== right.evaluation.disposition) {
        return dispositionSortOrder(left.evaluation.disposition) -
          dispositionSortOrder(right.evaluation.disposition);
      }

      return Date.parse(right.event.publicationDate) - Date.parse(left.event.publicationDate);
    });
}

function compareRankedAccounts(left: RankedAccount, right: RankedAccount): number {
  if (right.rankingScore !== left.rankingScore) {
    return right.rankingScore - left.rankingScore;
  }

  const rightDate = right.latestQualifyingEvent
    ? Date.parse(right.latestQualifyingEvent.publicationDate)
    : 0;
  const leftDate = left.latestQualifyingEvent
    ? Date.parse(left.latestQualifyingEvent.publicationDate)
    : 0;

  if (rightDate !== leftDate) {
    return rightDate - leftDate;
  }

  const nameComparison = left.account.name.localeCompare(right.account.name);
  return nameComparison !== 0 ? nameComparison : left.account.id.localeCompare(right.account.id);
}

function dispositionSortOrder(disposition: RelevanceEvaluation["disposition"]): number {
  switch (disposition) {
    case "prioritized":
      return 0;
    case "monitor":
      return 1;
    case "context":
      return 2;
    case "duplicate":
      return 3;
    case "excluded":
      return 4;
  }
}

function toScopeOption(node: HierarchyNode): ScopeOption {
  return {
    id: node.id,
    label: node.label,
    level: node.level,
    pathLabel: node.path.join(" / "),
  };
}
