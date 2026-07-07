import accounts from "../../fixtures/accounts.json";
import accountAssignments from "../../fixtures/account-assignments.json";
import externalEvents from "../../fixtures/external-events.json";
import hierarchyNodes from "../../fixtures/hierarchy-nodes.json";
import redHatCapabilities from "../../fixtures/red-hat-capabilities.json";
import relevanceEvaluations from "../../fixtures/relevance-evaluations.json";
import { FixtureDataset } from "../domain/contracts";
import { parseFixtureDataset } from "../domain/validation";
import {
  AccountProvider,
  CapabilityProvider,
  EventProvider,
  FoundationProviders,
  HierarchyProvider,
  RelevanceEvaluationProvider,
} from "./providerTypes";

export class LocalFixtureStore
  implements
    HierarchyProvider,
    AccountProvider,
    EventProvider,
    CapabilityProvider,
    RelevanceEvaluationProvider
{
  private readonly dataset: FixtureDataset;

  constructor() {
    this.dataset = parseFixtureDataset({
      hierarchyNodes,
      accounts,
      accountAssignments,
      externalEvents,
      relevanceEvaluations,
      redHatCapabilities,
    });
  }

  listHierarchyNodes() {
    return this.dataset.hierarchyNodes;
  }

  listAccounts() {
    return this.dataset.accounts;
  }

  listAssignments() {
    return this.dataset.accountAssignments;
  }

  listEvents() {
    return this.dataset.externalEvents;
  }

  listCapabilities() {
    return this.dataset.redHatCapabilities;
  }

  listEvaluations() {
    return this.dataset.relevanceEvaluations;
  }
}

export function createLocalFixtureProviders(): FoundationProviders {
  const store = new LocalFixtureStore();

  return {
    hierarchyProvider: store,
    accountProvider: store,
    eventProvider: store,
    capabilityProvider: store,
    relevanceEvaluationProvider: store,
  };
}
