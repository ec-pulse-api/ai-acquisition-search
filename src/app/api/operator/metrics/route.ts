import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUserFromBearer(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  try {
    const body = await request.json() as {
      socialPostId?: string; impressions?: number; views?: number; clicks?: number;
      conversions?: number; revenue?: number; grossProfit?: number; adSpend?: number;
      likes?: number; comments?: number; shares?: number; saves?: number;
    };
    if (!body.socialPostId) return NextResponse.json({ error: "投稿IDが必要です。" }, { status: 400 });
    const db = getAdminSupabase();
    const post = await db.from("social_posts").select("id,user_id").eq("id", body.socialPostId).eq("user_id", user.id).maybeSingle();
    if (post.error) throw post.error;
    if (!post.data) return NextResponse.json({ error: "対象投稿が見つかりません。" }, { status: 404 });
    const values = {
      impressions: Number(body.impressions ?? 0),
      views: Number(body.views ?? 0),
      clicks: Number(body.clicks ?? 0),
      conversions: Number(body.conversions ?? 0),
      revenue: Number(body.revenue ?? 0),
      grossProfit: Number(body.grossProfit ?? 0),
      adSpend: Number(body.adSpend ?? 0),
      likes: Number(body.likes ?? 0),
      comments: Number(body.comments ?? 0),
      shares: Number(body.shares ?? 0),
      saves: Number(body.saves ?? 0),
    };
    if (Object.values(values).some((value) => !Number.isFinite(value) || value < 0)) {
      return NextResponse.json({ error: "実績値は0以上の有限な数値で入力してください。" }, { status: 400 });
    }
    const { impressions, clicks, conversions, revenue, adSpend } = values;
    const ctr = impressions > 0 ? clicks / impressions : null;
    const cvr = clicks > 0 ? conversions / clicks : null;
    const cpa = conversions > 0 && adSpend > 0 ? adSpend / conversions : null;
    const roas = adSpend > 0 ? revenue / adSpend : null;
    const { data, error } = await db.from("post_metrics").insert({
      social_post_id: body.socialPostId, impressions, views: values.views,
      likes: values.likes, comments: values.comments, shares: values.shares,
      saves: values.saves, clicks, conversions, revenue, gross_profit: values.grossProfit,
      ad_spend: adSpend, ctr, cvr, cpa, roas, raw: body,
    }).select("id,ctr,cvr,cpa,roas").single();
    if (error) throw error;
    return NextResponse.json({ ok: true, metrics: data });
  } catch (error) {
    console.error("operator metrics error", error);
    return NextResponse.json({ error: "実績の保存に失敗しました。" }, { status: 500 });
  }
}
