import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { stripeRequest } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const body = await request.json().catch(() => ({}));
    const action = body.action === "resume" ? "resume" : body.action === "cancel" ? "cancel" : null;
    if (!action) return NextResponse.json({ error: "action must be cancel or resume" }, { status: 400 });

    const supabase = getAdminSupabase();
    const { data: subscription, error } = await supabase
      .from("subscriptions")
      .select("id,stripe_subscription_id,status,cancel_at_period_end,current_period_end")
      .eq("user_id", user.id)
      .in("status", ["active", "trialing", "past_due", "unpaid"])
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    if (!subscription?.stripe_subscription_id) {
      return NextResponse.json({ error: "有効なStripeサブスクリプションが見つかりません。" }, { status: 404 });
    }

    const stripeSubscription = await stripeRequest<{
      id: string;
      status: string;
      cancel_at_period_end: boolean;
      current_period_end?: number | null;
    }>(`subscriptions/${subscription.stripe_subscription_id}`, {
      form: { cancel_at_period_end: action === "cancel" ? "true" : "false" },
    });

    const { error: updateError } = await supabase
      .from("subscriptions")
      .update({
        cancel_at_period_end: stripeSubscription.cancel_at_period_end,
        current_period_end: stripeSubscription.current_period_end
          ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
          : subscription.current_period_end,
        updated_at: new Date().toISOString(),
      })
      .eq("id", subscription.id)
      .eq("user_id", user.id);

    if (updateError) throw updateError;

    return NextResponse.json({
      ok: true,
      action,
      cancelAtPeriodEnd: stripeSubscription.cancel_at_period_end,
      currentPeriodEnd: stripeSubscription.current_period_end
        ? new Date(stripeSubscription.current_period_end * 1000).toISOString()
        : subscription.current_period_end,
    });
  } catch (error) {
    console.error("stripe subscription change error", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "契約状態を変更できませんでした。" },
      { status: 500 },
    );
  }
}
