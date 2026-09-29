import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

const MAX_REDIRECTS = 4;

function blockedIp(address: string) {
  const normalized = address.toLowerCase().split("%")[0];
  if (normalized === "::1" || normalized === "0:0:0:0:0:0:0:1") return true;
  if (isIP(normalized) === 4) {
    const [a, b] = normalized.split(".").map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) ||
      (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) ||
      (a >= 224) || (a === 100 && b >= 64 && b <= 127);
  }
  if (isIP(normalized) === 6) {
    return normalized.startsWith("fc") || normalized.startsWith("fd") ||
      normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
      normalized.startsWith("fea") || normalized.startsWith("feb") ||
      normalized.startsWith("ff");
  }
  return true;
}

export async function assertPublicUrl(input: string, allowedProtocols: readonly string[] = ["http:", "https:"]) {
  let url: URL;
  try { url = new URL(input); } catch { throw new Error("URLの形式が正しくありません。"); }
  if (!allowedProtocols.includes(url.protocol)) throw new Error("許可されていないURLスキームです。");
  if (url.username || url.password) throw new Error("認証情報を含むURLには対応していません。");
  const hostname = url.hostname.replace(/^\[|\]$/g, "").toLowerCase();
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname === "local" || hostname.endsWith(".local")) {
    throw new Error("ローカルネットワークのURLにはアクセスできません。");
  }
  const addresses = isIP(hostname) ? [hostname] : (await lookup(hostname, { all: true })).map((entry) => entry.address);
  if (!addresses.length || addresses.some(blockedIp)) throw new Error("内部・プライベートネットワークのURLにはアクセスできません。");
  return url;
}

export async function fetchPublicUrl(input: string, init: RequestInit = {}) {
  let url = await assertPublicUrl(input);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect++) {
    const response = await fetch(url.toString(), { ...init, redirect: "manual" });
    if (response.status < 300 || response.status >= 400) return response;
    const location = response.headers.get("location");
    if (!location || redirect === MAX_REDIRECTS) throw new Error("動画URLのリダイレクト回数が上限を超えました。");
    url = await assertPublicUrl(new URL(location, url).toString());
  }
  throw new Error("動画URLを取得できませんでした。");
}
