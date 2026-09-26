import type { PageSnapshot } from "./types";

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 12_000;

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

function extractJsonLdProduct(html: string): string[] {
  const signals: string[] = [];
  for (const match of html.matchAll(/<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try {
      const raw = decodeHtml(match[1] ?? "").trim();
      const parsed = JSON.parse(raw);
      const items = Array.isArray(parsed) ? parsed : [parsed, ...(Array.isArray(parsed?.["@graph"]) ? parsed["@graph"] : [])];
      for (const item of items) {
        if (!item || typeof item !== "object") continue;
        const type = Array.isArray(item["@type"]) ? item["@type"] : [item["@type"]];
        if (!type.some((x: unknown) => String(x).toLowerCase() === "product")) continue;
        for (const value of [item.name, item.description, item.brand?.name, item.category]) {
          if (typeof value === "string" && value.trim()) signals.push(value.trim());
        }
      }
    } catch {
      // Ignore malformed JSON-LD and continue with ordinary HTML extraction.
    }
  }
  return [...new Set(signals)];
}

function cleanText(html: string) {
  return decodeHtml(html.replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ").replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg[\s\S]*?<\/svg>/gi, " ").replace(/<[^>]+>/g, " "))
    .replace(/\s+/g, " ").trim();
}

export async function fetchPageSnapshot(inputUrl: string): Promise<PageSnapshot> {
  let url: URL;
  try { url = new URL(inputUrl); } catch { throw new Error("URLの形式が正しくありません。"); }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("http または https のURLを入力してください。");

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(url.toString(), {
      signal: controller.signal, redirect: "follow", cache: "no-store",
      headers: { "User-Agent": "AI-Acquisition-Search/1.0" }
    });
  } catch { throw new Error("ページを取得できませんでした。URLと公開状態を確認してください。"); }
  finally { clearTimeout(timer); }

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
  const jsonLdSignals = extractJsonLdProduct(html);
  const productSignals = [
    ...jsonLdSignals,
    ...matches(html, /<meta[^>]+property=["']og:title["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i),
    ...matches(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([\s\S]*?)["'][^>]*>/i),
    ...headings.slice(0, 10)
  ].filter((value, index, all) => all.indexOf(value) === index).slice(0, 20);

  return { url: response.url, title, description, headings, text, links, productSignals };
}
