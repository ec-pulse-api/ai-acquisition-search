import type { AcquisitionAnalysis, PageSnapshot } from "./types";
import { buildAcquisitionPrompt } from "./prompts";
import type { WebSearchResult } from "./search-web";
import type { SocialSignal } from "./social-search";
import type { ShopSignal } from "./shop-search";

function fallback(
  source: PageSnapshot,
  webResults: { query: string; results: WebSearchResult[] } = { query: "", results: [] },
  socialSignals: SocialSignal[] = [],
  shopSignals: ShopSignal[] = []
): AcquisitionAnalysis {
  const evidence = [
    source.productName,
    source.title,
    source.description,
    ...source.headings,
  ].filter(Boolean).slice(0, 8) as string[];

  const words =
    source.text.match(
      /(?:法人|企業|個人|初心者|担当者|経営者|マーケティング|開発者|店舗|EC|クリエイター)/gi
    ) ?? [];

  const segment = [...new Set(words)].slice(0, 3);
  const productName = source.productName || source.title || "この商品";

  return {
    product: {
      summary: source.title
        ? source.title + " の公開ページから商品・サービス情報を抽出しました。"
        : "商品・サービス名を十分に特定できませんでした。",
      valueProposition: source.headings.slice(0, 5),
      evidence,
    },
    productQuality: {
      summary: "商品ページと公開された市場シグナルから品質を確認しました。未確認の性能や耐久性は断定しません。",
      qualitySignals: [
        ...shopSignals
          .filter((x) => x.rating !== null || x.reviewCount !== null)
          .slice(0, 5)
          .map((x) => `${x.title}: rating=${x.rating ?? "未取得"}, reviews=${x.reviewCount ?? "未取得"}`),
        ...(source.productBrand ? [`ブランド: ${source.productBrand}`] : []),
        ...(source.productCategory ? [`カテゴリ: ${source.productCategory}`] : []),
      ],
      strengths: [],
      concerns: [],
      confidence: shopSignals.some((x) => x.rating !== null && x.reviewCount !== null) ? "medium" : "low",
      evidence: [
        ...evidence,
        ...shopSignals.slice(0, 5).map((x) => x.title),
      ].slice(0, 10),
      missingData: [
        "第三者による品質試験・認証",
        "耐久性・長期使用データ",
        "返品率・不良率",
      ],
    },
    market: {
      summary: "市場規模・成長率などの外部データは未取得です。",
      signals: source.headings.slice(0, 6),
    },
    customer: {
      summary: "ページ上の訴求内容から顧客候補を抽出しました。",
      likelySegments: segment.length
        ? segment
        : ["ページ内容から顧客属性を特定できていません"],
      needs: source.headings.slice(0, 5),
    },
    competitors: {
      summary: "競合を十分に事実確認できていません。",
      signals: source.links.slice(0, 10),
    },
    performance: {
      summary: "アクセス解析・広告・売上データは未接続です。",
      availableEvidence: evidence.filter((x) =>
        /実績|導入|顧客|売上|件|%|ユーザー|利用/i.test(x)
      ),
      missingData: [
        "売上",
        "CVR",
        "CTR",
        "広告CPA",
        "アクセス数",
        "顧客獲得数",
      ],
    },
    acquisitionProblems: [
      "外部市場データと競合比較が不足している。",
      "実績データが不足している。",
    ],
    opportunities: [
      "顧客・競合・訴求を外部検索で比較する。",
      "異なる投稿仮説をテストして反応データを蓄積する。",
    ],
    priorities: [
      {
        priority: 1,
        action: "顧客・競合・訴求候補を検索して比較する",
        reason: "URLだけでは外部市場を確認できないため",
        channel: "Web検索",
      },
      {
        priority: 2,
        action: "異なる訴求の投稿を3本テストする",
        reason: "反応する訴求が未検証のため",
        channel: "SNS",
      },
      {
        priority: 3,
        action: "アクセス・CV・売上を記録して次の判断材料にする",
        reason: "実績ベースの最適化に必要なため",
        channel: "Analytics / EC",
      },
    ],
    nextActions: [
      "顧客・競合・訴求候補を検索する",
      "異なる訴求の投稿を3本テストする",
      "アクセス・CV・売上を記録する",
    ],
    decision: {
      target: segment.length
        ? segment.join(" / ")
        : "公開ページから顧客像を特定できていない",
      problem: "顧客の具体的な悩みを外部情報で追加検証する",
      desire: "商品ページで示されている便益を実際の顧客表現で検証する",
      valueProposition:
        source.headings.slice(0, 3).join(" / ") ||
        "商品ページの主要便益を検証する",
      channel: "TikTok / Instagram Reels",
      format: "悩み起点の短尺投稿",
      testPlan:
        "異なる訴求を3本出し、視聴維持率・クリック率・購入率を比較する",
      evidence: evidence.slice(0, 5),
    },
    nextPosts: [
      {
        rank: 1,
        concept: productName + "の悩み解決型",
        hook: "この商品が必要になる人は、まずここを見てください。",
        format: "15〜30秒短尺",
        channel: "TikTok / Instagram Reels",
        reason: "悩み起点の反応を検証するため",
        testMetric: "視聴維持率・クリック率",
      },
      {
        rank: 2,
        concept: productName + "の比較型",
        hook: "似た商品を買う前に、この3つを比較してください。",
        format: "比較型短尺",
        channel: "TikTok / Instagram Reels",
        reason: "比較検討層の反応を検証するため",
        testMetric: "保存率・クリック率",
      },
      {
        rank: 3,
        concept: productName + "の使用シーン型",
        hook: "実際に使うなら、この場面で違いが出ます。",
        format: "使用シーン紹介",
        channel: "TikTok / Instagram Reels",
        reason: "利用イメージの反応を検証するため",
        testMetric: "クリック率・購入率",
      },
    ],
    socialSignals,
    shopSignals,
    searchEvidence: webResults.results.slice(0, 10),
    aiConnected: false,
  };
}

