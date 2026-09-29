import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/billing";

export const runtime = "nodejs";
export const maxDuration = 300;

function baseUrl() {
  return (
    process.env.VERCEL_PROJECT_PRODUCTION_URL ||
    process.env.VERCEL_URL ||
    "ai-acquisition-search-beta.vercel.app"
  ).replace(/^https?:\/\//, "");
}

async function internalPost(path: string, userId: string, body: Record<string, unknown>) {
  const response = await fetch(`https://${baseUrl()}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-internal-secret": process.env.CRON_SECRET || "",
      "x-internal-user-id": userId,
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getAdminSupabase();
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: posts, error } = await db
    .from("social_posts")
    .select("id,user_id,network,published_at,external_post_id")
    .eq("status", "published")
    .eq("network", "linkedin")
    .not("external_post_id", "is", null)
    .lt("published_at", cutoff)
    .order("published_at", { ascending: true })
    .limit(20);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  const results: unknown[] = [];
  const processedUsers = new Set<string>();

  for (const post of posts || []) {
    if (!post.user_id || processedUsers.has(post.user_id)) continue;

    const { data: latestMetric } = await db
      .from("post_metrics")
      .select("measured_at")
      .eq("social_post_id", post.id)
      .order("measured_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (latestMetric?.measured_at && new Date(latestMetric.measured_at).getTime() > Date.now() - 23 * 60 * 60 * 1000) {
      continue;
    }

    const metrics = await internalPost("/api/social/metrics", post.user_id, {
      socialPostId: post.id,
    });
    if (metrics.status < 200 || metrics.status >= 300) {
      results.push({ postId: post.id, step: "metrics", status: metrics.status, error: metrics.payload?.error });
      continue;
    }

    const decision = await internalPost("/api/operator/ai-decision", post.user_id, {
      socialPostId: post.id,
    });
    if (decision.status < 200 || decision.status >= 300) {
      results.push({ postId: post.id, step: "decision", status: decision.status, error: decision.payload?.error });
      continue;
    }

    if (decision.payload?.verdict === "stop") {
      results.push({ postId: post.id, verdict: "stop", nextCreative: false });
      processedUsers.add(post.user_id);
      continue;
    }

    const next = await internalPost("/api/operator/next-creative", post.user_id, {
      socialPostId: post.id,
      verdict: decision.payload?.verdict,
      nextAction: decision.payload?.nextAction,
      changedAngle: decision.payload?.changedAngle,
      changedHook: decision.payload?.changedHook,
      testMetric: decision.payload?.testMetric,
      autoGenerate: true,
    });

    results.push({
      postId: post.id,
      verdict: decision.payload?.verdict,
      nextCreative: next.status >= 200 && next.status < 300,
      nextStatus: next.status,
      nextCreativeId: next.payload?.creative?.id,
      videoJobId: next.payload?.video?.jobId,
      error: next.status >= 300 ? next.payload?.error : undefined,
    });
    processedUsers.add(post.user_id);
  }

  return NextResponse.json({
    ok: true,
    checked: posts?.length || 0,
    processed: results.length,
    results,
    ranAt: new Date().toISOString(),
  });
}
