export type ShopSignal = {
  platform: "tiktok_shop";
  title: string;
  url: string;
  price: number | null;
  currency: string;
  sales: number | null;
  rating: number | null;
  reviewCount: number | null;
  seller: string;
  query: string;
};

function num(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function str(...values: unknown[]): string {
  return values.find((v) => typeof v === "string" && v.trim()) as string || "";
}

export async function searchTikTokShop(query: string, limit = 10): Promise<ShopSignal[]> {
  const key = process.env.SCRAPE_CREATORS_API_KEY;
  if (!key || !query.trim()) return [];

  const endpoint = new URL("https://api.scrapecreators.com/v1/tiktok/shop/search");
  endpoint.searchParams.set("query", query.trim().slice(0, 100));
  endpoint.searchParams.set("region", process.env.SCRAPE_CREATORS_REGION || "JP");

  const response = await fetch(endpoint, {
    headers: { "x-api-key": key, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) return [];

  const payload = await response.json() as Record<string, unknown>;
  const raw = Array.isArray(payload.products)
    ? payload.products
    : Array.isArray(payload.data)
      ? payload.data
      : Array.isArray(payload.search_item_list)
        ? payload.search_item_list
        : [];

  return raw.slice(0, limit).map((item) => {
    const x = item as Record<string, unknown>;
    const seller = (x.seller || x.shop || {}) as Record<string, unknown>;
    return {
      platform: "tiktok_shop" as const,
      title: str(x.title, x.product_name, x.name) || "TikTok Shop商品",
      url: str(x.url, x.product_url, x.product_link),
      price: num(x.price ?? x.sale_price),
      currency: str(x.currency) || "JPY",
      sales: num(x.sales ?? x.sold_count ?? x.sales_count),
      rating: num(x.rating),
      reviewCount: num(x.review_count ?? x.reviews_count),
      seller: str(seller.name, seller.shop_name, x.seller_name),
      query,
    };
  });
}

export async function discoverShopSignals(productName: string): Promise<ShopSignal[]> {
  const base = productName.replace(/\s+/g, " ").trim().slice(0, 80);
  if (!base) return [];
  const queries = [base, base + " レディース", base + " メンズ"];
  const groups = await Promise.all(queries.map((q) => searchTikTokShop(q, 5).catch(() => [])));
  return groups.flat().filter((item, i, all) =>
    all.findIndex((x) => x.title === item.title && x.seller === item.seller) === i
  ).slice(0, 15);
}
