"use client";

import { useEffect, useState } from "react";
import { createClient, type User } from "@supabase/supabase-js";

export default function GoogleSignIn() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) {
      setReady(true);
      return;
    }

    const supabase = createClient(url, anonKey);

    void supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setReady(true);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function signIn() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) return;

    const supabase = createClient(url, anonKey);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: window.location.origin,
      },
    });
  }

  async function signOut() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !anonKey) return;

    const supabase = createClient(url, anonKey);
    await supabase.auth.signOut();
    setUser(null);
  }

  if (!ready) return null;

  if (user) {
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span>{user.email}</span>
        <button type="button" onClick={signOut}>
          ログアウト
        </button>
      </div>
    );
  }

  return (
    <button type="button" onClick={signIn}>
      Googleでログイン
    </button>
  );
}
