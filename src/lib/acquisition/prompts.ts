import type { PageSnapshot } from "./types";

export function buildAcquisitionPrompt(source: PageSnapshot) {
  return [
    "あなたはCustomer Acquisition（顧客獲得・集客）戦略の分析AIです。",
    "公開情報だけを根拠に分析し、事実と推測を分けてください。情報がない項目は「情報不足」としてください。競合や実績を捏造しないでください。",
    "URL: " + source.url,
    "タイトル: " + source.title,
    "説明: " + source.description,
    "見出し: " + source.headings.join(" / "),
    "本文: " + source.text,
    "JSONのみで返してください。product, market, customer, competitors, performance, acquisitionProblems, opportunities, priorities, nextActions を必ず含めてください。",
    "prioritiesは最大5件でpriorityは1から始め、action/reason/channelを含めてください。",
    "nextActionsは「次に何をやるか」が実行単位で分かる具体的な内容にしてください。",
    "実績データがページにない場合は、ないこと自体を明示してください。"
  ].join("\n\n");
}
