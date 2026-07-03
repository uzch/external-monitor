import { describe, expect, it } from "vitest";
import accounts from "../../fixtures/accounts.json";
import accountAssignments from "../../fixtures/account-assignments.json";
import externalEvents from "../../fixtures/external-events.json";
import hierarchyNodes from "../../fixtures/hierarchy-nodes.json";
import redHatCapabilities from "../../fixtures/red-hat-capabilities.json";
import relevanceEvaluations from "../../fixtures/relevance-evaluations.json";
import {
  containsProhibitedIntentClaim,
  DataValidationError,
  parseFixtureDataset,
} from "../../src/domain/validation";

const validDataset = {
  hierarchyNodes,
  accounts,
  accountAssignments,
  externalEvents,
  relevanceEvaluations,
  redHatCapabilities,
};

describe("fixture validation", () => {
  it("accepts the synthetic Foundation v0 fixtures", () => {
    const dataset = parseFixtureDataset(validDataset);

    expect(dataset.accounts).toHaveLength(12);
    expect(dataset.externalEvents.length).toBeGreaterThan(10);
  });

  it("requires source URLs and source evidence fields on visible events", () => {
    const invalid = structuredClone(validDataset);
    invalid.externalEvents[0] = {
      ...invalid.externalEvents[0],
      sourceUrl: "",
    };

    expect(() => parseFixtureDataset(invalid)).toThrow(DataValidationError);
  });

  it("requires each event to have a relevance evaluation", () => {
    const invalid = {
      ...validDataset,
      relevanceEvaluations: relevanceEvaluations.slice(1),
    };

    expect(() => parseFixtureDataset(invalid)).toThrow(/has no relevance evaluation/);
  });

  it("flags prohibited intent and ownership claims", () => {
    expect(containsProhibitedIntentClaim("This proves demand for Red Hat.")).toBe(true);
    expect(
      containsProhibitedIntentClaim(
        "This may be worth validating for platform operations themes.",
      ),
    ).toBe(false);
  });

  it("flags prohibited claims in every visible evaluation text field", () => {
    const fields = [
      "generalRedHatRelevance",
      "accountSpecificRelevance",
      "validationAction",
      "rationale",
    ] as const;

    for (const field of fields) {
      const invalid = structuredClone(validDataset);
      invalid.relevanceEvaluations[0] = {
        ...invalid.relevanceEvaluations[0],
        [field]: "This proves product fit.",
      };

      expect(() => parseFixtureDataset(invalid), field).toThrow(
        new RegExp(`${field} contains prohibited overclaim`),
      );
    }
  });
});
