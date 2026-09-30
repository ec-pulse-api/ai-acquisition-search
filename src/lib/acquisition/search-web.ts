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

function normalizeIdentity(value: string) {
  return value
    .toLowerCase()
    .normalize("NFKC")
    .replace(/[\s\-_・/\\()[\]{}:：,.，。]/g, "");
}

function classifyEvidence(result: WebSearchResult, productName: string, productCategory: string, productBrand: string, identifiers: string[], sourceDomain: string) {
  const titleAndSnippet = `${result.title} ${result.snippet}`.toLowerCase();
  const text = `${result.title} ${result.snippet} ${result.url}`.toLowerCase();
  const product = productName.toLowerCase().trim();
  const category = productCategory.toLowerCase().trim();
  const brand = productBrand.toLowerCase().trim();
  const source = sourceDomain.toLowerCase().trim();
  const tokens = product.split(/[^\p{L}\p{N}]+/u).filter((x) => x.length >= 2);
  const domain = getDomain(result.url);

  const normalizedProduct = normalizeIdentity(product);
  const normalizedTitleSnippet = normalizeIdentity(titleAndSnippet);
  const exactPhrase = product.length >= 3 && titleAndSnippet.includes(product);
  const normalizedExact = normalizedProduct.length >= 5 && normalizedTitleSnippet.includes(normalizedProduct);
  const brandMatch = brand.length >= 2 && titleAndSnippet.includes(brand);
  const identifierMatch = identifiers.some((value) => value.length >= 3 && titleAndSnippet.includes(value.toLowerCase()));
  const tokenMatches = tokens.filter((token) => titleAndSnippet.includes(token)).length;
  const strongTokenMatch = tokens.length >= 2 && tokenMatches >= Math.ceil(tokens.length * 0.8);
  const exact = exactPhrase || normalizedExact;

  let matchType: SearchMatchType = "weak";
  if (exact && (identifierMatch || brandMatch || strongTokenMatch)) matchType = "exact_product";
  else if (identifierMatch || brandMatch || strongTokenMatch) matchType = "brand_or_model";
  else if (category && text.includes(category)) matchType = "category";

  let evidenceType: SearchEvidenceType = "other";
  if (/tiktok\.com|instagram\.com|youtube\.com|youtu\.be|x\.com|twitter\.com/.test(domain)) {
    evidenceType = "social";
  } else if (/amazon\.|rakuten\.|shopping\.yahoo\.|store\.shopping\.yahoo\.|kakaku\.|price\./.test(domain)) {
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
  if (exact && identifierMatch) score += 45;
  else if (exact && brandMatch) score += 40;
  else if (exact) score += 32;
  else if (identifierMatch) score += 26;
  else if (brandMatch && strongTokenMatch) score += 23;
  else if (matchType === "brand_or_model") score += 15;
  else if (matchType === "category") score += 4;

  score += Math.min(tokenMatches, 4) * 3;
  if (category && text.includes(category)) score += 4;
  if (source && domain === source) score += 12;
  if (result.snippet.length >= 50) score += 2;
  if (evidenceType === "official") score += 8;
  if (evidenceType === "product_listing") score += 7;
  if (evidenceType === "review") score += 5;
  if (evidenceType === "social") score += 4;
  if (/まとめ|ランキング|おすすめ|比較/.test(result.title) && matchType !== "exact_product") score -= 6;

  // Generic/category pages must not outrank evidence about the actual product.
  if (tokens.length >= 2 && tokenMatches <= 1 && !exact && !identifierMatch) score -= 18;
  if (matchType === "category") score -= 8;
  if (matchType === "weak") score -= 14;

  // A product name appearing only in the URL is not enough to establish identity.
  if (exact && !exactPhrase && !normalizedExact) score -= 10;

  // Evidence that actually identifies the product gets a strong bonus; generic
  // market pages are allowed only when they also contain product identity.
  if (result.category !== "market" && matchType === "weak") score -= 8;

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
  productBrand?: string;
  sourceDomain?: string;
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
    .filter((signal) => /[0-9]/.test(signal) || /型番|モデル|model|sku|asin|jan/i.test(signal))
    .filter((signal) => signal.length >= 3)
    .slice(0, 5)
    .map((signal) => signal.replace(/\s+/g, " ").trim().slice(0, 80));
  const brand = (input.productBrand || "").replace(/\s+/g, " ").trim().slice(0, 80);
  const sourceDomain = (input.sourceDomain || "").replace(/^www\./i, "").trim().toLowerCase();

  const searches: { query: string; category: SearchEvidenceCategory }[] = [
    { query: `"${base}" 口コミ 評判 レビュー`, category: "customer_pain" },
    { query: `"${base}" 欲しい メリット デメリット`, category: "customer_desire" },
    { query: `"${base}" 比較 代替品 競合`, category: "competitor" },
    { query: `"${base}" 市場 トレンド 販売`, category: "market" },
    { query: `"${base}" TikTok Instagram YouTube`, category: "channel" },
    ...(brand && brand.toLowerCase() !== base.toLowerCase() ? [
      { query: `"${brand}" "${base}"`, category: "market" as SearchEvidenceCategory },
      { query: `"${brand}" "${base}" レビュー 口コミ`, category: "customer_pain" as SearchEvidenceCategory },
    ] : []),
    ...(sourceDomain && !/amazon\.|rakuten\.|shopping\.yahoo\.|tiktok\.com|instagram\.com|youtube\.com/.test(sourceDomain)
      ? [{ query: `site:${sourceDomain} "${base}"`, category: "market" as SearchEvidenceCategory }]
      : []),
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
      const classification = classifyEvidence(result, base, category, brand, identifiers, sourceDomain);
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
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (a.result.matchType !== b.result.matchType) {
        return a.result.matchType === "exact_product" ? -1 : 1;
      }
      return a.result.sourceDomain.localeCompare(b.result.sourceDomain);
    });

  // Build an evidence set instead of filling an arbitrary "30 results".
  // This prevents SEO-heavy domains or one evidence type from dominating the analysis.
  const domainCounts = new Map<string, number>();
  const typeCounts = new Map<SearchEvidenceType, number>();
  const results: WebSearchResult[] = [];

  const typePriority: SearchEvidenceType[] = [
    "official",
    "product_listing",
    "review",
    "social",
    "competitor",
    "market",
    "other",
  ];

  for (const type of typePriority) {
    for (const item of ranked.filter((x) => x.result.evidenceType === type)) {
      const count = domainCounts.get(item.result.sourceDomain) ?? 0;
      const maxPerDomain = item.result.matchType === "exact_product" ? 3 : 2;
      if (count >= maxPerDomain) continue;
      domainCounts.set(item.result.sourceDomain, count + 1);
      typeCounts.set(type, (typeCounts.get(type) ?? 0) + 1);
      results.push(item.result);
      if (results.length >= 30) break;
    }
    if (results.length >= 30) break;
  }

  // Re-rank after diversity selection: evidence strength first, then identity.
  results.sort((a, b) => {
    if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
    if (a.matchType !== b.matchType) {
      return a.matchType === "exact_product" ? -1 : 1;
    }
    return a.sourceDomain.localeCompare(b.sourceDomain);
  });

  return { queries: searches.map((x) => x.query), results };
}
