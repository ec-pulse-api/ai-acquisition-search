"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { acquisitionTargets } from "@/lib/acquisition/data";
import type { AcquisitionTarget } from "@/lib/acquisition/types";
import type { AIAnalysis } from "@/lib/acquisition/ai";

export default function TargetPage({ params }: { params: Promise<{ id: string }> }) {
  const [target, setTarget] = useState<AcquisitionTarget | null>(null);
  const [analysis, setAnalysis] = useState<AIAnalysis | null>(null);
  const [status, setStatus] = useState("Loading...");
  const [analyzing, setAnalyzing] = useState(false);

  useEffect(() => {
    void (async () => {
      const { id } = await params;
      const local = acquisitionTargets.find((item) => item.id === id);
      if (local) {
        setTarget(local);
        setStatus("Sample target");
        return;
      }

      setStatus("Loading live listing...");
      const response = await fetch(`/api/sources/empire-flippers?limit=100`);
      const payload = await response.json();
      const found = payload.data?.find((item: AcquisitionTarget) => item.id === id);
      if (found) {
        setTarget(found);
        setStatus("Live marketplace listing");
      } else {
        setStatus("Target not found");
      }
    })();
  }, [params]);

  async function runAnalysis() {
    if (!target) return;
    setAnalyzing(true);
    setStatus("AI analysis running...");
    try {
      const response = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(target),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || "Analysis failed");
      setAnalysis(payload.data);
      setStatus(payload.meta?.aiConnected ? `AI analysis · ${payload.meta.model}` : "AI provider not connected");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Analysis failed");
    } finally {
      setAnalyzing(false);
    }
  }

  if (!target) return <main className="min-h-screen bg-[#07090d] p-10 text-white"><p className="text-white/50">{status}</p></main>;

  return (
    <main className="min-h-screen bg-[#07090d] text-white">
      <div className="mx-auto max-w-5xl px-6 py-8 lg:px-10">
        <Link href="/" className="text-sm text-white/45 hover:text-white">← Back to search</Link>
        <header className="mt-10 border-b border-white/10 pb-8">
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div>
              <p className="text-xs uppercase tracking-[0.2em] text-white/35">{target.category} · {target.model}</p>
              <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">{target.name}</h1>
              <p className="mt-4 max-w-2xl leading-7 text-white/50">{target.summary}</p>
              <p className="mt-3 text-xs text-white/30">{status}</p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center">
              <div className="text-3xl font-semibold">{target.score}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/35">Screen score</div>
            </div>
          </div>
        </header>

        <div className="py-8">
          <button onClick={() => void runAnalysis()} disabled={analyzing}
            className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black disabled:opacity-50">
            {analyzing ? "Analyzing..." : "Run AI acquisition analysis"}
          </button>
        </div>

        {analysis && (
          <div className="grid gap-5 pb-10 md:grid-cols-2">
            <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:col-span-2">
              <p className="text-xs uppercase tracking-wider text-white/35">Acquisition thesis</p>
              <p className="mt-4 leading-7 text-white/65">{analysis.thesis}</p>
              <p className="mt-5 text-sm text-white/50">{analysis.acquisitionFit}</p>
            </section>
            <Info title="Strengths" items={analysis.strengths} />
            <Info title="AI opportunities" items={analysis.aiOpportunities} />
            <Info title="Risks" items={analysis.risks} />
            <Info title="Due diligence questions" items={analysis.diligenceQuestions} />
          </div>
        )}
      </div>
    </main>
  );
}

function Info({ title, items }: { title: string; items: string[] }) {
  return (
    <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
      <p className="text-xs uppercase tracking-wider text-white/35">{title}</p>
      <ul className="mt-4 space-y-3">
        {items.map((item) => <li key={item} className="text-sm leading-6 text-white/55">• {item}</li>)}
      </ul>
    </section>
  );
}
