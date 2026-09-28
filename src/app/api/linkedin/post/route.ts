import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { createLinkedInPost, decryptLinkedInToken } from "@/lib/linkedin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    const body = await request.json();
    const commentary = typeof body.commentary === "string" ? body.commentary.trim() : "";
    const socialPostId = typeof body.socialPostId === "string" ? body.socialPostId.trim() : "";
    if (!commentary) return NextResponse.json({ error: "投稿本文が必要です。" }, { status: 400 });
    if (!socialPostId) return NextResponse.json({ error: "先にテスト計画を保存してください。" }, { status: 400 });
    if (commentary.length > 3000) return NextResponse.json({ error: "投稿本文は3000文字以内にしてください。" }, { status: 400 });
    const supabase = getAdminSupabase();
    const { data: account, error } = await supabase.from("linkedin_accounts")
      .select("linkedin_sub,access_token_encrypted,expires_at")
      .eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!account) return NextResponse.json({ error: "LinkedInを先に接続してください。" }, { status: 400 });
    const { data: socialPost, error: socialPostError } = await supabase.from("social_posts").select("id,network,user_id").eq("id", socialPostId).eq("user_id", user.id).maybeSingle();
    if (socialPostError) throw socialPostError;
    if (!socialPost) return NextResponse.json({ error: "対象のテスト投稿が見つかりません。" }, { status: 404 });
    if (account.expires_at && new Date(account.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "LinkedInアクセストークンの有効期限が切れています。再接続してください。" }, { status: 401 });
    }
    const result = await createLinkedInPost(
      decryptLinkedInToken(account.access_token_encrypted),
      "urn:li:person:" + account.linkedin_sub,
      commentary,
    );
    return NextResponse.json({ ok: true, post: result });
  } catch (error) {
    console.error("linkedin post error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "LinkedIn投稿に失敗しました。" }, { status: 500 });
  }
}
