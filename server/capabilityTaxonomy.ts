export interface CapabilityTaxonomyEntry {
  id: string;
  name: string;
  description: string;
}

export const approvedCapabilityTaxonomy: CapabilityTaxonomyEntry[] = [
  {
    id: "hybrid-cloud-platform",
    name: "Hybrid cloud platform",
    description: "Platform standardization, workload portability, and operational consistency themes.",
  },
  {
    id: "automation",
    name: "Automation",
    description: "IT automation, infrastructure operations, and repeatable workflow themes.",
  },
  {
    id: "application-platform",
    name: "Application platform",
    description: "Modern application delivery, containers, and developer platform themes.",
  },
  {
    id: "security-compliance",
    name: "Security and compliance",
    description: "Security operations, compliance, and regulated workload themes.",
  },
  {
    id: "edge-infrastructure",
    name: "Edge infrastructure",
    description: "Distributed infrastructure, edge operations, and remote-site management themes.",
  },
];

export const approvedCapabilityIds = new Set(approvedCapabilityTaxonomy.map((entry) => entry.id));
