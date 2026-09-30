export type CampaignTest = {
  id: string;
  concept: string;
  hook: string;
  channel: string;
  format: string;
  hypothesis: string;
  successMetric: string;
  score: number;
  components: {
    salesExpectation: number;
    learningEfficiency: number;
    evidenceConfidence: number;
    risk: number;
    differentiation: number;
  };
  rationale: string;
};

export type CampaignPerformance = {
  platform: string;
  postId: string;
  metrics: {
    views?: number | null;
    impressions?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    clicks?: number | null;
  };
};

export type NextCampaignDecision = {
  basedOn: string[];
  observed: string[];
  unknown: string[];
  nextTests: CampaignTest[];
  rationale: string;
  productionBrief: {
    objective: string;
    audience: string;
    angle: string;
    hook: string;
    format: string;
    cta: string;
  } | null;
};

function num(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function text(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function evidenceConfidence(analysis: {
  searchEvidence?: Array<unknown>;
  evidenceTensions?: Array<{ status?: string }>;
}) {
  const evidence = analysis.searchEvidence ?? [];
  if (!evidence.length) return 25;
  const typed = evidence as Array<Record<string, unknown>>;
  const strong = typed.filter((x) =>
    x.matchType === "exact_product" || x.evidenceType === "official" || x.evidenceType === "product_listing"
  ).length;
  const weak = typed.filter((x) => x.matchType === "weak").length;
  const conflicts = (analysis.evidenceTensions ?? []).filter((x) => x.status === "conflict").length;
  return clamp(35 + Math.min(strong, 6) * 9 - Math.min(weak, 6) * 4 - Math.min(conflicts, 4) * 7);
}

function performanceSignal(performance: CampaignPerformance[]) {
  const withClicks = performance.filter((p) => num(p.metrics.clicks) != null);
  const withReach = performance.filter((p) => num(p.metrics.views) != null || num(p.metrics.impressions) != null);
  if (!performance.length) return { salesSignal: 35, learningSignal: 65 };
  if (!withClicks.length) return { salesSignal: 45, learningSignal: withReach.length ? 75 : 50 };

  const clickRates = withClicks
    .map((p) => {
      const clicks = num(p.metrics.clicks);
      const reach = num(p.metrics.impressions) ?? num(p.metrics.views);
      return clicks != null && reach && reach > 0 ? clicks / reach : null;
    })
    .filter((x): x is number => x != null);

  if (!clickRates.length) return { salesSignal: 45, learningSignal: 70 };
  const average = clickRates.reduce((a, b) => a + b, 0) / clickRates.length;
  return {
    salesSignal: clamp(35 + Math.min(50, average * 1000)),
    learningSignal: clamp(70 + Math.min(20, clickRates.length * 4))
  };
}

function scoreTest(
  post: { concept: string; hook: string; format: string; channel: string; reason: string; testMetric: string },
  index: number,
  analysis: {
    customer?: { likelySegments?: string[]; needs?: string[] };
    opportunities?: string[];
    searchEvidence?: Array<unknown>;
    evidenceTensions?: Array<{ status?: string }>;
    decision?: { target?: string; problem?: string; desire?: string; valueProposition?: string; channel?: string; format?: string };
  },
  performance: CampaignPerformance[]
) {
  const evidence = evidenceConfidence(analysis);
  const signal = performanceSignal(performance);
  const hasConcreteAudience = Boolean(text(analysis.decision?.target) || analysis.customer?.likelySegments?.length);
  const hasConcreteProblem = Boolean(text(analysis.decision?.problem) || analysis.customer?.needs?.length);
  const hasSpecificHook = text(post.hook).length >= 12;
  const hasDistinctConcept = text(post.concept).length >= 8;

  const salesExpectation = clamp(signal.salesSignal + (hasConcreteAudience ? 8 : 0) + (hasConcreteProblem ? 7 : 0) + (hasSpecificHook ? 5 : 0));
  const learningEfficiency = clamp(signal.learningSignal + (index === 0 ? 5 : 0) + (hasDistinctConcept ? 5 : 0) + (text(post.testMetric) ? 5 : 0));
  const risk = clamp(35 + (evidence < 55 ? 18 : 0) + (analysis.evidenceTensions?.some((x) => x.status === "conflict") ? 12 : 0) + (!hasConcreteProblem ? 10 : 0));
  const differentiation = clamp(45 + (hasDistinctConcept ? 10 : 0) + (hasSpecificHook ? 10 : 0) + (index === 0 ? 5 : 0));
  const score = clamp(salesExpectation * 0.35 + learningEfficiency * 0.25 + evidence * 0.2 + differentiation * 0.2 - risk * 0.1);
  const rationale = [
    "売上期待=" + salesExpectation,
    "学習効率=" + learningEfficiency,
    "証拠信頼度=" + evidence,
    "差別化=" + differentiation,
    "リスク=" + risk
  ].join(" / ");

  return {
    id: "test-" + Date.now() + "-" + (index + 1),
    concept: post.concept,
    hook: post.hook,
    channel: post.channel,
    format: post.format,
    hypothesis: post.reason,
    successMetric: post.testMetric,
    score,
    components: { salesExpectation, learningEfficiency, evidenceConfidence: evidence, risk, differentiation },
    rationale
  };
}

export function decideNextCampaign(input: {
  analysis: {
    customer?: { likelySegments?: string[]; needs?: string[] };
    opportunities?: string[];
    nextPosts?: Array<{ concept: string; hook: string; format: string; channel: string; reason: string; testMetric: string }>;
    searchEvidence?: Array<unknown>;
    evidenceTensions?: Array<{ status?: string }>;
    decision?: { target?: string; problem?: string; desire?: string; valueProposition?: string; channel?: string; format?: string };
  };
  performance?: CampaignPerformance[];
}): NextCampaignDecision {
  const posts = input.analysis.nextPosts ?? [];
  const performance = input.performance ?? [];
  const observed: string[] = [];
  const unknown: string[] = [];
  const basedOn: string[] = [];

  for (const p of performance) {
    const m = p.metrics;
    const parts = [
      num(m.views) != null ? "views=" + m.views : null,
      num(m.impressions) != null ? "impressions=" + m.impressions : null,
      num(m.likes) != null ? "likes=" + m.likes : null,
      num(m.comments) != null ? "comments=" + m.comments : null,
      num(m.shares) != null ? "shares=" + m.shares : null,
      num(m.clicks) != null ? "clicks=" + m.clicks : null
    ].filter(Boolean);
    if (parts.length) observed.push(p.platform + "/" + p.postId + ": " + parts.join(", "));
    else unknown.push(p.platform + "/" + p.postId + ": metrics unavailable");
  }

  if (performance.length) basedOn.push("接続済みSNSの観測実績");
  if (input.analysis.opportunities?.length) basedOn.push("商品・市場分析で抽出した機会");
  if (input.analysis.searchEvidence?.length) basedOn.push("商品・市場検索の証拠");
  if (input.analysis.evidenceTensions?.length) basedOn.push("肯定・否定証拠の緊張関係");
  if (!performance.length) unknown.push("まだ投稿実績が接続されていないため、成果比較はできない");

  const scored = posts.slice(0, 3).map((post, index) => scoreTest(post, index, input.analysis, performance)).sort((a, b) => b.score - a.score);
  const target = input.analysis.decision?.target || input.analysis.customer?.likelySegments?.[0] || "分析で特定した主要顧客";
  const angle = input.analysis.decision?.valueProposition || input.analysis.decision?.desire || "商品価値を具体的な顧客課題に接続する";
  const top = scored[0] ?? null;

  return {
    basedOn,
    observed,
    unknown,
    nextTests: scored,
    rationale: top
      ? "最優先テストは「" + top.concept + "」。" + top.rationale + "。未取得の売上・CVR等は推測せず、実測値を次回判断に利用します。"
      : "実行可能な投稿仮説がありません。まず顧客・訴求・チャネルの仮説を作成してください。",
    productionBrief: top ? {
      objective: "次の集客テストを実施し、仮説の反応を測定する",
      audience: target,
      angle,
      hook: top.hook,
      format: top.format,
      cta: "商品・サービスの次の行動を明確に促す"
    } : null
  };
}
