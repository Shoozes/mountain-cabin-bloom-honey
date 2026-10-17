export type DonorExampleStatus = "source-only" | "partial";

export interface DonorExample {
  id: string;
  title: string;
  summary: string;
  sourcePath: `examples/${string}`;
  sourceCommit: "34016ee";
  sourceUrl: string;
  releaseTier: "tier1" | "tier2" | "tier3" | "tier4";
  primaryGroup: string;
  tags: string[];
  backends: string[];
  provenance: string;
  migration: DonorExampleStatus;
  localExampleId?: string;
}

export interface ArtWorkbenchExample {
  id: string;
  title: string;
  summary: string;
  workflow: string;
  backends: string[];
  tags: string[];
  provenance: string;
  migration: "migrated";
  donorSources: string[];
}

export const GROUT_LIBRARY_COMMIT: "34016ee";
export const GROUT_LIBRARY_EXAMPLE_GROUPS: Array<{
  id: string;
  title: string;
  description: string;
}>;
export const GROUT_LIBRARY_EXAMPLES: DonorExample[];
export const ART_WORKBENCH_EXAMPLES: ArtWorkbenchExample[];
export function getWorkbenchExample(id: string | null | undefined): ArtWorkbenchExample | undefined;
