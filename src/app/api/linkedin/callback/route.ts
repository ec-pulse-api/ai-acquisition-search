import crypto from "node:crypto";
import { NextResponse } from "next/server";
import { getAdminSupabase } from "@/lib/billing";
import { encryptLinkedInToken, exchangeLinkedInCode, getLinkedInUserInfo } from "@/lib/linkedin";

export const runtime = "nodejs";

function verifyState(state: string) {
  const [encoded, signature] = state.split(".");
  const secret = process.env.LINKEDIN_STATE_SECRET;
  if (!secret || !encoded || !signature) throw new Error("Invalid LinkedIn state");
  const payload = Buffer.from(encoded, "base64url").toString("utf8");
  const expected = crypto.createHmac("sha256", secret).update(payload).digest("base64url");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    throw new Error("Invalid LinkedIn state signature");
  }
  const parts = payload.split(".");
  const userId = parts[0];
  const issuedAt = Number(parts[1]);
  if (!userId || !Number.isFinite(issuedAt) || Date.now() - issuedAt > 10 * 60 * 1000) throw new Error("LinkedIn authorization expired");
  return userId;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return NextResponse.redirect(new URL("/?linkedin=error", url.origin));
  try {
    const userId = verifyState(state);
    const redirectUri = url.origin + "/api/linkedin/callback";
    const token = await exchangeLinkedInCode(code, redirectUri);
    const profile = await getLinkedInUserInfo(token.access_token);
    const supabase = getAdminSupabase();
    const expiresAt = token.expires_in ? new Date(Date.now() + token.expires_in * 1000).toISOString() : null;
    const { error } = await supabase.from("linkedin_accounts").upsert({
      user_id: userId,
      linkedin_sub: profile.sub,
      name: profile.name || null,
      email: profile.email || null,
      picture_url: profile.picture || null,
      access_token_encrypted: encryptLinkedInToken(token.access_token),
      expires_at: expiresAt,
      scopes: (token.scope || "openid profile email w_member_social").split(/\s+/).filter(Boolean),
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id" });
    if (error) throw error;
    return NextResponse.redirect(new URL("/?linkedin=connected", url.origin));
  } catch (error) {
    console.error("linkedin callback error", error);
    return NextResponse.redirect(new URL("/?linkedin=error", url.origin));
  }
}
