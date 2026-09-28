import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { decryptLinkedInToken, getLinkedInMemberPostAnalytics } from "@/lib/linkedin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    const body = await request.json();
    const postUrn = typeof body.postUrn === "string" ? body.postUrn.trim() : "";
    const socialPostId = typeof body.socialPostId === "string" ? body.socialPostId.trim() : "";
    if (!postUrn && !socialPostId) return NextResponse.json({ error: "LinkedIn投稿を指定してください。" }, { status: 400 });

    const supabase = getAdminSupabase();
    let linkedPostId = socialPostId;
    let resolvedPostUrn = postUrn;
    if (socialPostId) {
      const { data: socialPost, error: socialPostError } = await supabase.from("social_posts").select("id,external_post_id,network").eq("id", socialPostId).eq("user_id", user.id).maybeSingle();
      if (socialPostError) throw socialPostError;
      if (!socialPost || socialPost.network !== "linkedin" || !socialPost.external_post_id) return NextResponse.json({ error: "LinkedIn投稿がまだ公開されていません。" }, { status: 400 });
      resolvedPostUrn = socialPost.external_post_id;
    }

    const { data: account, error } = await supabase.from("linkedin_accounts")
      .select("access_token_encrypted,expires_at")
      .eq("user_id", user.id).maybeSingle();
    if (error) throw error;
    if (!account) return NextResponse.json({ error: "LinkedInを先に接続してください。" }, { status: 400 });
    if (account.expires_at && new Date(account.expires_at).getTime() <= Date.now()) {
      return NextResponse.json({ error: "LinkedInアクセストークンの有効期限が切れています。再接続してください。" }, { status: 401 });
    }

    const analytics = await getLinkedInMemberPostAnalytics(
      decryptLinkedInToken(account.access_token_encrypted),
      postUrn,
    );
    return NextResponse.json({ ok: true, analytics });
  } catch (error) {
    console.error("linkedin analytics error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "LinkedIn分析に失敗しました。" }, { status: 500 });
  }
}
