export type SearchEvidenceCategory = "customer_pain" | "customer_desire" | "competitor" | "market" | "channel";

export type SearchEvidenceType =
  | "official"
  | "product_listing"
  | "review"
  | "social"
  | "competitor"
  | "market"
  | "other";

export type SearchMatchType = "exact_product" | "brand_or_model" | "category" | "weak";

export type WebSearchResult = {
  title: string;
  url: string;
  snippet: string;
  category: SearchEvidenceCategory;
  query: string;
  evidenceType: SearchEvidenceType;
  matchType: SearchMatchType;
  relevanceScore: number;
  sourceDomain: string;
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
    results.push({
      title,
      url: resultUrl,
      snippet,
      category,
      query,
      evidenceType: "other",
      matchType: "weak",
      relevanceScore: 0,
      sourceDomain: getDomain(resultUrl),
    });
    if (results.length >= limit) break;
  }
  return results;
}

function getDomain(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./i, "").toLowerCase();
  } catch {
    return "";
  }
}

function classifyEvidence(result: WebSearchResult, productName: string, productCategory: string, identifiers: string[]) {
  const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  const product = productName.toLowerCase().trim();
  const category = productCategory.toLowerCase().trim();
  const tokens = product.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2);
  const domain = getDomain(result.url);

  const exact = product.length >= 3 && text.includes(product);
  const identifierMatch = identifiers.some((value) => value.length >= 3 && text.includes(value.toLowerCase()));
  const tokenMatches = tokens.filter((token) => text.includes(token)).length;

  let matchType: SearchMatchType = "weak";
  if (exact) matchType = "exact_product";
  else if (identifierMatch || (tokens.length > 1 && tokenMatches >= Math.ceil(tokens.length * 0.7))) matchType = "brand_or_model";
  else if (category && text.includes(category)) matchType = "category";

  let evidenceType: SearchEvidenceType = "other";
  if (/tiktok\.com|instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com/.test(domain)) {
    evidenceType = "social";
  } else if (/amazon\.|rakuten\.|shopping\.yahoo\.|store\\.shopping\.yahoo\.|kakaku\.|price\./.test(domain)) {
    evidenceType = "product_listing";
  } else if (/口コミ|レビュー|評判|クチコミ|体験談|質問|知恵袋/.test(text) || /review|reviews|qa|question|chiebukuro/.test(domain)) {
    evidenceType = "review";
  } else if (/公式|メーカー|ブランド/.test(text) || /official|brand|maker/.test(domain)) {
    evidenceType = "official";
  } else if (result.category === "competitor") {
    evidenceType = "competitor";
  } else if (result.category === "market") {
    evidenceType = "market";
  }

  let score = 0;
  if (exact) score += 35;
  else if (identifierMatch) score += 24;
  else if (matchType === "brand_or_model") score += 17;
  else if (matchType === "category") score += 6;

  score += Math.min(tokenMatches, 4) * 3;
  if (category && text.includes(category)) score += 4;
  if (result.snippet.length >= 50) score += 2;
  if (evidenceType === "official") score += 8;
  if (evidenceType === "product_listing") score += 7;
  if (evidenceType === "review") score += 5;
  if (evidenceType === "social") score += 4;
  if (/まとめ|ランキング|おすすめ|比較/.test(result.title) && matchType !== "exact_product") score -= 4;

  // Generic/category pages must not outrank evidence about the actual product.
  if (tokens.length >= 2 && tokenMatches === 1 && !exact && !identifierMatch) score -= 15;
  if (matchType === "weak") score -= 10;

  return { evidenceType, matchType, score, domain };
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
  const identifiers = (input.productSignals || [])
    .filter((signal) => signal && signal.length >= 3)
    .slice(0, 5)
    .map((signal) => signal.replace(/\s+/g, " ").trim().slice(0, 80));

  const searches: { query: string; category: SearchEvidenceCategory }[] = [
    { query: `"${base}" 口コミ 評判 レビュー`, category: "customer_pain" },
    { query: `"${base}" 欲しい メリット デメリット`, category: "customer_desire" },
    { query: `"${base}" 比較 代替品 競合`, category: "competitor" },
    { query: `"${base}" 市場 トレンド 販売`, category: "market" },
    { query: `"${base}" TikTok Instagram YouTube`, category: "channel" },
    ...(identifiers.slice(0, 2).map((id) => ({
      query: `"${base}" "${id}"`,
      category: "market" as SearchEvidenceCategory,
    }))),
  ];

  const groups = await Promise.all(
    searches.map((item) => searchWeb(item.query, 10, item.category))
  );

  const ranked = groups
    .flat()
    .filter((result, index, all) =>
      all.findIndex((x) => x.url === result.url) === index
    )
    .map((result) => {
      const classification = classifyEvidence(result, base, category, identifiers);
      return {
        result: {
          ...result,
          ...classification,
          relevanceScore: classification.score,
        },
        score: classification.score,
      };
    })
    .filter(({ score }) => score >= 8)
    .sort((a, b) => b.score - a.score);

  // Keep the final set diverse: don't let one SEO domain fill the investigation.
  const domainCounts = new Map<string, number>();
  const results: WebSearchResult[] = [];
  for (const item of ranked) {
    const count = domainCounts.get(item.result.sourceDomain) ?? 0;
    const maxPerDomain = item.result.matchType === "exact_product" ? 4 : 2;
    if (count >= maxPerDomain) continue;
    domainCounts.set(item.result.sourceDomain, count + 1);
    results.push(item.result);
    if (results.length >= 30) break;
  }

  return { queries: searches.map((x) => x.query), results };
}
