import {
  Account,
  AccountAssignment,
  ExternalEvent,
  HierarchyNode,
  RedHatCapability,
  RelevanceEvaluation,
} from "../domain/contracts";

export interface HierarchyProvider {
  listHierarchyNodes(): HierarchyNode[];
}

export interface AccountProvider {
  listAccounts(): Account[];
  listAssignments(): AccountAssignment[];
}

export interface EventProvider {
  listEvents(): ExternalEvent[];
}

export interface CapabilityProvider {
  listCapabilities(): RedHatCapability[];
}

export interface RelevanceEvaluationProvider {
  listEvaluations(): RelevanceEvaluation[];
}

export interface FoundationProviders {
  hierarchyProvider: HierarchyProvider;
  accountProvider: AccountProvider;
  eventProvider: EventProvider;
  capabilityProvider: CapabilityProvider;
  relevanceEvaluationProvider: RelevanceEvaluationProvider;
}
