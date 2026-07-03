import { AccountAssignment, MappingStatus } from "../domain/contracts";

const confidenceRank: Record<MappingStatus, number> = {
  illustrative: 0,
  partial_validated: 1,
  validated: 2,
};

export function lowestMappingStatus(assignments: AccountAssignment[]): MappingStatus {
  return assignments.reduce<MappingStatus>(
    (lowest, assignment) =>
      confidenceRank[assignment.mappingStatus] < confidenceRank[lowest]
        ? assignment.mappingStatus
        : lowest,
    "validated",
  );
}

export function mappingConfidenceLabel(status: MappingStatus): string {
  switch (status) {
    case "illustrative":
      return "Example mapping";
    case "partial_validated":
      return "Mapped accounts only.";
    case "validated":
      return "Validated loaded mapping";
  }
}

export function mappingStatusDetail(status: MappingStatus): string {
  switch (status) {
    case "illustrative":
      return "Displayed as an example mapping; it does not prove ownership or completeness.";
    case "partial_validated":
      return "Mapped accounts only. Coverage may be incomplete.";
    case "validated":
      return "Validated within the loaded fixture scope; no complete territory coverage claim is made.";
  }
}
