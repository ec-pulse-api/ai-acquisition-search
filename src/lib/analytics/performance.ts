export type NormalizedPerformance = {
  platform: "x" | "youtube" | "tiktok" | "instagram" | "facebook";
  postId: string;
  url?: string;
  collectedAt: string;
  metrics: {
    views?: number | null;
    impressions?: number | null;
    likes?: number | null;
    comments?: number | null;
    shares?: number | null;
    clicks?: number | null;
    watchTimeSeconds?: number | null;
  };
  raw: unknown;
};

export async function normalizeXPerformance(input: any): Promise<NormalizedPerformance> {
  const m = input?.publicMetrics ?? {};
  return {
    platform: "x",
    postId: String(input.postId),
    url: `https://x.com/i/web/status/${input.postId}`,
    collectedAt: new Date().toISOString(),
    metrics: {
      impressions: m.impression_count ?? null,
      likes: m.like_count ?? null,
      comments: m.reply_count ?? null,
      shares: m.retweet_count ?? null,
      clicks: m.url_link_clicks ?? null,
    },
    raw: input,
  };
}

export async function normalizeYouTubePerformance(input: any): Promise<NormalizedPerformance> {
  const s = input?.statistics ?? {};
  return {
    platform: "youtube",
    postId: String(input.videoId),
    url: `https://www.youtube.com/watch?v=${input.videoId}`,
    collectedAt: new Date().toISOString(),
    metrics: {
      views: s.viewCount != null ? Number(s.viewCount) : null,
      likes: s.likeCount != null ? Number(s.likeCount) : null,
      comments: s.commentCount != null ? Number(s.commentCount) : null,
    },
    raw: input,
  };
}
