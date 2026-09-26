export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
};

function decode(value: string) {
  return value
    .replace(/&amp;/gi, "&").replace(/&quot;/gi, '"').replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<").replace(/&gt;/gi, ">").replace(/\s+/g, " ").trim();
}

function stripTags(value: string) {
  return decode(value.replace(/<[^>]+>/g, " "));
}

export async function searchWeb(query: string, limit = 5): Promise<WebSearchResult[]> {
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

    const html = await response.text();
    const results: WebSearchResult[] = [];

    for (const match of html.matchAll(/<li[^>]*class=["'][^"']*b_algo[^"']*["'][\s\S]*?<h2[^>]*>\s*<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>[\s\S]*?(?:<p[^>]*>([\s\S]*?)<\/p>)?[\s\S]*?<\/li>/gi)) {
      const resultUrl = decode(match[1] ?? "");
      const title = stripTags(match[2] ?? "");
      const snippet = stripTags(match[3] ?? "");
      if (!/^https?:\/\//i.test(resultUrl) || !title) continue;
      if (results.some((x) => x.url === resultUrl)) continue;
      results.push({ title, url: resultUrl, snippet });
      if (results.length >= limit) break;
    }

    return results;
  } catch {
    return [];
  } finally {
    clearTimeout(timer);
  }
}

export async function discoverAcquisitionSignals(input: {
  productName: string;
  description: string;
}): Promise<{
  queries: string[];
  results: WebSearchResult[];
}> {
  const base = input.productName || input.description || "商品";
  const queries = [
    base + " 口コミ 評判",
    base + " おすすめ 比較",
    base + " 悩み 目的",
    base + " 競合 商品",
  ];

  const groups = await Promise.all(queries.map((query) => searchWeb(query, 5)));
  const results = groups.flat().filter((result, index, all) =>
    all.findIndex((x) => x.url === result.url) === index
  ).slice(0, 20);

  return { queries, results };
}
