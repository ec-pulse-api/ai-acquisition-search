export type SocialSignal = {
  platform: "tiktok";
  title: string;
  url: string;
  author: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  description: string;
  query: string;
};

function numberValue(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function firstString(...values: unknown[]): string {
  return values.find((value) => typeof value === "string" && value.trim()) as string || "";
}

export async function searchTikTokSignals(query: string, limit = 10): Promise<SocialSignal[]> {
  const apiKey = process.env.SCRAPE_CREATORS_API_KEY;
  if (!apiKey || !query.trim()) return [];

  const endpoint = new URL("https://api.scrapecreators.com/v1/tiktok/search/keyword");
  endpoint.searchParams.set("query", query.trim().slice(0, 100));
  endpoint.searchParams.set("date_posted", process.env.SCRAPE_CREATORS_DATE_POSTED || "this-month");
  endpoint.searchParams.set("sort_by", "most-liked");
  endpoint.searchParams.set("region", process.env.SCRAPE_CREATORS_REGION || "JP");
  endpoint.searchParams.set("trim", "true");

  const response = await fetch(endpoint, {
    headers: { "x-api-key": apiKey, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return [];

  const payload = await response.json() as Record<string, unknown>;
  const raw = Array.isArray(payload.search_item_list)
    ? payload.search_item_list
    : Array.isArray(payload.aweme_list)
      ? payload.aweme_list
      : [];

  return raw.slice(0, limit).map((item) => {
    const aweme = (item as Record<string, unknown>).aweme_info as Record<string, unknown> || item as Record<string, unknown>;
    const stats = (aweme.statistics || aweme.stats || {}) as Record<string, unknown>;
    const author = (aweme.author || {}) as Record<string, unknown>;
    const desc = firstString(aweme.desc, aweme.description, (item as Record<string, unknown>).desc);
    const id = firstString(aweme.aweme_id, aweme.id, (item as Record<string, unknown>).aweme_id);
    return {
      platform: "tiktok" as const,
      title: desc || "TikTok投稿",
      url: id ? "https://www.tiktok.com/@"+firstString(author.unique_id, author.nickname)+"/video/"+id : "https://www.tiktok.com/",
      author: firstString(author.unique_id, author.nickname, "unknown"),
      views: numberValue(stats.play_count ?? stats.views),
      likes: numberValue(stats.digg_count ?? stats.likes),
      comments: numberValue(stats.comment_count ?? stats.comments),
      shares: numberValue(stats.share_count ?? stats.shares),
      description: desc,
      query,
    };
  });
}

export async function discoverSocialSignals(productName: string): Promise<SocialSignal[]> {
  const base = productName.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!base) return [];
  const queries = [base, base + " おすすめ", base + " コーデ", base + " レビュー"];
  const groups = await Promise.all(queries.map((query) => searchTikTokSignals(query, 5).catch(() => [])));
  return groups.flat().filter((item, index, all) =>
    all.findIndex((x) => x.title === item.title && x.author === item.author) === index
  ).slice(0, 15);
}
