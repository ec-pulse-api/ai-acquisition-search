export type SearchEvidenceCategory = "customer_pain" | "customer_desire" | "competitor" | "market" | "channel";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  category: SearchEvidenceCategory;
  query: string;
};

function decode(value: string) {
  return value
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(Number(n)))
    .replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return decode(value.replace(/<[^>]+>/g, " "));
}

function extractBingResults(html: string, limit: number, query: string, category: SearchEvidenceCategory): WebSearchResult[] {
  const results: WebSearchResult[] = [];
  for (const match of html.matchAll(/<li[^>]*class=["'][^"']*b_algo[^"']*["'][\s\S]*?<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?[\s\S]*?<\/li>/gi)) {
    const resultUrl = decode(match[1] ?? "");
    const title = stripTags(match[2] ?? "");
    const snippet = stripTags(match[3] ?? "");
    if (!/^https?:\/\//i.test(resultUrl) || !title) continue;
    if (results.some((x) => x.url === resultUrl)) continue;
    results.push({ title, url: resultUrl, snippet, category, query });
    if (results.length >= limit) break;
  }
  return results;
}

export async function searchWeb(query: string, limit = 5, category: SearchEvidenceCategory = "market"): Promise<WebSearchResult[]> {
  const url = "https://www.bing.com/search?q=" + encodeURIComponent(query) + "&setlang=ja-JP&cc=JP";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; AI-Acquisition-Search/1.0)"
      }
    });
    if (!response.ok) return [];
    return extractBingResults(await response.text(), limit, query, category);
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export type AcquisitionSearchInput = {
  productName: string;
  description: string;
  productSignals?: string[];
};

export async function discoverAcquisitionSignals(input: AcquisitionSearchInput): Promise<{
  queries: string[];
  results: WebSearchResult[];
}> {
  const signal = (input.productSignals ?? []).find((x) => x.length >= 4) ?? "";
  const base = (signal || input.productName || input.description || "商品")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);

  const searches: { query: string; category: SearchEvidenceCategory }[] = [
    { query: `${base} 口コミ 評判 悩み`, category: "customer_pain" },
    { query: `${base} 欲しい 理由 メリット`, category: "customer_desire" },
    { query: `${base} おすすめ 比較 競合`, category: "competitor" },
    { query: `${base} 市場 トレンド 人気`, category: "market" },
    { query: `${base} TikTok Instagram YouTube 投稿`, category: "channel" },
  ];

  const groups = await Promise.all(searches.map((item) => searchWeb(item.query, 5, item.category)));  const results = groups.flat().filter((result, index, all) =>
    all.findIndex((x) => x.url === result.url) === index
  ).slice(0, 25);

  return { queries: searches.map((x) => x.query), results };
}
