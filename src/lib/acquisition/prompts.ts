import type { PageSnapshot } from "./types";
import type { WebSearchResult } from "./search-web";

export function buildAcquisitionPrompt(source: PageSnapshot, search: { query: string; results: WebSearchResult[] }) {
  return [
    "あなたはCustomer Acquisition（顧客獲得・集客）戦略の分析AIです。",
    "公開情報だけを根拠に分析し、事実と推測を分けてください。競合や実績を捏造しないでください。",
    "目的は動画を作ることではなく、この商品を売るために「次に何を出すべきか」を決めることです。",
    "URL: " + source.url, "タイトル: " + source.title, "説明: " + source.description,
    "見出し: " + source.headings.join(" / "), "本文: " + source.text,
    "検索クエリ: " + search.query,
    "検索結果:\n" + search.results.map((x,i) => "["+(i+1)+"] "+x.title+"\nURL: "+x.url+"\n概要: "+x.snippet).join("\n\n"),
    "検索結果は市場・顧客・競合の発見材料として使い、確認できないことを事実として断定しないでください。",
    "JSONのみで返してください。product, market, customer, competitors, performance, acquisitionProblems, opportunities, priorities, nextActions, nextPosts, searchEvidenceを必ず含めてください。",
    "nextPostsは最大3件。各項目にrank, concept, hook, format, channel, reason, testMetricを含め、互いに異なる仮説にしてください。",
    "hookは投稿冒頭で実際に使える具体的な一文にしてください。",
    "searchEvidenceは判断に使った検索結果を最大10件、title/url/snippet付きで返してください。",
    "情報不足なら推測で埋めず、何を検証すべきかを明示してください。"
  ].join("\n\n");
}
