import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUserFromBearer(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  const db = getAdminSupabase();
  const { data, error } = await db.from("tiktok_publish_consents")
    .select("consented_at,updated_at").eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ consented: Boolean(data), consentedAt: data?.consented_at ?? null });
}

export async function POST(request: Request) {
  const user = await getUserFromBearer(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  if (body?.consented !== true) {
    return NextResponse.json({ error: "TikTok自動投稿への明示的な同意が必要です。consented=true を指定してください。" }, { status: 400 });
  }
  const db = getAdminSupabase();
  const now = new Date().toISOString();
  const { data, error } = await db.from("tiktok_publish_consents").upsert({
    user_id: user.id,
    consented_at: now,
    updated_at: now,
  }).select("consented_at,updated_at").single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, consented: true, consentedAt: data.consented_at });
}