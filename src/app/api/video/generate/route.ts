import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import {
  generateHiggsfieldVideo,
  waitForHiggsfieldVideo
} from "../../../../lib/video/higgsfield";
import { saveVideoToStorage } from "../../../../lib/video/storage";

export const runtime = "nodejs";
export const maxDuration = 800;

function clients() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anon || !serviceRole) {
    throw new Error("Supabase configuration is incomplete.");
  }
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
    const aspectRatio = body.aspectRatio === "16:9" || body.aspectRatio === "4:3" || body.aspectRatio === "1:1" || body.aspectRatio === "3:4" || body.aspectRatio === "9:16" || body.aspectRatio === "adaptive" ? body.aspectRatio : "9:16";
    const generateAudio = Boolean(body.generateAudio ?? false);
    const socialPostId = body.socialPostId ? String(body.socialPostId) : null;

    const { admin } = clients();

    let creativeId: string | null = null;
    if (socialPostId) {
      const { data: post, error: postError } = await admin
        .from("social_posts")
        .select("id,creative_id")
        .eq("id", socialPostId)
        .eq("user_id", user.id)
        .maybeSingle();
      if (postError) throw new Error(postError.message);
      if (!post) throw new Error("指定されたsocial postが見つかりません。");
      creativeId = post.creative_id;
    }

    const { data: job, error: jobError } = await admin
      .from("production_jobs")
      .insert({
        user_id: user.id,
        social_post_id: socialPostId,
        creative_id: creativeId,
        provider: "higgsfield",
        model: model ?? process.env.HF_VIDEO_MODEL ?? "alibaba/wan-3.0/text-to-video",
        status: "running",
        prompt,
        duration,
        resolution,
        aspect_ratio: aspectRatio,
        generate_audio: generateAudio,
        started_at: new Date().toISOString()
      })
      .select("id")
      .single();

    if (jobError || !job) throw new Error(jobError?.message || "production jobの作成に失敗しました。");
    jobId = job.id;

    const started = await generateHiggsfieldVideo({
      prompt,
      model,
      duration,
      resolution,
      aspectRatio,
      generateAudio
    });

    const requestId = String(started.request_id ?? started.requestId ?? started.id ?? "");
    if (!requestId) throw new Error("Higgsfieldからrequest_idを取得できませんでした。");

    await admin.from("production_jobs").update({
      request_id: requestId,
      provider_response: started
    }).eq("id", jobId).eq("user_id", user.id);

    const completed = await waitForHiggsfieldVideo(requestId);
    const stored = await saveVideoToStorage({
      userId: user.id,
      jobId,
      sourceUrl: completed.videoUrl
    });

    const { data: asset, error: assetError } = await admin
      .from("video_assets")
      .insert({
        user_id: user.id,
        production_job_id: jobId,
        creative_id: creativeId,
        social_post_id: socialPostId,
        provider: "higgsfield",
        model: model ?? process.env.HF_VIDEO_MODEL ?? "alibaba/wan-3.0/text-to-video",
        storage_bucket: stored.bucket,
        storage_path: stored.path,
        video_url: stored.url,
        prompt,
        duration,
        resolution,
        aspect_ratio: aspectRatio,
        metadata: { bytes: stored.bytes, contentType: stored.contentType, requestId }
      })
      .select("id,video_url,storage_path,provider,model,duration,resolution,aspect_ratio")
      .single();

    if (assetError || !asset) throw new Error(assetError?.message || "video assetの保存に失敗しました。");

    if (creativeId) {
      await admin.from("creatives").update({
        video_url: stored.url,
        metadata: { provider: "higgsfield", videoAssetId: asset.id, productionJobId: jobId }
      }).eq("id", creativeId).eq("user_id", user.id);
    }

    await admin.from("production_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString()
    }).eq("id", jobId).eq("user_id", user.id);

    return NextResponse.json({ ok: true, jobId, asset });
  } catch (error) {
    const message = error instanceof Error ? error.message : "動画生成に失敗しました。";
    if (jobId) {
      try {
        const { admin } = clients();
        await admin.from("production_jobs").update({
          status: "failed",
          error: message,
          completed_at: new Date().toISOString()
        }).eq("id", jobId);
      } catch {}
    }
    return NextResponse.json({ error: message, jobId: jobId || undefined }, { status: 500 });
  }
}
