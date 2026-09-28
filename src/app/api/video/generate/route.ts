import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { generateHiggsfieldVideo } from "@/lib/video/higgsfield";

export const runtime = "nodejs";
export const maxDuration = 60;

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceRole) throw new Error("Supabase configuration is incomplete.");
  return {
    auth: createClient(url, anon, { auth: { autoRefreshToken: false, persistSession: false } }),
    admin: createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } })
  };
}

async function authenticate(request: Request) {
  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) throw new Error("ログインが必要です。");
  const { auth } = clients();
  const { data, error } = await auth.auth.getUser(token);
  if (error || !data.user) throw new Error("認証セッションが無効です。");
  return data.user;
}

export async function POST(request: Request) {
  let jobId = "";
  try {
    const user = await authenticate(request);
    const body = await request.json();
    const prompt = String(body.prompt || "").trim();
    if (!prompt) return NextResponse.json({ error: "prompt is required" }, { status: 400 });

    const model = body.model ? String(body.model) : undefined;
    const duration = Number(body.duration ?? 5);
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

    const started = await generateHiggsfieldVideo({ prompt, model, duration, resolution, aspectRatio, generateAudio });
    const requestId = String(started.request_id ?? started.requestId ?? started.id ?? "");
    if (!requestId) throw new Error("Higgsfieldからrequest_idを取得できませんでした。");

    await admin.from("production_jobs").update({
      status: "running",
      request_id: requestId,
      provider_response: started,
      started_at: new Date().toISOString()
    }).eq("id", jobId).eq("user_id", user.id);

    return NextResponse.json({
      ok: true,
      jobId,
      requestId,
      status: "running",
      message: "動画生成を開始しました。バックグラウンドで完成を待機できます。"
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
