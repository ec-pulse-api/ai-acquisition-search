import type { AcquisitionTarget } from "./types";

export const acquisitionTargets: AcquisitionTarget[] = [
  {
    id: "ai-customer-support-copilot",
    name: "AI Customer Support Copilot",
    category: "SaaS / AI",
    model: "B2B SaaS",
    summary: "問い合わせ対応を自動化し、導入企業の運用データを蓄積するB2B SaaS。",
    description: "Support teams use an AI-assisted workspace to draft, classify, and route customer conversations.",
    signals: ["Recurring revenue", "AI workflow", "B2B"],
    stage: "Seed",
    score: 92,
    revenueProfile: "Subscription-led recurring revenue",
    growthProfile: "Expansion potential through team adoption",
    aiOpportunity: "Automated support workflows, knowledge retrieval, and agent analytics",
    acquisitionRationale: [
      "Recurring workflow creates a natural retention surface.",
      "Operational data can support differentiated AI features.",
      "Clear path from single-team use to wider organization adoption.",
    ],
    risks: [
      "AI quality and support accuracy need validation.",
      "Enterprise expansion may increase sales-cycle length.",
    ],
    sourceType: "sample",
  },
  {
    id: "vertical-video-commerce",
    name: "Vertical Video Commerce",
    category: "Commerce / Creator",
    model: "B2B2C platform",
    summary: "短尺動画から商品発見・比較・購入までをつなぐコマース基盤。",
    description: "A creator-oriented commerce workflow connects short-form product discovery with conversion tracking.",
    signals: ["Creator economy", "Commerce", "Growth"],
    stage: "Series A",
    score: 88,
    revenueProfile: "Platform and commerce-linked revenue",
    growthProfile: "Creator and merchant network effects",
    aiOpportunity: "Creative generation, product matching, and conversion optimization",
    acquisitionRationale: [
      "Creator distribution can provide a scalable acquisition channel.",
      "Commerce events create measurable feedback for optimization.",
      "AI can connect creative production with conversion signals.",
    ],
    risks: [
      "Platform dependency can change economics quickly.",
      "Attribution quality is critical to proving value.",
    ],
    sourceType: "sample",
  },
  {
    id: "developer-ai-analytics",
    name: "Developer AI Analytics",
    category: "DevTools",
    model: "B2B SaaS",
    summary: "AI開発ツールの利用状況とチーム生産性を可視化する分析プロダクト。",
    description: "Engineering leaders use product analytics to understand AI coding-tool adoption and team usage.",
    signals: ["Developer tools", "Usage data", "Enterprise"],
    stage: "Series A",
    score: 84,
    revenueProfile: "Per-seat or usage-based subscription",
    growthProfile: "Department expansion and enterprise plans",
    aiOpportunity: "Usage anomaly detection, workflow recommendations, and engineering intelligence",
    acquisitionRationale: [
      "Developer workflows generate structured usage signals.",
      "Analytics can become a control layer across multiple AI tools.",
      "Enterprise reporting creates a clear expansion surface.",
    ],
    risks: [
      "Crowded developer-tooling market.",
      "Privacy and data-access requirements may constrain integrations.",
    ],
    sourceType: "sample",
  },
];

export function searchTargets(filters: { query?: string; category?: string; model?: string; minScore?: number } = {}) {
  const q = filters.query?.trim().toLowerCase();
  return acquisitionTargets.filter((target) => {
    const haystack = [
      target.name,
      target.category,
      target.model,
      target.summary,
      target.description,
      target.revenueProfile,
      target.growthProfile,
      target.aiOpportunity,
      ...target.signals,
    ].join(" ").toLowerCase();

    if (q && !haystack.includes(q)) return false;
    if (filters.category && target.category !== filters.category) return false;
    if (filters.model && target.model !== filters.model) return false;
    if (typeof filters.minScore === "number" && target.score < filters.minScore) return false;
    return true;
  });
}
