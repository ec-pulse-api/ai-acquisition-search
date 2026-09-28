import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";

type Verdict = "continue" | "pivot" | "stop";

const fallbackDecision = (m: any): { verdict: Verdict; reason: string; nextAction: string } => {
  const roas = m?.roas == null ? null : Number(m.roas);
  const ctr = m?.ctr == null ? null : Number(m.ctr);
  if (roas != null && roas >= 2) return { verdict: "continue", reason: "ROASが2.0以上です。現在の訴求を維持しながら新しいクリエイティブを追加テストします。", nextAction: "同じ訴求でHookを変更した広告を2案テストする" };
  if (ctr != null && ctr >= 0.02) return { verdict: "pivot", reason: "クリック反応は確認できています。訴求またはHookを変更して再テストします。", nextAction: "訴求とHookを変更した広告をテストする" };
  return { verdict: "stop", reason: "現時点の反応が弱いため、別セグメントまたは別訴求をテストします。", nextAction: "別の顧客セグメントまたは訴求でテストする" };
};

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    const body = await request.json() as { socialPostId?: string; productId?: string };
    if (!body.socialPostId) return NextResponse.json({ error: "socialPostIdが必要です。" }, { status: 400 });

    const db = getAdminSupabase();
    const { data: post, error: postError } = await db.from("social_posts")
      .select("id,user_id,creative_id,network,caption").eq("id", body.socialPostId).eq("user_id", user.id).maybeSingle();
    if (postError) throw postError;
    if (!post) return NextResponse.json({ error: "対象投稿が見つかりません。" }, { status: 404 });

    const { data: creative, error: creativeError } = await db.from("creatives")
      .select("id,product_id,plan_id,title,variation,hook,scenario,generation_provider,generation_model")
      .eq("id", post.creative_id).eq("user_id", user.id).maybeSingle();
    if (creativeError) throw creativeError;

    const { data: metric, error: metricError } = await db.from("post_metrics")
      .select("impressions,views,likes,comments,shares,saves,clicks,conversions,revenue,gross_profit,ad_spend,ctr,cvr,cpa,roas,measured_at")
      .eq("social_post_id", post.id).order("measured_at", { ascending: false }).limit(1).maybeSingle();
    if (metricError) throw metricError;
    if (!metric) return NextResponse.json({ error: "先に実績を取得してください。" }, { status: 400 });

    const fallback = fallbackDecision(metric);
    let decision = fallback;
    let aiConnected = false;

    const apiKey = process.env.OPENAI_API_KEY;
    if (apiKey) {
      const prompt = [
        "広告運用の実績を評価し、次のテスト方針を決めてください。",
        "必ずJSONのみ: {verdict:'continue'|'pivot'|'stop',reason:string,nextAction:string,changedAngle:string,changedHook:string,testMetric:string}",
        "数値が不足している場合は不足を明示し、断定を避けること。",
        JSON.stringify({ creative, network: post.network, caption: post.caption, metrics: metric }),
      ].join("\n");
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer " + apiKey },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL || "gpt-5-mini",
          temperature: 0.1,
          response_format: { type: "json_object" },
          messages: [
            { role: "system", content: "あなたは広告実績から次の実験を設計する分析エンジンです。勝敗を誇張せず、与えられた数値だけで判断してください。" },
            { role: "user", content: prompt },
          ],
        }),
      });
      if (response.ok) {
        const payload = await response.json();
        const content = payload.choices?.[0]?.message?.content;
        if (content) {
          const parsed = JSON.parse(content);
          if (["continue","pivot","stop"].includes(parsed.verdict) && parsed.reason && parsed.nextAction) {
            decision = {
              verdict: parsed.verdict,
              reason: String(parsed.reason),
              nextAction: String(parsed.nextAction),
              ...(parsed.changedAngle ? { changedAngle: String(parsed.changedAngle) } : {}),
              ...(parsed.changedHook ? { changedHook: String(parsed.changedHook) } : {}),
              ...(parsed.testMetric ? { testMetric: String(parsed.testMetric) } : {}),
            } as any;
            aiConnected = true;
          }
        }
      }
    }

    const { data: run, error: runError } = await db.from("operator_runs").insert({
      product_id: body.productId || creative?.product_id || null,
      user_id: user.id,
      run_type: "ai_performance_verdict",
      status: "completed",
      input: { social_post_id: post.id, creative_id: post.creative_id, metrics: metric },
      output: { ...decision, aiConnected },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).select("id").single();
    if (runError) throw runError;

    return NextResponse.json({ ok: true, runId: run.id, aiConnected, ...decision });
  } catch (error) {
    console.error("ai decision error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "AI判定に失敗しました。" }, { status: 500 });
  }
}
