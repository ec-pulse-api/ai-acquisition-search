import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
const DEFAULT_MODEL = process.env.HF_VIDEO_MODEL ?? "alibaba/wan-3.0/text-to-video";

function hfCredentials() {
  const id = process.env.HF_API_KEY_ID;
  const secret = process.env.HF_API_KEY_SECRET;
  if (!id || !secret) throw new Error("Higgsfield API credentials are not configured.");
  return `Key ${id}:${secret}`;
}

async function hfRequest(path: string, init: RequestInit) {
  const response = await fetch(`https://api.higgsfield.ai/${path.replace(/^\\/+|\\/+$/g, "")}`, {
    ...init,
    headers: { Authorization: hfCredentials(), "Content-Type": "application/json", ...(init.headers ?? {}) }
  });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text }; }
  if (!response.ok) throw new Error(`Higgsfield API error ${response.status}: ${JSON.stringify(data)}`);
  return data as Record<string, any>;
}

async function generateHiggsfieldVideo(input: {
  prompt: string; model?: string; duration: number; resolution: string; aspectRatio: string; generateAudio: boolean;
}) {
  const model = input.model ?? DEFAULT_MODEL;
  return hfRequest(model, {
    method: "POST",
    body: JSON.stringify({
      prompt: input.prompt,
      duration: input.duration,
      resolution: input.resolution,
      aspect_ratio: input.aspectRatio,
      generate_audio: input.generateAudio,
      enable_thinking: false
    })
  });
}

function extractVideoUrl(result: Record<string, any>) {
  const direct = result.video?.url;
  if (typeof direct === "string" && /^https?:/i.test(direct)) return direct;
  for (const job of Array.isArray(result.jobs) ? result.jobs : []) {
    const raw = job?.results?.raw;
    if (typeof raw === "string" && /^https?:/i.test(raw)) return raw;
    if (typeof raw?.url === "string" && /^https?:/i.test(raw.url)) return raw.url;
  }
  return undefined;
}

async function waitForHiggsfieldVideo(requestId: string, timeoutMs = 15 * 60_000) {
  const started = Date.now();
  let delay = 2000;
  while (Date.now() - started < timeoutMs) {
    const result = await hfRequest(`requests/${encodeURIComponent(requestId)}/status`, { method: "GET" });
    const status = String(result.status ?? "");
    if (status === "completed") {
      const videoUrl = extractVideoUrl(result);
      if (!videoUrl) throw new Error("Higgsfield completed but video URL was not returned.");
      return { ...result, videoUrl };
    }
    if (status === "failed" || status === "nsfw") throw new Error(`Higgsfield generation ${status}`);
    await new Promise(resolve => setTimeout(resolve, delay));
    delay = Math.min(Math.round(delay * 1.5), 10000);
  }
  throw new Error("Higgsfield generation timed out.");
}

async function saveVideoToStorage(input: { userId: string; jobId: string; sourceUrl: string }) {
  const response = await fetch(input.sourceUrl);
  if (!response.ok) throw new Error(`動画取得に失敗しました: HTTP ${response.status}`);
  const contentType = response.headers.get("content-type") || "video/mp4";
  const arrayBuffer = await response.arrayBuffer();
  if (!arrayBuffer.byteLength) throw new Error("取得した動画ファイルが空です。");
  const ext = contentType.includes("webm") ? "webm" : "mp4";
  const path = `${input.userId}/${input.jobId}.${ext}`;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceRole) throw new Error("Supabase Storage is not configured.");
  const supabase = createClient(url, serviceRole, { auth: { autoRefreshToken: false, persistSession: false } });
  const { error } = await supabase.storage.from("video-assets").upload(path, arrayBuffer, {
    contentType, upsert: true, cacheControl: "31536000"
  });
  if (error) throw new Error(`Supabase Storage upload failed: ${error.message}`);
  const { data } = supabase.storage.from("video-assets").getPublicUrl(path);
  return { bucket: "video-assets", path, url: data.publicUrl, bytes: arrayBuffer.byteLength, contentType };
}

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
