"use client";

import { useState } from "react";
import { createClient } from "@supabase/supabase-js";

export default function BillingButton({ mode = "checkout" }: { mode?: "checkout" | "portal" }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function openBilling() {
    setLoading(true);
    setError("");
    try {
      const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !anonKey) throw new Error("Supabase設定がありません。");
      const supabase = createClient(url, anonKey);
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("先にGoogleでログインしてください。");

      const endpoint = mode === "checkout" ? "/api/stripe/checkout" : "/api/stripe/portal";
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { Authorization: `Bearer ${data.session.access_token}` },
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error || "Stripe処理に失敗しました。");
      window.location.assign(body.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Stripe処理に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={openBilling} disabled={loading}>
        {loading ? "処理中..." : mode === "checkout" ? "Proに登録する（¥4,980/月）" : "請求・解約を管理する"}
      </button>
      {error && <small style={{ display: "block", marginTop: 8 }}>{error}</small>}
    </div>
  );
}
