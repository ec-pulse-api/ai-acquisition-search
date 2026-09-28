import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const user = await getUserFromBearer(request);
  if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
  try {
    const body = await request.json() as { socialPostId?: string; productId?: string; result?: Record<string, unknown> };
    if (!body.socialPostId) return NextResponse.json({ error: "投稿IDが必要です。" }, { status: 400 });
    const db = getAdminSupabase();
    const post = await db.from("social_posts").select("id,user_id,creative_id").eq("id", body.socialPostId).eq("user_id", user.id).maybeSingle();
    if (post.error) throw post.error;
    if (!post.data) return NextResponse.json({ error: "対象投稿が見つかりません。" }, { status: 404 });
    const metric = await db.from("post_metrics").select("ctr,cvr,cpa,roas,clicks,conversions,revenue,gross_profit,ad_spend").eq("social_post_id", body.socialPostId).order("measured_at",{ascending:false}).limit(1).maybeSingle();
    if (metric.error) throw metric.error;
    const m=metric.data;
    if (!m) return NextResponse.json({ error: "先に実績を保存してください。" }, { status: 400 });
    const verdict = m.roas != null && m.roas >= 2 ? "continue" : m.ctr != null && m.ctr >= 0.02 ? "pivot" : "stop";
    const reason = verdict === "continue" ? "ROASが2.0以上のため、同じ訴求を維持しつつクリエイティブを追加テストします。" : verdict === "pivot" ? "クリック反応は確認できるため、訴求またはクリエイティブを変更して再テストします。" : "現時点の反応が弱いため、同じ訴求の継続より別仮説を優先します。";
    const {data:run,error}=await db.from("operator_runs").insert({
      product_id: body.productId || null,user_id:user.id,run_type:"performance_verdict",status:"completed",
      input:{social_post_id:body.socialPostId,metrics:m},output:{verdict,reason,next_action:verdict==="continue"?"同じ訴求で新しいHookを2案テスト":verdict==="pivot"?"訴求・Hookを変更して再テスト":"別顧客セグメントまたは別訴求をテスト"},
      started_at:new Date().toISOString(),completed_at:new Date().toISOString()
    }).select("id").single();
    if(error) throw error;
    return NextResponse.json({ok:true,verdict,reason,runId:run.id});
  } catch(error){ console.error("operator decision error",error); return NextResponse.json({error:"判定に失敗しました。"}, {status:500}); }
}
