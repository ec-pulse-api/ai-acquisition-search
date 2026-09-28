import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getUserFromBearer } from "@/lib/billing";
import { linkedInAuthUrl } from "@/lib/linkedin";

export const runtime = "nodejs";

function sign(value: string) {
  const secret = process.env.LINKEDIN_STATE_SECRET;
  if (!secret) throw new Error("LINKEDIN_STATE_SECRET is not configured");
  return crypto.createHmac("sha256", secret).update(value).digest("base64url");
}

export async function GET(request: Request) {
  const user = await getUserFromBearer(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  const origin = new URL(request.url).origin;
  const redirectUri = origin + "/api/linkedin/callback";
  const nonce = crypto.randomBytes(18).toString("base64url");
  const payload = user.id + "." + Date.now() + "." + nonce;
  const state = Buffer.from(payload).toString("base64url") + "." + sign(payload);
  return NextResponse.json({ url: linkedInAuthUrl({ state, redirectUri }) });
}
