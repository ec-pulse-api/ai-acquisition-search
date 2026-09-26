import type { PageSnapshot } from "./types";
import type { WebSearchResult } from "./search-web";\nimport type { SocialSignal } from "./social-search";

export function buildAcquisitionPrompt(source: PageSnapshot, search: { query: string; results: WebSearchResult[] }, socialSignals: SocialSignal[] = []) {
  return [
    "あなたはCustomer Acquisition（顧客獲得・集客）戦略の分析AIです。",
    "公開情報だけを根拠に分析し、事実と推測を分けてください。競合や実績を捏造しないでください。",
    "目的は動画を作ることではなく、この商品を売るために「次に何を出すべきか」を決めることです。",
    "URL: " + source.url, "タイトル: " + source.title, "説明: " + source.description,
    "見出し: " + source.headings.join(" / "), "本文: " + source.text,
    "検索クエリ: " + search.query,
    "検索結果:\n" + search.results.map((x, i) => "[" + (i + 1) + "] [" + x.category + "] " + x.title + "\nQuery: " + x.query + "\nURL: " + x.url + "\n概要: " + x.snippet).join("\n\n"),
    "SNS実データ（任意接続）:\\n" + socialSignals.map((x, i) => "[" + (i + 1) + "] TikTok @" + x.author + " / " + x.title + " / views=" + x.views + " likes=" + x.likes + " comments=" + x.comments + " shares=" + x.shares + "\\nURL: " + x.url).join("\\n") + "\\n\\n" +\n    "SNSデータは反応の仮説を作るための観測値です。数値だけで売上を保証せず、投稿内容と指標を分けて評価してください.\n" +\n    "検索結果は発見材料です。category は customer_pain / customer_desire / competitor / market / channel の5分類です。各判断では関連するcategoryの結果を優先し、確認できないことを事実として断定しないでください。",
    "JSONのみで返してください。product, market, customer, competitors, performance, acquisitionProblems, opportunities, priorities, nextActions, decision, nextPosts, searchEvidenceを必ず含めてください。",
    "decisionは「次に何をすべきか」の結論です。各項目は商品ページまたは検索結果で確認できる根拠に結びつけ、根拠が弱い場合は「仮説」と明記してください。target, problem, desire, valueProposition, channel, format, testPlan, evidenceを必ず含めてください。",
    "nextPostsは最大3件。各項目にrank, concept, hook, format, channel, reason, testMetricを含め、互いに異なる仮説にしてください。",
    "hookは投稿冒頭で実際に使える具体的な一文にしてください。",
    "searchEvidenceは判断に使った検索結果を最大10件、query/category/title/url/snippet付きで返してください。socialSignalsは入力されたSNS観測データをそのまま判断材料として扱ってください。",
    "情報不足なら推測で埋めず、何を検証すべきかを明示してください。"
  ].join("\n\n");
}