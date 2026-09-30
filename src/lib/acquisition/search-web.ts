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

function relevanceScore(result: WebSearchResult, productName: string, productCategory: string, query: string) {
  const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  const product = productName.toLowerCase().trim();
  const category = productCategory.toLowerCase().trim();
  const tokens = product.split(/[^\\p{L}\\p{N}]+/u).filter((x) => x.length >= 2);
  let score = 0;

  if (product && text.includes(product)) score += 18;
  for (const token of tokens) if (text.includes(token)) score += 3;
  if (category && text.includes(category)) score += 5;
  if (result.snippet.length >= 40) score += 2;

  const url = result.url.toLowerCase();
  if (/amazon\\.|rakuten\\.|yahoo\\.|kakaku\\.|price\\./.test(url)) score += 2;
  if (/まとめ|ランキング|おすすめ|比較/.test(result.title)) score += 1;

  // Reject pages that only happen to match a single generic term.
  const matchedTokens = tokens.filter((token) => text.includes(token)).length;
  if (tokens.length >= 2 && matchedTokens === 1 && !text.includes(product)) score -= 12;

  return score;
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
  productCategory?: string;
};

export async function discoverAcquisitionSignals(input: AcquisitionSearchInput): Promise<{
  queries: string[];
  results: WebSearchResult[];
}> {
  const base = (input.productName || input.productSignals?.[0] || input.description || "商品")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  const category = (input.productCategory || "").replace(/\s+/g, " ").trim().slice(0, 50);
  const context = category && !base.includes(category) ? base + " " + category : base;

  const searches: { query: string; category: SearchEvidenceCategory }[] = [
    { query: `"${base}" 口コミ 評判 レビュー`, category: "customer_pain" },
    { query: `"${base}" 欲しい メリット デメリット`, category: "customer_desire" },
    { query: `"${base}" 比較 代替品 競合`, category: "competitor" },
    { query: `"${base}" 市場 トレンド 販売`, category: "market" },
    { query: `"${base}" TikTok Instagram YouTube`, category: "channel" },
  ];

  const groups = await Promise.all(
    searches.map((item) => searchWeb(item.query, 10, item.category))
  );

  const results = groups
    .flat()
    .filter((result, index, all) =>
      all.findIndex((x) => x.url === result.url) === index
    )
    .map((result) => ({
      result,
      score: relevanceScore(result, base, category, result.query),
    }))
    .filter(({ score }) => score >= 3)
    .sort((a, b) => b.score - a.score)
    .slice(0, 30)
    .map(({ result }) => result);

  return { queries: searches.map((x) => x.query), results };
}
