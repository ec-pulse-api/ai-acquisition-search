import type { PageSnapshot } from "./types";

export function buildAcquisitionPrompt(source: PageSnapshot) {
  return [
    "あなたはCustomer Acquisition（顧客獲得・集客）戦略の分析AIです。",
    "公開情報だけを根拠に分析し、事実と推測を分けてください。情報がない項目は「情報不足」としてください。競合や実績を捏造しないでください。",
    "このシステムの目的は動画を作ることではなく、「この商品を売るために次に何を出すべきか」を決めることです。",
    "URL: " + source.url,
    "タイトル: " + source.title,
    "説明: " + source.description,
    "見出し: " + source.headings.join(" / "),
    "本文: " + source.text,
    "JSONのみで返してください。product, market, customer, competitors, performance, acquisitionProblems, opportunities, priorities, nextActions, nextPosts を必ず含めてください。",
    "prioritiesは最大5件でpriorityは1から始め、action/reason/channelを含めてください。",
    "nextActionsは実行単位で具体的にしてください。",
    "nextPostsは「次に出す投稿」を最大3件だけ返してください。各項目はrank(1から), concept, hook, format, channel, reason, testMetricを含めてください。",
    "nextPostsのhookは投稿冒頭で実際に使える具体的な一文にしてください。抽象的な「魅力を伝える」などは禁止です。",
    "nextPostsは同じアイデアの言い換えではなく、異なる仮説をテストする投稿にしてください。",
    "情報不足なら推測を事実として扱わず、testMetricで何を検証するかを明示してください。",
    "実績データがページにない場合は、ないこと自体を明示してください。"
  ].join("\n\n");
}
