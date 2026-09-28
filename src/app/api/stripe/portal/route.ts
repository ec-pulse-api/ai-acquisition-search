import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { stripeRequest } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const supabase = getAdminSupabase();
    const { data, error } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (error) throw error;
    if (!data?.stripe_customer_id) {
      return NextResponse.json({ error: "Stripeのお客様情報がまだありません。" }, { status: 404 });
    }

    const origin = new URL(request.url).origin;
    const session = await stripeRequest<{ url: string }>("billing_portal/sessions", {
      form: { customer: data.stripe_customer_id, return_url: origin },
    });
    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("stripe portal error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "請求管理画面を開けませんでした。" }, { status: 500 });
  }
}
