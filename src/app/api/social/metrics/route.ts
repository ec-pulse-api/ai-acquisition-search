import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { decryptLinkedInToken, getLinkedInMemberPostAnalytics } from "@/lib/linkedin";

export const runtime = "nodejs";

type NormalizedMetrics = {
  impressions: number; views: number; likes: number; comments: number; shares: number;
  saves: number; clicks: number; conversions: number; revenue: number; grossProfit: number; adSpend: number;
};

const num = (v: unknown) => typeof v === "number" && Number.isFinite(v) ? v : Number(v || 0);

function linkedinMetric(raw: any): NormalizedMetrics {
  const metric = Array.isArray(raw?.elements) ? (raw.elements[0]?.total || raw.elements[0] || {}) : (raw?.total || raw || {});
  return {
    impressions: num(metric.IMPRESSION ?? metric.impression),
    views: 0,
    likes: num(metric.REACTION ?? metric.reaction),
    comments: num(metric.COMMENT ?? metric.comment),
    shares: num(metric.RESHARE ?? metric.reshare),
    saves: num(metric.POST_SAVE ?? metric.postSave),
    clicks: num(metric.LINK_CLICKS ?? metric.linkClicks),
    conversions: 0, revenue: 0, grossProfit: 0, adSpend: 0,
  };
}

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    const body = await request.json() as { socialPostId?: string };
    if (!body.socialPostId) return NextResponse.json({ error: "socialPostIdが必要です。" }, { status: 400 });

    const db = getAdminSupabase();
    const { data: post, error: postError } = await db.from("social_posts")
      .select("id,user_id,network,external_post_id,creative_id,published_at")
      .eq("id", body.socialPostId).eq("user_id", user.id).maybeSingle();
    if (postError) throw postError;
    if (!post) return NextResponse.json({ error: "対象投稿が見つかりません。" }, { status: 404 });
    if (!post.external_post_id) return NextResponse.json({ error: "外部投稿IDがまだありません。" }, { status: 400 });

    let normalized: NormalizedMetrics;
    let raw: unknown;

    if (post.network === "linkedin") {
      const { data: account, error } = await db.from("linkedin_accounts")
        .select("access_token_encrypted,expires_at").eq("user_id", user.id).maybeSingle();
      if (error) throw error;
      if (!account) return NextResponse.json({ error: "LinkedInを先に接続してください。" }, { status: 400 });
      if (account.expires_at && new Date(account.expires_at).getTime() <= Date.now()) {
        return NextResponse.json({ error: "LinkedInアクセストークンの有効期限が切れています。再接続してください。" }, { status: 401 });
      }
      raw = await getLinkedInMemberPostAnalytics(
        decryptLinkedInToken(account.access_token_encrypted),
        post.external_post_id,
      );
      normalized = linkedinMetric(raw);
    } else {
      return NextResponse.json({
        ok: false,
        supported: ["linkedin"],
        error: `${post.network} の自動実績取得は次のAPIアダプター追加が必要です。`,
      }, { status: 501 });
    }

    const ctr = normalized.impressions > 0 ? normalized.clicks / normalized.impressions : null;
    const cvr = normalized.clicks > 0 ? normalized.conversions / normalized.clicks : null;
    const { data: metric, error: metricError } = await db.from("post_metrics").insert({
      social_post_id: post.id, ...normalized, ctr, cvr, cpa: null, roas: null,
      raw: { source: post.network, fetched_at: new Date().toISOString(), data: raw },
    }).select("id,measured_at,ctr,cvr,roas").single();
    if (metricError) throw metricError;

    return NextResponse.json({ ok: true, socialPostId: post.id, network: post.network, metric, normalized });
  } catch (error) {
    console.error("social metrics refresh error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "実績取得に失敗しました。" }, { status: 500 });
  }
}
