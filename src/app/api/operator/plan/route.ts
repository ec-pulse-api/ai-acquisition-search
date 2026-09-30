import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import type { AcquisitionAnalyzeResult } from "@/lib/acquisition/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUserFromBearer(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

  let productId = "";
  let productCreated = false;
  let planId = "";
  let creativeId = "";
  let socialPostId = "";
  let productionJobId = "";

  try {
    const body = await request.json() as { source?: AcquisitionAnalyzeResult["source"]; analysis?: AcquisitionAnalyzeResult["analysis"] };
    const source = body.source;
    const analysis = body.analysis;
    if (!source?.url || !analysis?.decision) return NextResponse.json({ error: "分析結果が不足しています。" }, { status: 400 });

    const db = getAdminSupabase();
    const existing = await db.from("products").select("id").eq("user_id", user.id).eq("url", source.url).maybeSingle();
    if (existing.error) throw existing.error;

    productId = existing.data?.id as string | undefined || "";
    if (productId) {
      const { error } = await db.from("products").update({
        name: source.productName || source.title || "商品・サービス",
        updated_at: new Date().toISOString(),
      }).eq("id", productId).eq("user_id", user.id);
      if (error) throw error;
    } else {
      const { data, error } = await db.from("products").insert({
        user_id: user.id,
        name: source.productName || source.title || "商品・サービス",
        url: source.url,
      }).select("id").single();
      if (error) throw error;
      productId = data.id;
      productCreated = true;
    }

    const decision = analysis.decision;
    const { data: plan, error: planError } = await db.from("acquisition_plans").insert({
      product_id: productId,
      user_id: user.id,
      target: decision.target,
      pain: decision.problem,
      desire: decision.desire,
      value_proposition: decision.valueProposition,
      channel: decision.channel,
      format: decision.format,
      angle: decision.valueProposition,
      hypothesis: decision.testPlan,
      status: "planned",
    }).select("id, created_at").single();
    if (planError) throw planError;
    planId = plan.id;

    const firstPost = analysis.nextPosts?.[0];
    const { data: creative, error: creativeError } = await db.from("creatives").insert({
      product_id: productId,
      plan_id: plan.id,
      user_id: user.id,
      title: firstPost?.concept || "広告テストクリエイティブ",
      variation: "A",
      hook: firstPost?.hook || decision.valueProposition,
      scenario: { concept: firstPost?.concept, hook: firstPost?.hook, format: firstPost?.format, channel: firstPost?.channel, testMetric: firstPost?.testMetric },
      status: "planned",
    }).select("id").single();
    if (creativeError) throw creativeError;
    creativeId = creative.id;
    const network = String(firstPost?.channel || decision.channel || "tiktok").toLowerCase();
    const { data: socialPost, error: socialPostError } = await db.from("social_posts").insert({
      creative_id: creative.id,
      user_id: user.id,
      network,
      status: "scheduled",
      caption: firstPost?.hook || decision.valueProposition,
      metadata: { plan_id: plan.id, hypothesis: decision.testPlan, operator_patrol_status: "active", operator_managed: true, auto_publish: true },
    }).select("id").single();
    if (socialPostError) throw socialPostError;
    socialPostId = socialPost.id;

    // 初回テストも巡回チェーンの外に置かない。
    // ここで動画ジョブをキューへ入れ、Cron Workerが生成→公開まで進める。
    const prompt = [
      "Create the first short-form advertising video for iterative acquisition testing.",
      "Product: " + String(source.productName || source.title || "商品・サービス"),
      "Hook: " + String(firstPost?.hook || decision.valueProposition || ""),
      "Concept: " + String(firstPost?.concept || decision.testPlan || ""),
      "Target: " + String(decision.target || ""),
      "Network: " + network,
      "Format: " + String(firstPost?.format || decision.format || "short-form"),
      "Use natural UGC-style visuals, 9:16, clear first 3 seconds, no fake claims, no watermark, no platform UI."
    ].join("\n");

    const { data: productionJob, error: productionJobError } = await db.from("production_jobs").insert({
      user_id: user.id,
      social_post_id: socialPost.id,
      creative_id: creative.id,
      provider: "higgsfield",
      model: process.env.HF_VIDEO_MODEL || "alibaba/wan-3.0/text-to-video",
      status: "queued",
      prompt,
      duration: 5,
      resolution: "1080p",
      aspect_ratio: "9:16",
      generate_audio: false,
    }).select("id").single();
    if (productionJobError || !productionJob) throw productionJobError || new Error("初回動画生成ジョブの作成に失敗しました。");
    productionJobId = productionJob.id;

    const { data: run, error: runError } = await db.from("operator_runs").insert({
      product_id: productId,
      user_id: user.id,
      run_type: "acquisition_test_plan",
      status: "completed",
      input: { url: source.url },
      output: { decision, next_posts: analysis.nextPosts, priorities: analysis.priorities },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString(),
    }).select("id").single();
    if (runError) throw runError;

    return NextResponse.json({ ok: true, planId: plan.id, runId: run.id, socialPostId: socialPost.id, productionJobId, message: "初回広告テストを動画生成キューへ登録しました。Workerが生成・公開し、巡回を開始します。" });
  } catch (error) {
    // このAPIは複数テーブルへ順番に書き込むため、後段失敗時に
    // 中途半端なテスト計画だけを残さない。既存productは絶対に削除しない。
    try {
      const db = getAdminSupabase();
      if (productionJobId) await db.from("production_jobs").delete().eq("id", productionJobId).eq("user_id", user.id);
      if (socialPostId) await db.from("social_posts").delete().eq("id", socialPostId).eq("user_id", user.id);
      if (creativeId) await db.from("creatives").delete().eq("id", creativeId).eq("user_id", user.id);
      if (planId) await db.from("acquisition_plans").delete().eq("id", planId).eq("user_id", user.id);
      if (productCreated && productId) {
        const { count } = await db.from("products").select("id", { count: "exact", head: true }).eq("id", productId).eq("user_id", user.id);
        if (count === 1) {
          await db.from("products").delete().eq("id", productId).eq("user_id", user.id);
        }
      }
    } catch (cleanupError) {
      console.error("operator plan rollback failed", cleanupError);
    }
    console.error("operator plan error", error);
    return NextResponse.json({ error: "テスト計画の保存に失敗しました。" }, { status: 500 });
  }
}
