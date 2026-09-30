import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/billing";

export const runtime = "nodejs";
export const maxDuration = 300;

type Repair = {
  type: string;
  id?: string;
  action: string;
  status: "repaired" | "skipped" | "failed";
  detail?: string;
};

function authorized(request: Request) {
  return Boolean(process.env.CRON_SECRET) &&
    request.headers.get("authorization") === `Bearer ${process.env.CRON_SECRET}`;
}

function baseUrl() {
  const value = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (!value) throw new Error("VERCEL_PROJECT_PRODUCTION_URL is required.");
  return value.replace(/^https?:\/\//, "");
}

async function runOperatorLoop() {
  const response = await fetch(`https://${baseUrl()}/api/cron/operator-loop`, {
    method: "GET",
    headers: { Authorization: `Bearer ${process.env.CRON_SECRET}` },
    cache: "no-store",
  });
  const payload = await response.json().catch(() => ({}));
  return { status: response.status, payload };
}

async function aiSummary(input: Record<string, unknown>) {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return null;

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5-mini",
        temperature: 0,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "あなたはAI集客システムの巡回監督AIです。入力された観測結果だけを使い、状態を要約してください。存在しない障害や成功を作らないでください。JSONで summary, severity, next_check を返してください。severityはhealthy|attention|criticalのいずれかです。",
          },
          { role: "user", content: JSON.stringify(input) },
        ],
      }),
    });
    if (!response.ok) return null;
    const payload = await response.json();
    const content = payload.choices?.[0]?.message?.content;
    return content ? JSON.parse(content) : null;
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  if (!authorized(request)) return new Response("Unauthorized", { status: 401 });

  const db = getAdminSupabase();
  const checkedAt = new Date().toISOString();
  const repairs: Repair[] = [];

  let operatorLoop: { status: number; payload: any } = { status: 0, payload: null };
  try {
    operatorLoop = await runOperatorLoop();
  } catch (error) {
    repairs.push({
      type: "operator-loop",
      action: "巡回実行",
      status: "failed",
      detail: error instanceof Error ? error.message : String(error),
    });
  }

  const staleBefore = new Date(Date.now() - 30 * 60 * 1000).toISOString();
  const { data: staleJobs, error: staleJobsError } = await db
    .from("production_jobs")
    .select("id,user_id,status,request_id,provider_response,started_at")
    .eq("status", "running")
    .lt("started_at", staleBefore)
    .limit(50);

  if (staleJobsError) {
    repairs.push({
      type: "production-jobs",
      action: "staleジョブ監査",
      status: "failed",
      detail: staleJobsError.message,
    });
  } else {
    for (const job of staleJobs || []) {
      const providerResponse =
        job.provider_response && typeof job.provider_response === "object"
          ? job.provider_response as Record<string, unknown>
          : {};

      // request_idがないrunningジョブだけを安全に修復対象とする。
      // request_idがあるものは外部生成中の可能性があるため自動停止しない。
      if (!job.request_id) {
        const { error } = await db
          .from("production_jobs")
          .update({
            status: "failed",
            error: "巡回AI: Higgsfield request_id保存前に30分以上停止していたため、外部生成確認が必要な手動復旧状態へ移行しました。",
            provider_response: {
              ...providerResponse,
              patrol_repair: true,
              manual_recovery_required: true,
              patrol_repaired_at: checkedAt,
            },
            updated_at: checkedAt,
          })
          .eq("id", job.id)
          .eq("status", "running")
          .is("request_id", null);

        repairs.push({
          type: "production-job",
          id: job.id,
          action: "request_idなしのstale runningをmanual recoveryへ移行",
          status: error ? "failed" : "repaired",
          detail: error?.message,
        });
      } else {
        repairs.push({
          type: "production-job",
          id: job.id,
          action: "外部生成中の可能性があるため変更せず監視",
          status: "skipped",
        });
      }
    }
  }

  const { data: activePosts, error: postsError } = await db
    .from("social_posts")
    .select("id,user_id,status,network,metadata,published_at")
    .in("status", ["planned", "scheduled", "published"])
    .order("created_at", { ascending: false })
    .limit(100);

  const patrolCounts = {
    active: 0,
    stopped: 0,
    superseded: 0,
    unmanaged: 0,
  };

  if (!postsError) {
    for (const post of activePosts || []) {
      const metadata =
        post.metadata && typeof post.metadata === "object"
          ? post.metadata as Record<string, unknown>
          : {};
      const status = String(metadata.operator_patrol_status || "");
      if (status === "active") patrolCounts.active++;
      else if (status === "stopped") patrolCounts.stopped++;
      else if (status === "superseded") patrolCounts.superseded++;
      else patrolCounts.unmanaged++;
    }
  } else {
    repairs.push({
      type: "social-posts",
      action: "patrol chain監査",
      status: "failed",
      detail: postsError.message,
    });
  }

  const { data: recentRuns, error: runsError } = await db
    .from("operator_runs")
    .select("id,run_type,status,created_at,output")
    .order("created_at", { ascending: false })
    .limit(20);

  const loopOk = operatorLoop.status >= 200 && operatorLoop.status < 300;
  const unresolved = repairs.filter((item) => item.status === "failed").length;
  const reportInput = {
    checkedAt,
    operatorLoop: {
      ok: loopOk,
      status: operatorLoop.status,
      checked: operatorLoop.payload?.checked ?? null,
      processed: operatorLoop.payload?.processed ?? null,
    },
    patrolCounts,
    staleJobsFound: staleJobs?.length ?? 0,
    repairs,
    recentRunsCount: recentRuns?.length ?? 0,
    databaseAuditError: runsError?.message || null,
  };

  const summary = await aiSummary(reportInput);
  const severity = summary?.severity ||
    (unresolved > 0 ? "critical" : !loopOk || (staleJobs?.length ?? 0) > 0 ? "attention" : "healthy");

  const output = {
    patrol: "ai-patrol-v1",
    checkedAt,
    severity,
    summary: summary?.summary || (
      severity === "healthy"
        ? "巡回、実績監査、生成ジョブ監査に重大な異常はありません。"
        : "巡回結果に要確認項目があります。個別のrepair結果を確認してください。"
    ),
    nextCheck: summary?.next_check || "次回の定期巡回で再確認",
    operatorLoop: operatorLoop.payload,
    patrolCounts,
    repairs,
    recentRuns: recentRuns || [],
  };

  const { error: saveError } = await db.from("operator_runs").insert({
    user_id: null,
    run_type: "ai_patrol",
    status: unresolved > 0 ? "failed" : "completed",
    input: reportInput,
    output,
    started_at: checkedAt,
    completed_at: new Date().toISOString(),
  });

  // operator_runsのuser_idが必須の場合に備え、保存失敗は報告へ含める。
  if (saveError) {
    output.repairs.push({
      type: "patrol-report",
      action: "巡回レポート保存",
      status: "failed",
      detail: saveError.message,
    });
  }

  return NextResponse.json({
    ok: unresolved === 0 && loopOk,
    ...output,
  });
}
