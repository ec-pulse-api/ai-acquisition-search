"use client";

import Link from "next/link";
import { useState } from "react";
import type { AcquisitionTarget } from "@/lib/acquisition/types";

export default function Home() {
  const [query, setQuery] = useState("");
  const [targets, setTargets] = useState<AcquisitionTarget[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [source, setSource] = useState("Not loaded");

  async function search() {
    setLoading(true);
    setSearched(true);
    try {
      const params = new URLSearchParams();
      if (query.trim()) params.set("q", query.trim());
      params.set("limit", "30");
      const response = await fetch(`/api/sources/empire-flippers?${params.toString()}`);
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Search failed");
      setTargets(payload.data ?? []);
      setSource(payload.meta?.source ?? "Unknown");
    } catch (error) {
      setTargets([]);
      setSource(error instanceof Error ? error.message : "Search failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-white text-sm font-black text-black">A</div>
            <div>
              <p className="text-sm font-semibold">AI Acquisition Search</p>
              <p className="text-[11px] text-white/40">Find businesses worth acquiring</p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50">Live acquisition research</span>
        </header>

        <section className="py-20 lg:py-28">
          <div className="max-w-4xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-white/40">Acquisition intelligence</p>
            <h1 className="text-5xl font-semibold tracking-[-0.04em] sm:text-6xl lg:text-7xl">
              Find the next business
              <span className="block text-white/45">with acquisition intelligence.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
              Pull live marketplace listings, screen financial signals, then send individual targets through AI acquisition analysis.
            </p>

            <div className="mt-10 flex max-w-3xl flex-col gap-3 sm:flex-row">
              <input value={query} onChange={(event) => setQuery(event.target.value)}
                onKeyDown={(event) => { if (event.key === "Enter") void search(); }}
                placeholder="e.g. SaaS, Amazon FBA, AI, content"
                className="h-14 flex-1 rounded-2xl border border-white/10 bg-white/[0.04] px-5 text-sm outline-none placeholder:text-white/25 focus:border-white/25" />
              <button onClick={() => void search()} disabled={loading}
                className="h-14 rounded-2xl bg-white px-7 text-sm font-semibold text-black disabled:opacity-50">
                {loading ? "Loading listings..." : "Search live listings"}
              </button>
            </div>
          </div>
        </section>

        <section className="pb-20">
          <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Live target universe</p>
              <h2 className="mt-1 text-xl font-semibold">{searched ? `${targets.length} listings found` : "Search the marketplace"}</h2>
            </div>
            <span className="text-xs text-white/30">{source}</span>
          </div>

          {!searched && (
            <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center text-sm text-white/35">
              Enter a category or business model to retrieve live listings.
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-3">
            {targets.map((item) => (
              <article key={item.id} className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:border-white/20">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] uppercase tracking-wider text-white/35">{item.category}</span>
                    <h3 className="mt-2 text-lg font-semibold">{item.name}</h3>
                  </div>
                  <span className="rounded-xl border border-white/10 px-2.5 py-1 text-xs text-white/60">{item.score}</span>
                </div>
                <p className="mt-4 min-h-14 text-sm leading-6 text-white/50">{item.summary}</p>
                <div className="mt-5 space-y-2 text-xs text-white/45">
                  <p>{item.revenueProfile}</p>
                  <p>{item.growthProfile}</p>
                </div>
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.signals.map((signal) => (
                    <span key={signal} className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/45">{signal}</span>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4">
                  <span className="text-xs text-white/30">Live source</span>
                  <Link href={`/targets/${item.id}?source=empire-flippers`} className="text-sm text-white/65 hover:text-white">Analyze →</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}
