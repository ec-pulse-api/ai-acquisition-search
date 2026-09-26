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


export async function normalizeTikTokPerformance(input: any): Promise<NormalizedPerformance> {
  return {
    platform: "tiktok",
    postId: String(input.id),
    url: input.share_url,
    collectedAt: new Date().toISOString(),
    metrics: {
      views: input.view_count ?? null,
      likes: input.like_count ?? null,
      comments: input.comment_count ?? null,
      shares: input.share_count ?? null,
    },
    raw: input,
  };
}

export async function normalizeInstagramPerformance(input: any): Promise<NormalizedPerformance> {
  const m = input?.metrics ?? input ?? {};
  const get = (name: string) => {
    const item = Array.isArray(input?.data) ? input.data.find((x: any) => x.name === name) : undefined;
    return item?.values?.at?.(-1)?.value ?? m[name] ?? null;
  };
  return {
    platform: "instagram",
    postId: String(input.id ?? input.mediaId),
    url: input.permalink,
    collectedAt: new Date().toISOString(),
    metrics: {
      views: get("views") ?? get("plays"),
      likes: get("likes"),
      comments: get("comments"),
      shares: get("shares"),
    },
    raw: input,
  };
}

export async function normalizeFacebookPerformance(input: any): Promise<NormalizedPerformance> {
  const s = input?.statistics ?? input ?? {};
  return {
    platform: "facebook",
    postId: String(input.id ?? input.videoId),
    url: input.permalink_url,
    collectedAt: new Date().toISOString(),
    metrics: {
      views: s.views ?? s.total_video_views ?? null,
      likes: s.likes ?? s.reactions?.summary?.total_count ?? null,
      comments: s.comments ?? s.comments_count ?? null,
      shares: s.shares ?? s.share_count ?? null,
    },
    raw: input,
  };
}
