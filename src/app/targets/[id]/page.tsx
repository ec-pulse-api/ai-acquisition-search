import Link from "next/link";
import { notFound } from "next/navigation";
import { acquisitionTargets } from "@/lib/acquisition/data";

export default async function TargetPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const target = acquisitionTargets.find((item) => item.id === id);
  if (!target) notFound();

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
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-5 py-4 text-center">
              <div className="text-3xl font-semibold">{target.score}</div>
              <div className="mt-1 text-[11px] uppercase tracking-wider text-white/35">Signal score</div>
            </div>
          </div>
        </header>

        <div className="grid gap-5 py-8 md:grid-cols-2">
          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs uppercase tracking-wider text-white/35">Acquisition thesis</p>
            <p className="mt-4 leading-7 text-white/60">{target.description}</p>
            <ul className="mt-5 space-y-3">
              {target.acquisitionRationale.map((item) => (
                <li key={item} className="text-sm leading-6 text-white/55">• {item}</li>
              ))}
            </ul>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6">
            <p className="text-xs uppercase tracking-wider text-white/35">AI opportunity</p>
            <p className="mt-4 leading-7 text-white/60">{target.aiOpportunity}</p>
            <div className="mt-6">
              <p className="text-xs text-white/35">Revenue profile</p>
              <p className="mt-1 text-sm text-white/60">{target.revenueProfile}</p>
            </div>
            <div className="mt-5">
              <p className="text-xs text-white/35">Growth profile</p>
              <p className="mt-1 text-sm text-white/60">{target.growthProfile}</p>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-white/[0.035] p-6 md:col-span-2">
            <p className="text-xs uppercase tracking-wider text-white/35">Risks to validate</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {target.risks.map((risk) => (
                <div key={risk} className="rounded-2xl border border-white/10 bg-black/10 p-4 text-sm text-white/55">{risk}</div>
              ))}
            </div>
          </section>
        </div>

        <p className="border-t border-white/10 pt-5 text-xs text-white/25">
          Data status: {target.sourceType}. This page is an analysis interface, not a verified acquisition listing.
        </p>
      </div>
    </main>
  );
}
