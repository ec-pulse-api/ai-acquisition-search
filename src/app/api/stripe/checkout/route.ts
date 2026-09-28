import { NextResponse } from "next/server";
import { getAdminSupabase, getUserFromBearer } from "@/lib/billing";
import { stripeRequest } from "@/lib/stripe";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });

    const priceId = process.env.STRIPE_PRO_PRICE_ID;
    if (!priceId) throw new Error("STRIPE_PRO_PRICE_ID is not configured");

    const supabase = getAdminSupabase();
    const { data: billingCustomer, error: lookupError } = await supabase
      .from("billing_customers")
      .select("stripe_customer_id")
      .eq("user_id", user.id)
      .maybeSingle();
    if (lookupError) throw lookupError;

    let customerId = billingCustomer?.stripe_customer_id ?? undefined;

    if (!customerId) {
      const customer = await stripeRequest<{ id: string }>("customers", {
        form: {
          email: user.email ?? undefined,
          "metadata[user_id]": user.id,
        },
      });
      customerId = customer.id;
      const { error } = await supabase.from("billing_customers").upsert(
        { user_id: user.id, stripe_customer_id: customerId, updated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
      if (error) throw error;
    }

    const origin = new URL(request.url).origin;
    const session = await stripeRequest<{ id: string; url: string }>("checkout/sessions", {
      form: {
        mode: "subscription",
        customer: customerId,
        "line_items[0][price]": priceId,
        "line_items[0][quantity]": "1",
        success_url: `${origin}/?checkout=success`,
        cancel_url: `${origin}/?checkout=cancelled`,
        client_reference_id: user.id,
        "metadata[user_id]": user.id,
        "subscription_data[metadata][user_id]": user.id,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("stripe checkout error", error);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Checkoutの作成に失敗しました。" }, { status: 500 });
  }
}
