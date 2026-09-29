import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";

type Verdict = "continue" | "pivot" | "stop";

const fallbackDecision = (m: any, network: string): { verdict: Verdict; reason: string; nextAction: string } => {
  const roas = m?.roas == null ? null : Number(m.roas);
  const ctr = m?.ctr == null ? null : Number(m.ctr);
  const cvr = m?.cvr == null ? null : Number(m.cvr);
  const cpa = m?.cpa == null ? null : Number(m.cpa);
  const impressions = Number(m?.impressions || 0);
  const views = Number(m?.views || 0);
  const clicks = Number(m?.clicks || 0);
  const conversions = Number(m?.conversions || 0);
  const revenue = Number(m?.revenue || 0);
  const adSpend = Number(m?.ad_spend || 0);

  // SNS APIではクリック・売上が取得できない媒体がある。
  // その場合、0を「実際に0だった」と解釈してSTOPにしない。
  const raw = m?.raw && typeof m.raw === "object" ? m.raw : {};
  const manuallyMeasured = !raw.source || raw.source === "manual";
  const clickSignalKnown = manuallyMeasured || network === "linkedin" || clicks > 0 || cvr != null;
  const revenueSignalKnown = manuallyMeasured || roas != null || cpa != null || cvr != null || conversions > 0 || revenue > 0 || adSpend > 0;

  if (roas != null && roas >= 2) return { verdict: "continue", reason: "ROASが2.0以上です。現在の訴求を維持しながら新しいクリエイティブを追加テストします。", nextAction: "同じ訴求でHookを変更した広告を2案テストする" };
  if (ctr != null && ctr >= 0.02 && clickSignalKnown) return { verdict: "pivot", reason: "クリック反応は確認できています。訴求またはHookを変更して再テストします。", nextAction: "訴求とHookを変更した広告をテストする" };

  if (!revenueSignalKnown && !clickSignalKnown) {
    const observed = views > 0 ? "再生数" + views.toLocaleString() + "件" : impressions > 0 ? "インプレッション" + impressions.toLocaleString() + "件" : "SNSの基本指標";
    return { verdict: "pivot", reason: network + "では売上・クリックが自動取得できていないため、現時点でSTOPとは判定しません。" + observed + "を基準に次の仮説をテストします。", nextAction: "同じ商品でHookまたは訴求を1つだけ変更して再テストし、クリック・購入データを追加取得する" };
  }

  if (ctr != null && ctr < 0.02 && clickSignalKnown) return { verdict: "stop", reason: "クリック反応が設定した基準を下回っています。現在のHook・訴求は継続せず、別仮説をテストします。", nextAction: "別の顧客セグメントまたは訴求でテストする" };
  if (cvr != null && cvr <= 0 && conversions === 0 && clicks > 0) return { verdict: "pivot", reason: "クリックは発生していますが購入・CVが確認できていません。広告から遷移後の訴求を変更して再テストします。", nextAction: "広告HookではなくLP・オファーとの接続を変更して再テストする" };

  return { verdict: "pivot", reason: "現時点では継続・停止を断定できるだけの成果データが不足しています。", nextAction: "変更点を1つに絞って次のクリエイティブをテストする" };
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
      .select("impressions,views,likes,comments,shares,saves,clicks,conversions,revenue,gross_profit,ad_spend,ctr,cvr,cpa,roas,raw,measured_at")
      .eq("social_post_id", post.id).order("measured_at", { ascending: false }).limit(1).maybeSingle();
    if (metricError) throw metricError;
    if (!metric) return NextResponse.json({ error: "先に実績を取得してください。" }, { status: 400 });

    const fallback = fallbackDecision(metric, post.network);
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