export async function analyzePage(
  source: PageSnapshot,
  webResults: { query: string; results: WebSearchResult[] } = {
    query: "",
    results: [],
  },
  socialSignals: SocialSignal[] = [],
  shopSignals: ShopSignal[] = []
): Promise<AcquisitionAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return fallback(source, webResults, socialSignals, shopSignals);
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer " + apiKey,
    },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "あなたはB2C/B2Bの顧客獲得戦略を分析する慎重なマーケティングアナリストです。",
        },
        {
          role: "user",
          content: buildAcquisitionPrompt(
            source,
            webResults,
            socialSignals,
            shopSignals
          ),
        },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(
      "AI分析に失敗しました（HTTP " + response.status + "）。"
    );
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new Error("AIから分析結果が返りませんでした。");
  }

  const parsed = JSON.parse(content) as Partial<AcquisitionAnalysis>;
  const base = fallback(source, webResults, socialSignals, shopSignals);

  const arr = <T,>(value: unknown, fallbackValue: T[]): T[] =>
    Array.isArray(value) ? (value as T[]) : fallbackValue;

  const obj = <T extends object>(
    value: unknown,
    fallbackValue: T
  ): T =>
    value && typeof value === "object"
      ? { ...fallbackValue, ...(value as Partial<T>) }
      : fallbackValue;

  const product = obj(parsed.product, base.product);
  const productQuality = obj(parsed.productQuality, base.productQuality);
  const market = obj(parsed.market, base.market);
  const customer = obj(parsed.customer, base.customer);
  const competitors = obj(parsed.competitors, base.competitors);
  const performance = obj(parsed.performance, base.performance);
  const decision = obj(parsed.decision, base.decision);

  return {
    ...base,
    ...parsed,

    product: {
      ...product,
      valueProposition: arr(
        product.valueProposition,
        base.product.valueProposition
      ),
      evidence: arr(product.evidence, base.product.evidence),
    },

    productQuality: {
      ...productQuality,
      qualitySignals: arr(productQuality.qualitySignals, base.productQuality.qualitySignals),
      strengths: arr(productQuality.strengths, base.productQuality.strengths),
      concerns: arr(productQuality.concerns, base.productQuality.concerns),
      evidence: arr(productQuality.evidence, base.productQuality.evidence),
      missingData: arr(productQuality.missingData, base.productQuality.missingData),
      confidence:
        productQuality.confidence === "high" ||
        productQuality.confidence === "medium" ||
        productQuality.confidence === "low"
          ? productQuality.confidence
          : base.productQuality.confidence,
    },

    market: {
      ...market,
      signals: arr(market.signals, base.market.signals),
    },

    customer: {
      ...customer,
      likelySegments: arr(
        customer.likelySegments,
        base.customer.likelySegments
      ),
      needs: arr(customer.needs, base.customer.needs),
    },

    competitors: {
      ...competitors,
      signals: arr(competitors.signals, base.competitors.signals),
    },

    performance: {
      ...performance,
      availableEvidence: arr(
        performance.availableEvidence,
        base.performance.availableEvidence
      ),
      missingData: arr(
        performance.missingData,
        base.performance.missingData
      ),
    },

    acquisitionProblems: arr(
      parsed.acquisitionProblems,
      base.acquisitionProblems
    ),

    opportunities: arr(parsed.opportunities, base.opportunities),

    priorities: arr(parsed.priorities, base.priorities),

    nextActions: arr(parsed.nextActions, base.nextActions),

    nextPosts: arr(parsed.nextPosts, base.nextPosts),

    socialSignals: arr(parsed.socialSignals, base.socialSignals),

    shopSignals: arr(parsed.shopSignals, base.shopSignals),

    searchEvidence: arr(
      parsed.searchEvidence,
      base.searchEvidence
    ).slice(0, 10),

    decision: {
      ...decision,
      evidence: arr(decision.evidence, base.decision.evidence),
    },

    aiConnected: true,
  };
}
