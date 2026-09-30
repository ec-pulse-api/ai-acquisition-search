import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/billing";
import { generateHiggsfieldVideo } from "@/lib/video/higgsfield";

export const runtime = "nodejs";
export const maxDuration = 300;

function baseUrl() {
  const productionUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!productionUrl) {
    throw new Error("VERCEL_PROJECT_PRODUCTION_URL is required for operator-loop internal requests.");
  }
  return productionUrl.replace(/^https?:\/\//, "");
}

async function internalRequest(
  method: "GET" | "POST",
  path: string,
  userId: string,
  body?: Record<string, unknown>,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "x-internal-secret": process.env.CRON_SECRET || "",
    "x-internal-user-id": userId,
  };

  // Production can be protected by Vercel Authentication. In that case,
  // server-to-server calls must use Vercel's automation bypass header when
  // configured; otherwise a 302/HTML response could be mistaken for success.
  if (process.env.VERCEL_AUTOMATION_BYPASS_SECRET) {
    headers["x-vercel-protection-bypass"] = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  }

  const response = await fetch(`https://${baseUrl()}${path}`, {
    method,
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
    cache: "no-store",
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    throw new Error(
      `Internal operator request was redirected (HTTP ${response.status}). Check Vercel Deployment Protection and VERCEL_AUTOMATION_BYPASS_SECRET.`,
    );
  }

  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function publishCompletedVideo(
  db: ReturnType<typeof getAdminSupabase>,
  userId: string,
  socialPostId: string,
  videoUrl: string,
) {
  const { data: nextPost } = await db.from("social_posts")
    .select("id,network,caption,status,metadata")
    .eq("id", socialPostId)
    .eq("user_id", userId)
    .maybeSingle();

  if (!nextPost) return { ok: false, skipped: true, reason: "next social post not found" };
  if (!["tiktok","instagram","facebook","youtube","x","linkedin"].includes(nextPost.network)) {
    return { ok: false, skipped: true, reason: `unsupported network: ${nextPost.network}` };
  }

  const { data: existing } = await db.from("social_posts")
    .select("id,status,external_post_id")
    .eq("user_id", userId)
    .or(`metadata->>sourceSocialPostId.eq.${nextPost.id},metadata->>source_social_post_id.eq.${nextPost.id}`)
    .eq("network", nextPost.network)
    .limit(1);

  if (existing?.[0]?.external_post_id) {
    return { ok: true, skipped: true, reason: "already published", postId: existing[0].id };
  }

  const result = await internalRequest("POST", "/api/social/publish", userId, {
    socialPostId: nextPost.id,
    videoUrl,
    caption: nextPost.caption || "AI-generated acquisition creative",
    platforms: [nextPost.network],
  });

  if (result.status < 200 || result.status >= 300) {
    return { ok: false, status: result.status, error: result.payload?.error };
  }

  const published = Array.isArray(result.payload?.results)
    ? result.payload.results.filter((item: any) => item?.ok)
    : [];

  if (published.length > 0) {
    await db.from("social_posts").update({
      status: "published",
      metadata: {
        ...(nextPost.metadata || {}),
        auto_published_at: new Date().toISOString(),
        auto_publish_result: result.payload,
      },
      updated_at: new Date().toISOString(),
    }).eq("id", nextPost.id).eq("user_id", userId);
  }

  return { ok: published.length > 0, status: result.status, result: result.payload };
}

export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response("Unauthorized", { status: 401 });
  }

  const db = getAdminSupabase();
  const evaluationDelayHours = Math.max(6, Number(process.env.OPERATOR_EVALUATION_DELAY_HOURS || 12));
  const cutoff = new Date(Date.now() - evaluationDelayHours * 60 * 60 * 1000).toISOString();
  const results: unknown[] = [];

  const { data: posts, error } = await db
    .from("social_posts")
    .select("id,user_id,network,published_at,external_post_id,metadata")
    .eq("status", "published")
    .not("external_post_id", "is", null)
    .lt("published_at", cutoff)
    .order("published_at", { ascending: true })
    .limit(50);

  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });

  // 投稿単位で処理する。ユーザー単位で1件に制限しない。
  for (const post of posts || []) {
    if (!post.user_id) continue;

    try {
      const postMetadata = post.metadata && typeof post.metadata === "object"
        ? post.metadata as Record<string, unknown>
        : {};
      const patrolStatus = String(postMetadata.operator_patrol_status || "");
      if (patrolStatus === "stopped" || patrolStatus === "superseded") {
        results.push({ postId: post.id, network: post.network, step: "patrol-skip", reason: patrolStatus });
        continue;
      }

      const { data: latestMetric } = await db
        .from("post_metrics")
        .select("measured_at")
        .eq("social_post_id", post.id)
        .order("measured_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (latestMetric?.measured_at && new Date(latestMetric.measured_at).getTime() > Date.now() - Math.max(6, evaluationDelayHours - 1) * 60 * 60 * 1000) {
        continue;
      }

      const metrics = await internalRequest("POST", "/api/social/metrics", post.user_id, {
        socialPostId: post.id,
      });
      if (metrics.status < 200 || metrics.status >= 300) {
        results.push({ postId: post.id, network: post.network, step: "metrics", status: metrics.status, error: metrics.payload?.error });
        continue;
      }

      const decision = await internalRequest("POST", "/api/operator/ai-decision", post.user_id, {
        socialPostId: post.id,
      });
      if (decision.status < 200 || decision.status >= 300) {
        results.push({ postId: post.id, network: post.network, step: "decision", status: decision.status, error: decision.payload?.error });
        continue;
      }

      if (decision.payload?.verdict === "stop") {
        await db.from("social_posts").update({
          metadata: {
            ...postMetadata,
            operator_patrol_status: "stopped",
            operator_patrol_stopped_at: new Date().toISOString(),
            operator_patrol_verdict: "stop",
            operator_patrol_reason: decision.payload?.reason || null,
          },
          updated_at: new Date().toISOString(),
        }).eq("id", post.id).eq("user_id", post.user_id);

        results.push({ postId: post.id, network: post.network, verdict: "stop", nextCreative: false, patrol: "stopped" });
        continue;
      }

      const next = await internalRequest("POST", "/api/operator/next-creative", post.user_id, {
        socialPostId: post.id,
        verdict: decision.payload?.verdict,
        nextAction: decision.payload?.nextAction,
        changedAngle: decision.payload?.changedAngle,
        changedHook: decision.payload?.changedHook,
        testMetric: decision.payload?.testMetric,
        autoGenerate: true,
      });

      if (next.status >= 200 && next.status < 300 && next.payload?.socialPost?.id) {
        await db.from("social_posts").update({
          metadata: {
            ...postMetadata,
            operator_patrol_status: "superseded",
            operator_patrol_verdict: decision.payload?.verdict || null,
            operator_patrol_next_post_id: next.payload.socialPost.id,
            operator_patrol_advanced_at: new Date().toISOString(),
          },
          updated_at: new Date().toISOString(),
        }).eq("id", post.id).eq("user_id", post.user_id);
      }

      results.push({
        postId: post.id,
        network: post.network,
        verdict: decision.payload?.verdict,
        nextCreative: next.status >= 200 && next.status < 300,
        nextStatus: next.status,
        nextCreativeId: next.payload?.creative?.id,
        nextSocialPostId: next.payload?.socialPost?.id,
        videoJobId: next.payload?.video?.jobId,
        reused: next.payload?.reused === true,
        error: next.status >= 300 ? next.payload?.error : undefined,
      });
    } catch (error) {
      results.push({
        postId: post.id,
        network: post.network,
        step: "post-loop",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Higgsfieldの未完了ジョブを回収し、完成したらそのままSNSへ投稿する。
  const { data: jobs } = await db.from("production_jobs")
    .select("id,user_id,social_post_id,status,request_id,prompt,duration,resolution,aspect_ratio,model,generate_audio,provider_response,error,created_at,started_at")
    .in("status", ["queued","running","failed","completed"])
    .order("created_at", { ascending: true })
    .limit(30);

  for (const job of jobs || []) {
    if (!job.user_id) continue;

    let claimed = false;
    try {
      const providerResponse = (job.provider_response && typeof job.provider_response === "object")
        ? job.provider_response as Record<string, unknown>
        : {};
      const retryCount = Number(providerResponse.retry_count || 0);

      // 外部API呼び出し後にWorkerがDB更新前で落ちると、Higgsfield側では
      // 生成が進行している可能性がある。Higgsfieldに汎用idempotency keyを
      // 付けられることを確認できないため、自動再送はせず手動復旧対象にする。
      if (job.status === "running" && !job.request_id) {
        const startedAt = job.started_at ? new Date(job.started_at).getTime() : 0;
        if (startedAt && startedAt < Date.now() - 15 * 60 * 1000) {
          await db.from("production_jobs")
            .update({
              status: "failed",
              error: "Higgsfield開始後にrequest_id保存前でWorkerが停止した可能性があります。外部生成の有無を確認してから再実行してください。",
              provider_response: {
                ...providerResponse,
                manual_recovery_required: true,
                manual_recovery_marked_at: new Date().toISOString(),
              },
              updated_at: new Date().toISOString(),
            })
            .eq("id", job.id)
            .eq("user_id", job.user_id)
            .eq("status", "running")
            .is("request_id", null);
        }
        continue;
      }

      if (job.status === "failed" && providerResponse.manual_recovery_required === true) {
        results.push({ jobId: job.id, step: "video-retry", status: "manual-recovery-required" });
        continue;
      }

      // 生成済み動画のSNS投稿だけが失敗した場合も再巡回する。
      // /api/social/publish 側の予約・一意制約で二重投稿を防ぐ。
      if (job.status === "completed" && job.social_post_id) {
        const { data: asset } = await db.from("video_assets")
          .select("video_url")
          .eq("production_job_id", job.id)
          .maybeSingle();
        if (!asset?.video_url) {
          results.push({ jobId: job.id, step: "video-publish", status: "completed-without-asset" });
          continue;
        }
        const publish = await publishCompletedVideo(db, job.user_id, job.social_post_id, asset.video_url);
        results.push({
          jobId: job.id,
          step: "video-publish-retry",
          status: "completed",
          published: publish.ok,
          publishResult: publish,
        });
        continue;
      }

      // failed / queued はDB上でrunningへ原子的にclaimする。
      // claimに勝ったCronだけがHiggsfield APIを呼ぶ。
      if (job.status === "failed" || (job.status === "queued" && !job.request_id)) {
        if (job.status === "failed" && retryCount >= 2) {
          results.push({ jobId: job.id, step: "video-retry", status: "exhausted", retryCount });
          continue;
        }

        const claimTime = new Date().toISOString();
        // 外部Higgsfield APIへの試行回数をclaim時点で確定する。
        // API開始失敗でも回数を残し、Cronごとの無限再試行を防ぐ。
        const attemptCount = job.status === "failed" ? retryCount + 1 : 1;
        const claimResponse = {
          ...providerResponse,
          operator_claimed_at: claimTime,
          retry_count: attemptCount,
        };
        const { data: claim, error: claimError } = await db.from("production_jobs")
          .update({
            status: "running",
            started_at: claimTime,
            error: null,
            provider_response: claimResponse,
            updated_at: claimTime,
          })
          .eq("id", job.id)
          .eq("user_id", job.user_id)
          .eq("status", job.status)
          .select("id")
          .maybeSingle();

        if (claimError) throw claimError;
        if (!claim) {
          results.push({ jobId: job.id, step: "video-claim", status: "skipped", reason: "another worker claimed this job" });
          continue;
        }
        claimed = true;

        const started = await generateHiggsfieldVideo({
          prompt: String(job.prompt || ""),
          duration: Number(job.duration || 5),
          resolution: (String(job.resolution || "1080p") as "480p" | "720p" | "1080p"),
          aspectRatio: (String(job.aspect_ratio || "9:16") as "16:9" | "4:3" | "1:1" | "3:4" | "9:16" | "adaptive"),
          model: job.model ? String(job.model) : undefined,
          generateAudio: job.generate_audio === true,
        });
        const requestId = String(started.request_id ?? started.requestId ?? started.id ?? "");
        if (!requestId) throw new Error("Higgsfield開始からrequest_idを取得できませんでした。");

        const now = new Date().toISOString();
        await db.from("production_jobs").update({
          status: "running",
          request_id: requestId,
          provider_response: {
            ...claimResponse,
            retry_count: attemptCount,
            started_response: started,
          },
          error: null,
          started_at: now,
          completed_at: null,
          updated_at: now,
        }).eq("id", job.id).eq("user_id", job.user_id).eq("status", "running");

        results.push({
          jobId: job.id,
          step: job.status === "failed" ? "video-retry" : "video-start",
          status: "running",
          retryCount: job.status === "failed" ? retryCount + 1 : retryCount,
          requestId,
        });
        continue;
      }

      const polled = await internalRequest("GET", `/api/video/jobs/${job.id}`, job.user_id);
      const asset = polled.payload?.asset;

      if (polled.status >= 200 && polled.status < 300 && asset?.video_url && polled.payload?.job?.status === "completed" && job.social_post_id) {
        const publish = await publishCompletedVideo(db, job.user_id, job.social_post_id, asset.video_url);
        results.push({
          jobId: job.id,
          step: "video-publish",
          status: polled.payload?.job?.status,
          published: publish.ok,
          publishResult: publish,
        });
      } else {
        results.push({
          jobId: job.id,
          step: "video-poll",
          status: polled.payload?.job?.status || polled.status,
        });
      }
    } catch (error) {
      if (claimed) {
        await db.from("production_jobs").update({
          status: "failed",
          error: error instanceof Error ? error.message : String(error),
          updated_at: new Date().toISOString(),
        }).eq("id", job.id).eq("user_id", job.user_id).eq("status", "running");
      }
      results.push({
        jobId: job.id,
        step: "video-poll",
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checked: posts?.length || 0,
    processed: results.length,
    results,
    ranAt: new Date().toISOString(),
  });
}
