import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";

const EC_PULSE_API_URL = (process.env.EC_PULSE_API_URL || "https://ec-pulse-rk8mola3m-naitoshyuichirou-6935.vercel.app").replace(/\/$/, "");

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const urls = Array.isArray(body?.urls)
      ? [...new Set(body.urls.filter((item: unknown): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, 20)
      : [];

    if (!urls.length) {
      return NextResponse.json({ error: "リサーチ対象URLを1件以上入力してください。" }, { status: 400 });
    }

    const apiKey = process.env.EC_PULSE_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ connected: false, results: [], error: "EC_PULSE_API_KEY が未設定です。" });
    }

    const response = await fetch(EC_PULSE_API_URL + "/v1/research/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": apiKey },
      body: JSON.stringify({ urls, max_comments_per_url: 500 }),
      cache: "no-store"
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return NextResponse.json({
        connected: true,
        results: [],
        error: data?.detail || data?.error || "EC Pulse一括リサーチに失敗しました。"
      }, { status: response.status });
    }

    return NextResponse.json({ connected: true, ...data });
  } catch (error) {
    return NextResponse.json({
      connected: false,
      results: [],
      error: error instanceof Error ? error.message : "EC Pulse一括リサーチに失敗しました。"
    }, { status: 502 });
  }
}
