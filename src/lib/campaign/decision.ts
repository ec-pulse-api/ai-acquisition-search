export type CampaignTest = {
  id: string;
  concept: string;
  hook: string;
  channel: string;
  format: string;
  hypothesis: string;
  successMetric: string;
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

export function decideNextCampaign(input: {
  analysis: {
    customer?: { likelySegments?: string[]; needs?: string[] };
    opportunities?: string[];
    nextPosts?: Array<{ concept: string; hook: string; format: string; channel: string; reason: string; testMetric: string }>;
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
      num(m.views) != null ? `views=${m.views}` : null,
      num(m.impressions) != null ? `impressions=${m.impressions}` : null,
      num(m.likes) != null ? `likes=${m.likes}` : null,
      num(m.comments) != null ? `comments=${m.comments}` : null,
      num(m.shares) != null ? `shares=${m.shares}` : null,
      num(m.clicks) != null ? `clicks=${m.clicks}` : null,
    ].filter(Boolean);
    if (parts.length) observed.push(`${p.platform}/${p.postId}: ${parts.join(", ")}`);
    else unknown.push(`${p.platform}/${p.postId}: metrics unavailable`);
  }

  if (performance.length) basedOn.push("接続済みSNSの観測実績");
  if (input.analysis.opportunities?.length) basedOn.push("商品・市場分析で抽出した機会");
  if (!performance.length) unknown.push("まだ投稿実績が接続されていないため、成果比較はできない");

  const selected = posts.slice(0, 3);
  const target = input.analysis.decision?.target || input.analysis.customer?.likelySegments?.[0] || "分析で特定した主要顧客";
  const angle = input.analysis.decision?.valueProposition || input.analysis.decision?.desire || "商品価値を具体的な顧客課題に接続する";

  const nextTests: CampaignTest[] = selected.map((p, i) => ({
    id: `test-${Date.now()}-${i + 1}`,
    concept: p.concept,
    hook: p.hook,
    channel: p.channel,
    format: p.format,
    hypothesis: p.reason,
    successMetric: p.testMetric,
  }));

  return {
    basedOn,
    observed,
    unknown,
    nextTests,
    productionBrief: nextTests[0] ? {
      objective: "次の集客テストを実施し、仮説の反応を測定する",
      audience: target,
      angle,
      hook: nextTests[0].hook,
      format: nextTests[0].format,
      cta: "商品・サービスの次の行動を明確に促す",
    } : null,
  };
}
