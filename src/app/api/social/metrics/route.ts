import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { decryptLinkedInToken, getLinkedInMemberPostAnalytics } from "@/lib/linkedin";
import { getTikTokVideoMetrics, resolveTikTokVideoId } from "@/lib/social/tiktok";
import { getInstagramReelMetrics, getFacebookReelMetrics } from "@/lib/social/meta";
import { getYouTubeVideoStatus } from "@/lib/social/youtube";
import { getXPostMetrics } from "@/lib/social/x";

export const runtime = "nodejs";
export const maxDuration = 60;

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

function tiktokMetric(raw: any): NormalizedMetrics {
  const m = raw || {};
  return {
    impressions: 0,
    views: num(m.view_count),
    likes: num(m.like_count),
    comments: num(m.comment_count),
    shares: num(m.share_count),
    saves: 0,
    clicks: 0,
    conversions: 0, revenue: 0, grossProfit: 0, adSpend: 0,
  };
}

function instagramMetric(raw: any): NormalizedMetrics {
  return {
    impressions: num(raw?.impressions ?? raw?.reach),
    views: num(raw?.views ?? raw?.plays ?? raw?.video_views),
    likes: num(raw?.like_count),
    comments: num(raw?.comments_count),
    shares: num(raw?.shares),
    saves: num(raw?.saved ?? raw?.saves),
    clicks: 0,
    conversions: 0, revenue: 0, grossProfit: 0, adSpend: 0,
  };
}

function facebookMetric(raw: any): NormalizedMetrics {
  const likes = raw?.likes?.summary?.total_count ?? raw?.likes?.data?.length ?? raw?.like_count;
  const comments = raw?.comments?.summary?.total_count ?? raw?.comments?.data?.length ?? raw?.comment_count;
  const shares = raw?.shares?.count ?? raw?.share_count;
  return {
    impressions: 0,
    views: num(raw?.views ?? raw?.view_count),
    likes: num(likes),
    comments: num(comments),
    shares: num(shares),
    saves: 0,
    clicks: 0,
    conversions: 0, revenue: 0, grossProfit: 0, adSpend: 0,
  };
}

function youtubeMetric(raw: any): NormalizedMetrics {
  const s = raw?.statistics || {};
  return {
    impressions: 0,
    views: num(s.viewCount),
    likes: num(s.likeCount),
    comments: num(s.commentCount),
    shares: 0,
    saves: 0,
    clicks: 0,
    conversions: 0, revenue: 0, grossProfit: 0, adSpend: 0,
  };
}

function xMetric(raw: any): NormalizedMetrics {
  const m = raw?.organicMetrics || raw?.publicMetrics || {};
  return {
    impressions: num(m.impression_count),
    views: 0,
    likes: num(m.like_count),
    comments: num(m.reply_count),
    shares: num(m.retweet_count ?? m.quote_count),
    saves: num(m.bookmark_count),
    clicks: 0,
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
    } else if (post.network === "tiktok") {
      const resolved = await resolveTikTokVideoId(post.external_post_id);
      raw = await getTikTokVideoMetrics(resolved.videoId);
      normalized = tiktokMetric(raw);
    } else if (post.network === "instagram") {
      raw = await getInstagramReelMetrics(post.external_post_id);
      normalized = instagramMetric(raw);
    } else if (post.network === "facebook") {
      raw = await getFacebookReelMetrics(post.external_post_id);
      normalized = facebookMetric(raw);
    } else if (post.network === "youtube") {
      raw = await getYouTubeVideoStatus(post.external_post_id);
      normalized = youtubeMetric(raw);
    } else if (post.network === "x") {
      raw = await getXPostMetrics(post.external_post_id);
      normalized = xMetric(raw);
    } else {
      return NextResponse.json({ ok: false, supported: ["linkedin","tiktok","instagram","facebook","youtube","x"], error: `${post.network} の自動実績取得は未対応です。` }, { status: 501 });
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
