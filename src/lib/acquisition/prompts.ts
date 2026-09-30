import type { PageSnapshot } from "./types";
import type { WebSearchResult } from "./search-web";
import type { SocialSignal } from "./social-search";
import type { ShopSignal } from "./shop-search";

export function buildAcquisitionPrompt(
  source: PageSnapshot,
  search: { query: string; results: WebSearchResult[] },
  socialSignals: SocialSignal[] = [],
  shopSignals: ShopSignal[] = []
) {
  const searchText = search.results.map((x, i) =>
    [
      `[${i + 1}] [${x.category}] ${x.title}`,
      `Query: ${x.query}`,
      `URL: ${x.url}`,
      `概要: ${x.snippet}`,
    ].join("\n")
  ).join("\n\n");

  const socialText = socialSignals.map((x, i) =>
    [
      `[${i + 1}] TikTok @${x.author} / ${x.title}`,
      `views=${x.views} likes=${x.likes} comments=${x.comments} shares=${x.shares}`,
      `URL: ${x.url}`,
    ].join("\n")
  ).join("\n");

  const shopText = shopSignals.map((x, i) =>
    [
      `[${i + 1}] ${x.title}`,
      `seller=${x.seller} / price=${x.price} ${x.currency} / sales=${x.sales} / rating=${x.rating} / reviews=${x.reviewCount}`,
      `URL: ${x.url}`,
    ].join("\n")
  ).join("\n");

  return [
    "あなたはCustomer Acquisition（顧客獲得・集客）戦略の分析AIです。",
    "公開情報だけを根拠に分析し、事実と推測を分けてください。競合や実績を捏造しないでください。",
    "目的は動画を作ることではなく、この商品を売るために「次に何を出すべきか」を決めることです。",
    "URL: " + source.url,
    "タイトル: " + source.title,
    "説明: " + source.description,
    "見出し: " + source.headings.join(" / "),
    "本文: " + source.text,
    "検索クエリ: " + search.query,
    "検索結果:\n" + searchText,
    "SNS実データ（任意接続）:\n" + socialText,
    "TikTok Shop競合商品データ:\n" + shopText,
    "TikTok Shopデータは競合・価格・販売量の仮説を作るための観測値です。未取得値は事実として補完しないでください。",
    "SNSデータは反応の仮説を作るための観測値です。数値だけで売上を保証せず、投稿内容と指標を分けて評価してください。",
    "検索結果は発見材料です。category は customer_pain / customer_desire / competitor / market / channel の5分類です。",
    "商品の『質』も独立して評価してください。売れる可能性と商品そのものの品質は分けて判断してください。",
    "productQualityにはsummary, qualitySignals, strengths, concerns, confidence, evidence, missingDataを必ず含めてください。",
    "qualitySignalsは価格、評価、レビュー件数、仕様、素材、保証、返品、認証、販売者情報など、確認できた具体的な品質シグナルだけを記載してください。",
    "strengths/concernsは商品ページ・検索・ショップデータで裏付けられる内容だけを記載し、広告文だけを品質の証拠にしないでください。",
    "confidenceは証拠量に応じてhigh/medium/low。レビューや販売実績が未取得ならhighにしないでください。",
    "未確認の耐久性、安全性、性能、原材料、正規性などを推測で補完しないでください。確認できない項目はmissingDataへ入れてください。",
    "JSONのみで返してください。product, productQuality, market, customer, competitors, performance, acquisitionProblems, opportunities, priorities, nextActions, decision, nextPosts, searchEvidenceを必ず含めてください。"
    "decisionは「次に何をすべきか」の結論です。target, problem, desire, valueProposition, channel, format, testPlan, evidenceを必ず含めてください。",
    "nextPostsは最大3件。各項目にrank, concept, hook, format, channel, reason, testMetricを含め、互いに異なる仮説にしてください。",
    "hookは投稿冒頭で実際に使える具体的な一文にしてください。",
    "searchEvidenceは判断に使った検索結果を最大10件、query/category/title/url/snippet付きで返してください。",
    "情報不足なら推測で埋めず、何を検証すべきかを明示してください。",
  ].join("\n\n");
}
