import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { consumeMonthlyUsage, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";
export const maxDuration = 60;

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Supabase configuration is incomplete.");
  return {
    admin: createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })
  };
}

export async function POST(request: Request) {
  let jobId = "";
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    if (prompt.length > 10000) return NextResponse.json({ error: "prompt is too long" }, { status: 400 });

    const model = body.model ? String(body.model) : undefined;
    const duration = Number(body.duration ?? 5);
    if (!Number.isFinite(duration) || duration <= 0 || duration > 60) return NextResponse.json({ error: "duration must be between 0 and 60 seconds" }, { status: 400 });
    const resolution = body.resolution === "480p" || body.resolution === "720p" || body.resolution === "1080p" ? body.resolution : "1080p";
    const aspectRatio = ["16:9","4:3","1:1","3:4","9:16","adaptive"].includes(body.aspectRatio) ? body.aspectRatio : "9:16";
    const generateAudio = Boolean(body.generateAudio ?? false);
    const socialPostId = body.socialPostId ? String(body.socialPostId) : null;
    const { admin } = clients();

    let creativeId: string | null = null;
    if (socialPostId) {
      const { data: post, error } = await admin.from("social_posts").select("id,creative_id").eq("id", socialPostId).eq("user_id", user.id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!post) throw new Error("指定されたsocial postが見つかりません。");
      creativeId = post.creative_id;
    }

    const usage = await consumeMonthlyUsage(user.id, "video_generation", 5);
    if (!usage.allowed) return NextResponse.json({ error: `今月の無料動画生成回数（${usage.limit}回）を使い切りました。Proへアップグレードしてください。`, usage }, { status: 429 });


    const { data: job, error: jobError } = await admin.from("production_jobs").insert({
      user_id: user.id,
      social_post_id: socialPostId,
      creative_id: creativeId,
      provider: "higgsfield",
      model: model ?? process.env.HF_VIDEO_MODEL ?? "alibaba/wan-3.0/text-to-video",
      status: "queued",
      prompt,
      duration,
      resolution,
      aspect_ratio: aspectRatio,
      generate_audio: generateAudio
    }).select("id").single();

    if (jobError || !job) throw new Error(jobError?.message || "production jobの作成に失敗しました。");
    jobId = job.id;



    return NextResponse.json({
      ok: true,
      jobId,
      status: "queued",
      message: "動画生成Jobをキューに入れました。Workerがバックグラウンドで生成します。"
    }, { status: 202 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "動画生成の開始に失敗しました。";
    if (jobId) {
      try {
        const { admin } = clients();
        await admin.from("production_jobs").update({ status: "failed", error: message, completed_at: new Date().toISOString() }).eq("id", jobId);
      } catch {}
    }
    return NextResponse.json({ error: message, jobId: jobId || undefined }, { status: 500 });
  }
}

function postErrorOr(post: any, error: any) {
  return Boolean(error) || !post;
}
