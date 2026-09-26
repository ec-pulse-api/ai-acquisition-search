import type { AcquisitionTarget } from "./types";

export type AcquisitionSource = "sample" | "manual" | "import";

export type AcquisitionRecord = AcquisitionTarget & {
  source: AcquisitionSource;
  sourceUrl?: string;
  discoveredAt: string;
  lastVerifiedAt?: string;
};

export function toAcquisitionRecord(target: AcquisitionTarget): AcquisitionRecord {
  return {
    ...target,
    source: target.sourceType,
    discoveredAt: new Date().toISOString(),
  };
}

export function normalizeImportedTarget(input: Partial<AcquisitionTarget>): AcquisitionTarget {
  if (!input.name?.trim()) throw new Error("Target name is required");

  return {
    id: input.id?.trim() || slugify(input.name),
    name: input.name.trim(),
    category: input.category?.trim() || "Uncategorized",
    model: input.model?.trim() || "Unknown",
    summary: input.summary?.trim() || "Imported acquisition target.",
    description: input.description?.trim() || "",
    signals: input.signals?.filter(Boolean) ?? [],
    stage: input.stage?.trim() || "Unknown",
    score: clampScore(input.score ?? 0),
    revenueProfile: input.revenueProfile?.trim() || "Not verified",
    growthProfile: input.growthProfile?.trim() || "Not verified",
    aiOpportunity: input.aiOpportunity?.trim() || "Not analyzed",
    acquisitionRationale: input.acquisitionRationale?.filter(Boolean) ?? [],
    risks: input.risks?.filter(Boolean) ?? ["Due diligence required"],
    sourceType: "import",
  };
}

function slugify(value: string) {
  return value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

function clampScore(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}
