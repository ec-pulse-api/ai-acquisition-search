import type { AcquisitionTarget } from "./types";

export type AcquisitionAnalysis = {
  targetId: string;
  thesis: string;
  strengths: string[];
  risks: string[];
  diligenceQuestions: string[];
  aiOpportunities: string[];
};

export function buildAcquisitionAnalysis(target: AcquisitionTarget): AcquisitionAnalysis {
  const profitable = target.signals.some((signal) => signal.toLowerCase().includes("profitable"));
  const multipleSignal = target.signals.find((signal) => signal.includes("multiple"));

  return {
    targetId: target.id,
    thesis: profitable
      ? `This target has a preliminary acquisition thesis built around an existing profitable operating base. The next step is to verify the quality and durability of the reported earnings.`
      : "This target may warrant screening, but the available public data is insufficient to establish an acquisition thesis without further diligence.",
    strengths: [
      ...target.signals.slice(0, 3),
      target.revenueProfile,
      multipleSignal ?? "Valuation multiple unavailable",
    ],
    risks: target.risks,
    diligenceQuestions: [
      "Can the seller substantiate the reported revenue and net profit with source financial statements?",
      "What percentage of revenue comes from the largest customers, channels, or products?",
      "How dependent is the business on the current owner or a single acquisition channel?",
      "What has changed in revenue, profit, traffic, and retention over the most recent 12 months?",
      "What assets, liabilities, contracts, IP, and customer data are included in the transaction?",
    ],
    aiOpportunities: [
      "Automate repetitive customer-support and back-office workflows.",
      "Identify conversion, retention, or pricing opportunities from operating data.",
      "Use AI-assisted content, sales, or merchandising workflows where the business model permits.",
    ],
  };
}
