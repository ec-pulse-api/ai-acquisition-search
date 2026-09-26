import type { AcquisitionAnalysis, PageSnapshot } from "./types";
import { buildAcquisitionPrompt } from "./prompts";

function fallback(source: PageSnapshot): AcquisitionAnalysis {
  const evidence = [source.title, source.description, ...source.headings].filter(Boolean).slice(0, 8);
  const words = source.text.match(/(?:法人|企業|個人|初心者|担当者|経営者|マーケティング|開発者|店舗|EC|クリエイター)/gi) ?? [];
  const segment = [...new Set(words)].slice(0, 3);
  const productName = source.title || "この商品";
  return {
    product: {
      summary: source.title ? source.title + " の公開ページから商品・サービス情報を抽出しました。" : "商品・サービス名を十分に特定できませんでした。",
      valueProposition: source.headings.slice(0, 5), evidence
    },
    market: {
      summary: "市場規模・成長率などの外部データは未取得です。公開ページから確認できる市場シグナルを整理しました。",
      signals: source.headings.slice(0, 6)
    },
    customer: {
      summary: "ページ上の訴求内容から顧客候補を抽出しました。実際の顧客属性は追加データで検証が必要です。",
      likelySegments: segment.length ? segment : ["ページ内容から顧客属性を特定できていません"],
      needs: source.headings.slice(0, 5)
    },
    competitors: {
      summary: "このURL単体では競合を事実確認できません。競合URLや検索データを追加すると比較精度を上げられます。",
      signals: source.links.slice(0, 10)
    },
    performance: {
      summary: "ページ内に明示された実績のみ確認しています。アクセス解析・広告・売上データは未接続です。",
      availableEvidence: evidence.filter((x) => /実績|導入|顧客|売上|件|%|ユーザー|利用/i.test(x)),
      missingData: ["売上", "CVR", "CTR", "広告CPA", "アクセス数", "顧客獲得数"]
    },
    acquisitionProblems: ["最も効率的な集客チャネルをページ情報だけでは判断できない。", "競合比較と実績データが不足している。"],
    opportunities: ["ターゲット別に訴求軸を整理する。", "複数の投稿仮説をテストして反応データを蓄積する。"],
    priorities: [
      { priority: 1, action: "主要ターゲットを1〜2セグメントに絞って訴求を再整理する", reason: "顧客像が十分に検証されていないため", channel: "Web / SEO / SNS" },
      { priority: 2, action: "競合3〜5社の訴求・価格・導線を比較する", reason: "差別化ポイントが未検証のため", channel: "競合調査" },
      { priority: 3, action: "最初の投稿を3つの異なる仮説でテストする", reason: "どの訴求が反応を取れるか未検証のため", channel: "SNS" }
    ],
    nextActions: ["ターゲット候補を決める", "競合3〜5社を調査する", "異なる訴求の投稿を3本テストする"],
    nextPosts: [
      { rank: 1, concept: productName + "の悩み解決型", hook: "この商品が必要になる人は、まずここを見てください。", format: "15〜30秒短尺", channel: "TikTok / Instagram Reels", reason: "悩み起点の反応を検証するため", testMetric: "視聴維持率・プロフィール遷移率" },
      { rank: 2, concept: productName + "の比較型", hook: "似た商品を買う前に、この3つを比較してください。", format: "比較・ランキング型短尺", channel: "TikTok / Instagram Reels", reason: "比較検討層の反応を検証するため", testMetric: "保存率・商品ページクリック率" },
      { rank: 3, concept: productName + "の使用シーン型", hook: "実際に使うなら、この場面で一番違いが出ます。", format: "使用シーン紹介", channel: "TikTok / Instagram Reels", reason: "利用イメージからの興味を検証するため", testMetric: "クリック率・購入率" }
    ],
    aiConnected: false
  };
}

export async function analyzePage(source: PageSnapshot): Promise<AcquisitionAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return fallback(source);

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
    body: JSON.stringify({
      model: process.env.OPENAI_MODEL || "gpt-5-mini",
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "あなたはB2C/B2Bの顧客獲得戦略を分析する慎重なマーケティングアナリストです。" },
        { role: "user", content: buildAcquisitionPrompt(source) }
      ]
    })
  });
  if (!response.ok) throw new Error("AI分析に失敗しました（HTTP " + response.status + "）。");
  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("AIから分析結果が返りませんでした。");
  return { ...(JSON.parse(content) as AcquisitionAnalysis), aiConnected: true };
}
