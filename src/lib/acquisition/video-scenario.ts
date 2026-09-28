import type { AcquisitionAnalysis } from "./types";

export type VideoScene = {
  startSec: number;
  endSec: number;
  purpose: string;
  visual: string;
  narration: string;
  onScreenText: string;
  assetPrompt: string;
  transition: string;
};

export type VideoScenario = {
  id: string;
  title: string;
  platform: string;
  format: string;
  durationSec: number;
  objective: string;
  target: string;
  pain: string;
  desire: string;
  angle: string;
  hook: string;
  scenes: VideoScene[];
  cta: string;
  caption: string;
  hashtags: string[];
  generationInstructions: string[];
  complianceNotes: string[];
};

export function buildVideoScenario(analysis: AcquisitionAnalysis, rank = 1): VideoScenario {
  const post = analysis.nextPosts.find((item) => item.rank === rank) ?? analysis.nextPosts[0];
  if (!post) throw new Error("動画化できるNEXT POSTがありません。");

  const durationSec = /比較/.test(post.format) ? 24 : 30;
  const target = analysis.decision.target || analysis.customer.summary;
  const pain = analysis.decision.problem || "購入前に感じている悩み";
  const desire = analysis.decision.desire || "失敗せずに自分に合う選択をしたい";
  const angle = post.concept;
  const hook = post.hook;

  const scenes: VideoScene[] = [
    {
      startSec: 0,
      endSec: 3,
      purpose: "Hook",
      visual: "商品または使用シーンを最初のフレームから見せる。自然なスマホ撮影風。",
      narration: hook,
      onScreenText: hook,
      assetPrompt: "vertical 9:16 realistic Japanese UGC advertisement, natural smartphone camera, product clearly visible, authentic human behavior, clean background, no watermark",
      transition: "hard cut",
    },
    {
      startSec: 3,
      endSec: 10,
      purpose: "Problem",
      visual: "ターゲットが抱える具体的な困りごとを日常の使用シーンで表現する。",
      narration: `${target}なら、${pain}と感じることはありませんか？`,
      onScreenText: pain,
      assetPrompt: "vertical 9:16 realistic everyday Japanese scene showing a relatable customer problem, natural acting, documentary UGC style",
      transition: "quick cut",
    },
    {
      startSec: 10,
      endSec: 20,
      purpose: "Solution",
      visual: "商品を使う場面を中心に、便益が伝わる具体的な動作を見せる。",
      narration: `そこで、この商品。${analysis.decision.valueProposition}。${desire}を目指す人に向いています。`,
      onScreenText: analysis.decision.valueProposition,
      assetPrompt: "vertical 9:16 realistic Japanese UGC product demonstration, close-up product detail followed by natural usage, believable lighting and movement",
      transition: "match cut",
    },
    {
      startSec: 20,
      endSec: durationSec - 5,
      purpose: "Proof",
      visual: "商品の特徴・比較ポイント・利用イメージを短く補強する。根拠のない数値や効果は表示しない。",
      narration: `ポイントは、${angle}として試して反応を見ることです。`,
      onScreenText: "ポイントをシンプルに確認",
      assetPrompt: "vertical 9:16 realistic product detail shots and usage close-ups, premium but authentic social ad, no exaggerated effects",
      transition: "soft cut",
    },
    {
      startSec: durationSec - 5,
      endSec: durationSec,
      purpose: "CTA",
      visual: "商品と主要ベネフィットを再提示し、自然なCTAで終える。",
      narration: "気になったら、まず商品ページをチェックしてください。",
      onScreenText: "詳しくは商品ページへ",
      assetPrompt: "vertical 9:16 clean realistic product hero shot, natural smartphone advertisement ending, clear product visibility",
      transition: "fade",
    },
  ];

  return {
    id: `scenario-${Date.now()}-${rank}`,
    title: post.concept,
    platform: post.channel,
    format: post.format,
    durationSec,
    objective: post.testMetric,
    target,
    pain,
    desire,
    angle,
    hook,
    scenes,
    cta: "商品ページをチェック",
    caption: `${hook}。商品・サービスの詳細はプロフィールまたは商品ページから確認してください。`,
    hashtags: ["#商品紹介", "#おすすめ", "#TikTok広告", "#InstagramReels", "#UGC"],
    generationInstructions: [
      "縦型9:16で生成する。",
      "最初の3秒で商品とHookを明確に見せる。",
      "人物は自然な日本のUGC広告表現にする。",
      "画面内に生成サービスのロゴ・透かし・余計な文字を入れない。",
      "ナレーション本文は改変せず、必要なら専用TTSで音声化する。",
      "広告として誤認を招く断定・誇張・未確認の数値を追加しない。",
    ],
    complianceNotes: [
      "確認できていない効果・ランキング・比較優位を断定しない。",
      "医療・金融など規制領域の具体的な効能を推測で追加しない。",
      "実在人物・ブランドの偽装や、第三者のロゴを無断生成しない。",
    ],
  };
}
