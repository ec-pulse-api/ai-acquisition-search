import type { PageSnapshot } from "./types";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 12_000;
const MAX_REDIRECTS = 4;

function blockedIp(address: string) {
  const normalized = address.toLowerCase().split('%')[0];
  if (normalized === '::1' || normalized === '0:0:0:0:0:0:0:1') return true;
  if (isIP(normalized) === 4) {
    const [a,b] = normalized.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a >= 224) || (a === 100 && b >= 64 && b <= 127);
  }
  if (isIP(normalized) === 6) return normalized.startsWith('fc') || normalized.startsWith('fd') || normalized.startsWith('fe8') || normalized.startsWith('fe9') || normalized.startsWith('fea') || normalized.startsWith('feb');
  return true;
}

async function assertPublicUrl(input: string) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error('URLの形式が正しくありません。'); }
  if (!['http:','https:'].includes(url.protocol)) throw new Error('http または https のURLを入力してください。');
  if (url.username || url.password) throw new Error('認証情報を含むURLには対応していません。');
  const hostname = url.hostname.replace(/^\[|\]$/g, '').toLowerCase();
  if (hostname === 'localhost' || hostname.endsWith('.localhost') || hostname.endsWith('.local')) throw new Error('ローカルネットワークのURLにはアクセスできません。');
  const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map((entry) => entry.address);
  if (!addresses.length || addresses.some(blockedIp)) throw new Error('内部・プライベートネットワークのURLにはアクセスできません。');
  return url;
}

function decodeHtml(value: string) {
  return value
    .replace(/&nbsp;/gi, " ").replace(/&amp;/gi, "&").replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'").replace(/&lt;/gi, "<").replace(/&gt;/gi, ">")
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#([0-9]+);/g, (_, n) => String.fromCodePoint(Number(n)));
}

function matches(html: string, pattern: RegExp) {
  return Array.from(html.matchAll(pattern))
    .map((m) => decodeHtml(m[1] ?? m[2] ?? "").replace(/\s+/g, " ").trim())
    .filter(Boolean);
}

function extractJsonLdProduct(html: string): { signals: string[]; productName?: string; brand?: string; category?: string } {
  const signals: string[] = [];
  let productName: string | undefined;
  let brand: string | undefined;
  let category: string | undefined;

  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = decodeHtml(match[1] ?? "").trim();
      const parsed = JSON.parse(raw);
      const roots = Array.isArray(parsed) ? parsed : [parsed];
      const items = roots.flatMap((root) => [root, ...(Array.isArray(root?.["@graph"]) ? root["@graph"] : [])]);

      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (!type.some((x: unknown) => String(x).toLowerCase() === "product")) continue;

        const name = typeof item.name === "string" ? item.name.trim() : "";
        const itemBrand = typeof item.brand?.name === "string" ? item.brand.name.trim() : "";
        const itemCategory = typeof item.category === "string" ? item.category.trim() : "";
        const description = typeof item.description === "string" ? item.description.trim() : "";

        if (!productName && name) productName = name;
        if (!brand && itemBrand) brand = itemBrand;
        if (!category && itemCategory) category = itemCategory;

        for (const value of [name, itemBrand, itemCategory, description]) {
          if (value && value.length <= 500) signals.push(value);
        }
      }
    } catch {
      // Ignore malformed JSON-LD and continue with ordinary HTML extraction.
    }
  }
  return { signals: [...new Set(signals)], productName, brand, category };
}

function cleanText(html: string) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

export async function fetchPageSnapshot(inputUrl: string): Promise<PageSnapshot> {
  let url = await assertPublicUrl(inputUrl);
  let response: Response | null = null;

  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(url.toString(), {
        signal: controller.signal, redirect: "manual", cache: "no-store",
        headers: { "User-Agent": "AI-Acquisition-Search/1.0" }
      });
    } catch { throw new Error("ページを取得できませんでした。URLと公開状態を確認してください。"); }
    finally { clearTimeout(timer); }

    if (response.status < 300 || response.status >= 400) break;
    const location = response.headers.get("location");
    if (!location || redirect === MAX_REDIRECTS) throw new Error("リダイレクト回数が上限を超えました。");
    url = await assertPublicUrl(new URL(location, url).toString());
  }

  if (!response) throw new Error("ページを取得できませんでした。");

  if (!response.ok) throw new Error("ページ取得に失敗しました（HTTP " + response.status + "）。");
  const type = response.headers.get("content-type") ?? "";
  if (!type.includes("text/html") && !type.includes("application/xhtml+xml")) {
    throw new Error("現在はHTMLページのURLに対応しています。");
  }
  const length = Number(response.headers.get("content-length") ?? "0");
  if (length > MAX_BYTES) throw new Error("ページサイズが大きすぎます。");

  const html = await response.text();
  if (new TextEncoder().encode(html).byteLength > MAX_BYTES) throw new Error("ページサイズが大きすぎます。");

  const title = matches(html, /<title[^>]*>([\s\S]*?)<\/title>/i)[0] ?? "";
  const description = matches(html, /<meta[^>]+name=["']description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)[0]
    ?? matches(html, /<meta[^>]+content=["']([\s\S]*?)["'][^>]+name=["']description["'][^>]*>/i)[0] ?? "";
  const headings = [
    ...matches(html, /<h1[^>]*>([\s\S]*?)<\/h1>/gi),
    ...matches(html, /<h2[^>]*>([\s\S]*?)<\/h2>/gi)
  ].slice(0, 30);
  const links = Array.from(html.matchAll(/<a[^>]+href=["']([^"']+)["'][^>]*>/gi))
    .map((m) => { try { return new URL(m[1], response.url).toString(); } catch { return ""; } })
    .filter((x) => /^https?:/i.test(x)).slice(0, 50);
  const text = cleanText(html).slice(0, 20_000);
  const jsonLd = extractJsonLdProduct(html);
  const ogTitle = matches(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)[0];
  const ogDescription = matches(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i)[0];
  const productSignals = [
    jsonLd.productName, jsonLd.brand, jsonLd.category, ...jsonLd.signals,
    ogTitle, ogDescription, ...headings.slice(0, 10)
  ].filter((value): value is string => Boolean(value))
   .filter((value, index, all) => all.indexOf(value) === index).slice(0, 20);

  return {
    url: response.url, title, description, headings, text, links, productSignals,
    productName: jsonLd.productName || ogTitle || headings[0] || title || undefined,
    productBrand: jsonLd.brand,
    productCategory: jsonLd.category
  };
}
