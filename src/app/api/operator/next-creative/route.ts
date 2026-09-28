import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { generateHiggsfieldVideo } from "@/lib/video/higgsfield";

export const runtime = "nodejs";
export const maxDuration = 60;

function makePrompt(input: {
  title: string; originalHook: string; changedAngle?: string; changedHook?: string;
  nextAction: string; network: string;
}) {
  return [
    "Create the next short-form advertising video for iterative acquisition testing.",
    "Product/creative: " + input.title,
    "Original hook: " + input.originalHook,
    "Network: " + input.network,
    "Decision: " + input.nextAction,
    input.changedAngle ? "Changed angle: " + input.changedAngle : "",
    input.changedHook ? "Changed hook: " + input.changedHook : "",
    "Use natural UGC-style visuals, 9:16, clear first 3 seconds, no fake claims, no watermark, no platform UI.",
    "Keep the product recognizable and make the change from the previous creative explicit in the hook or angle.",
  ].filter(Boolean).join("\n");
}

export async function POST(request: Request) {
  let jobId = "";
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const body = await request.json() as {
      socialPostId?: string;
      verdict?: "continue" | "pivot" | "stop";
      nextAction?: string;
      changedAngle?: string;
      changedHook?: string;
      testMetric?: string;
      autoGenerate?: boolean;
    };
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
    if (!creative) return NextResponse.json({ error: "元クリエイティブが見つかりません。" }, { status: 404 });

    const verdict = body.verdict || "pivot";
    const nextAction = body.nextAction || "前回と異なるHookと訴求で再テストする";
    const hook = body.changedHook || (
      verdict === "continue"
        ? (creative.hook || "この商品の別の使い方、知っていますか？")
        : "前の広告とは違う視点で、この商品を見てください。"
    );
    const angle = body.changedAngle || (
      verdict === "continue" ? "同一訴求の別Hook" : "前回と異なる顧客課題・訴求"
    );

    const { data: nextCreative, error: nextCreativeError } = await db.from("creatives").insert({
      product_id: creative.product_id,
      plan_id: creative.plan_id,
      user_id: user.id,
      title: String(creative.title || "Next Creative") + " / Iteration",
      variation: "operator-" + verdict,
      hook,
      scenario: {
        type: "iterative_ad",
        source_creative_id: creative.id,
        verdict,
        angle,
        next_action: nextAction,
        test_metric: body.testMetric || "CTR / CVR / ROAS",
        scenes: [
          { order: 1, role: "hook", text: hook },
          { order: 2, role: "problem", text: "前回と異なる顧客課題を具体化する" },
          { order: 3, role: "solution", text: "商品による解決を実演する" },
          { order: 4, role: "proof", text: "確認可能な事実・使用感だけを示す" },
          { order: 5, role: "cta", text: "次の行動を1つだけ提示する" }
        ]
      },
      status: "planned"
    }).select("id,title,hook,scenario").single();
    if (nextCreativeError || !nextCreative) throw new Error(nextCreativeError?.message || "次のクリエイティブ作成に失敗しました。");

    const { data: nextPost, error: nextPostError } = await db.from("social_posts").insert({
      creative_id: nextCreative.id,
      user_id: user.id,
      network: post.network,
      status: "scheduled",
      caption: post.caption,
      metadata: {
        source_social_post_id: post.id,
        source_creative_id: creative.id,
        operator_verdict: verdict,
        iteration_angle: angle,
        test_metric: body.testMetric || "CTR / CVR / ROAS"
      }
    }).select("id,network,status").single();
    if (nextPostError || !nextPost) throw new Error(nextPostError?.message || "次の投稿レコード作成に失敗しました。");

    let video = null;
    if (body.autoGenerate !== false) {
      const prompt = makePrompt({
        title: String(nextCreative.title || creative.title || "広告"),
        originalHook: String(creative.hook || ""),
        changedAngle: angle,
        changedHook: hook,
        nextAction,
        network: post.network,
      });

      const { data: job, error: jobError } = await db.from("production_jobs").insert({
        user_id: user.id,
        social_post_id: nextPost.id,
        creative_id: nextCreative.id,
        provider: "higgsfield",
        model: process.env.HF_VIDEO_MODEL || "alibaba/wan-3.0/text-to-video",
        status: "queued",
        prompt,
        duration: 5,
        resolution: "1080p",
        aspect_ratio: "9:16",
        generate_audio: false
      }).select("id").single();
      if (jobError || !job) throw new Error(jobError?.message || "動画生成ジョブの作成に失敗しました。");
      jobId = job.id;

      const started = await generateHiggsfieldVideo({
        prompt,
        duration: 5,
        resolution: "1080p",
        aspectRatio: "9:16",
        generateAudio: false
      });
      const requestId = String(started.request_id ?? started.requestId ?? started.id ?? "");
      if (!requestId) throw new Error("Higgsfieldからrequest_idを取得できませんでした。");

      await db.from("production_jobs").update({
        status: "running",
        request_id: requestId,
        provider_response: started,
        started_at: new Date().toISOString()
      }).eq("id", jobId).eq("user_id", user.id);

      video = { jobId, requestId, status: "running" };
    }

    const { data: run, error: runError } = await db.from("operator_runs").insert({
      product_id: creative.product_id,
      user_id: user.id,
      run_type: "next_creative",
      status: "completed",
      input: { source_social_post_id: post.id, source_creative_id: creative.id, verdict },
      output: { next_creative_id: nextCreative.id, next_social_post_id: nextPost.id, video, angle, hook, nextAction },
      started_at: new Date().toISOString(),
      completed_at: new Date().toISOString()
    }).select("id").single();
    if (runError) throw runError;

    return NextResponse.json({
      ok: true,
      runId: run.id,
      creative: nextCreative,
      socialPost: nextPost,
      video
    }, { status: 201 });
  } catch (error) {
    if (jobId) {
      try {
        const db = getAdminSupabase();
        await db.from("production_jobs").update({
          status: "failed",
          error: error instanceof Error ? error.message : "動画生成開始に失敗しました。",
          completed_at: new Date().toISOString()
        }).eq("id", jobId);
      } catch {}
    }
    console.error("next creative error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "次の広告生成に失敗しました。" }, { status: 500 });
  }
}
