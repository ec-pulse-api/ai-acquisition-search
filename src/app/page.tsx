"use client";

import { FormEvent, useMemo, useState } from "react";

type Result = {
  name: string;
  category: string;
  summary: string;
  signals: string[];
  stage: string;
  score: number;
};

const sampleResults: Result[] = [
  {
    name: "AI Customer Support Copilot",
    category: "SaaS / AI",
    summary: "問い合わせ対応を自動化し、導入企業の運用データを蓄積するB2B SaaS。",
    signals: ["Recurring revenue", "AI workflow", "B2B"],
    stage: "Seed",
    score: 92,
  },
  {
    name: "Vertical Video Commerce",
    category: "Commerce / Creator",
    summary: "短尺動画から商品発見・比較・購入までをつなぐコマース基盤。",
    signals: ["Creator economy", "Commerce", "Growth"],
    stage: "Series A",
    score: 88,
  },
  {
    name: "Developer AI Analytics",
    category: "DevTools",
    summary: "AI開発ツールの利用状況とチーム生産性を可視化する分析プロダクト。",
    signals: ["Developer tools", "Usage data", "Enterprise"],
    stage: "Series A",
    score: 84,
  },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [searched, setSearched] = useState(false);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return sampleResults;
    return sampleResults.filter((item) =>
      [item.name, item.category, item.summary, ...item.signals]
        .join(" ")
        .toLowerCase()
        .includes(q),
    );
  }, [query]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSearched(true);
  }

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-7xl px-6 py-6 lg:px-10">
        <header className="flex items-center justify-between border-b border-white/10 pb-5">
          <div className="flex items-center gap-3">
            <div className="grid size-9 place-items-center rounded-xl bg-white text-sm font-black text-black">
              A
            </div>
            <div>
              <p className="text-sm font-semibold tracking-tight">AI Acquisition Search</p>
              <p className="text-[11px] text-white/40">Find businesses worth acquiring</p>
            </div>
          </div>
          <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/50">
            Research workspace
          </span>
        </header>

        <section className="py-20 lg:py-28">
          <div className="max-w-4xl">
            <p className="mb-5 text-xs font-semibold uppercase tracking-[0.24em] text-white/40">
              Acquisition intelligence
            </p>
            <h1 className="text-5xl font-semibold tracking-[-0.04em] text-white sm:text-6xl lg:text-7xl">
              Find the next business
              <span className="block text-white/45">before everyone else.</span>
            </h1>
            <p className="mt-7 max-w-2xl text-base leading-7 text-white/50 sm:text-lg">
              Search acquisition targets by business model, category, growth signals,
              and AI opportunity. Turn a broad market into a focused deal pipeline.
            </p>

            <form onSubmit={handleSubmit} className="mt-10 flex max-w-3xl flex-col gap-3 sm:flex-row">
              <label className="flex flex-1 items-center rounded-2xl border border-white/10 bg-white/[0.04] px-5 shadow-2xl shadow-black/20 focus-within:border-white/25">
                <span className="mr-3 text-white/35">⌕</span>
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="e.g. AI SaaS, creator tools, profitable micro-SaaS"
                  className="h-14 w-full bg-transparent text-sm outline-none placeholder:text-white/25"
                />
              </label>
              <button
                type="submit"
                className="h-14 rounded-2xl bg-white px-7 text-sm font-semibold text-black transition hover:bg-white/90"
              >
                Search targets
              </button>
            </form>
          </div>
        </section>

        <section className="pb-20">
          <div className="mb-5 flex items-end justify-between border-b border-white/10 pb-4">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">Target universe</p>
              <h2 className="mt-1 text-xl font-semibold">
                {searched ? `${results.length} matching targets` : "High-signal opportunities"}
              </h2>
            </div>
            <span className="text-xs text-white/30">Signals are indicative</span>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {results.map((item) => (
              <article
                key={item.name}
                className="group rounded-3xl border border-white/10 bg-white/[0.035] p-6 transition hover:-translate-y-1 hover:border-white/20 hover:bg-white/[0.055]"
              >
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <span className="text-[11px] font-medium uppercase tracking-wider text-white/35">
                      {item.category}
                    </span>
                    <h3 className="mt-2 text-lg font-semibold">{item.name}</h3>
                  </div>
                  <div className="rounded-xl border border-white/10 px-2.5 py-1 text-xs text-white/60">
                    {item.score}
                  </div>
                </div>
                <p className="mt-4 min-h-14 text-sm leading-6 text-white/50">{item.summary}</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {item.signals.map((signal) => (
                    <span
                      key={signal}
                      className="rounded-full bg-white/5 px-2.5 py-1 text-[11px] text-white/45"
                    >
                      {signal}
                    </span>
                  ))}
                </div>
                <div className="mt-6 flex items-center justify-between border-t border-white/10 pt-4 text-xs">
                  <span className="text-white/35">{item.stage}</span>
                  <button className="text-white/65 transition group-hover:text-white">
                    View thesis →
                  </button>
                </div>
              </article>
            ))}
          </div>

          {searched && results.length === 0 && (
            <div className="rounded-3xl border border-dashed border-white/10 py-16 text-center">
              <p className="text-sm text-white/45">No matching targets in the current dataset.</p>
              <p className="mt-2 text-xs text-white/25">Try a broader category or business model.</p>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
