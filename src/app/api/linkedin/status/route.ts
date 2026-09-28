import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const user = await getUserFromBearer(request);
  if (!user) return NextResponse.json({ connected: false, authenticated: false });
  const supabase = getAdminSupabase();
  const { data, error } = await supabase.from("linkedin_accounts")
    .select("name,email,picture_url,expires_at,scopes")
    .eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({
    connected: Boolean(data), authenticated: true,
    account: data ? { name: data.name, email: data.email, pictureUrl: data.picture_url, expiresAt: data.expires_at, scopes: data.scopes } : null,
  });
}
