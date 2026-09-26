const API = "https://api.x.com/2";

function getToken() {
  const token = process.env.X_ACCESS_TOKEN;
  if (!token) throw new Error("X_ACCESS_TOKEN が設定されていません。OAuth 2.0で認可したアクセストークンを設定してください。");
  return token;
}

async function request(path: string, init?: RequestInit) {
  const response = await fetch(API + path, {
    ...init,
    headers: { Authorization: `Bearer ${getToken()}`, "Content-Type": "application/json", ...(init?.headers || {}) },
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload?.errors) {
    throw new Error(payload?.detail || payload?.errors?.[0]?.detail || `X API error: ${response.status}`);
  }
  return payload;
}

export async function publishXPost(input: { text: string }) {
  const text = input.text.trim();
  if (!text) throw new Error("X投稿本文が空です。");
  if (text.length > 280) throw new Error("X投稿本文は280文字以内にしてください。");
  const result = await request("/tweets", { method: "POST", body: JSON.stringify({ text }) });
  const id = result?.data?.id;
  if (!id) throw new Error("X投稿IDが返りませんでした。");
  return { platform: "x", postId: id, url: `https://x.com/i/web/status/${id}`, status: "published" as const };
}

export async function getXPostMetrics(postId: string) {
  const result = await request(`/tweets/${encodeURIComponent(postId)}?tweet.fields=created_at,public_metrics,organic_metrics`);
  const data = result?.data;
  if (!data?.id) throw new Error("X投稿が見つかりませんでした。");
  return { platform: "x", postId: data.id, text: data.text, createdAt: data.created_at ?? null, publicMetrics: data.public_metrics ?? null, organicMetrics: data.organic_metrics ?? null };
}
