"use client";

import { FormEvent, useState } from "react";
import type { AcquisitionAnalyzeResult } from "@/lib/acquisition/types";

function List({ items }: { items: string[] }) {
  return <ul className="list">{items.filter(Boolean).map((x, i) => <li key={i}>{x}</li>)}</ul>;
}
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return <section className="panel"><p className="eyebrow">{title}</p>{children}</section>;
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AcquisitionAnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function analyze(e?: FormEvent) {
    e?.preventDefault(); setLoading(true); setError(""); setResult(null);
    try {
      const res = await fetch("/api/analyze", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ url }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析に失敗しました。");
      setResult(data.data);
    } catch (err) { setError(err instanceof Error ? err.message : "分析に失敗しました。"); }
    finally { setLoading(false); }
  }

  return <main className="shell">
    <header className="topbar"><div><strong>AI Acquisition Search</strong><span>AI集客検索エンジン</span></div><span className="status">Customer Acquisition Intelligence</span></header>
    <section className="hero">
      <p className="eyebrow">AI CUSTOMER ACQUISITION</p>
      <h1>商品・サービスURLから、<br/><span>次にやる集客を判断する。</span></h1>
      <p className="lead">商品・市場・顧客・競合・実績を分析し、集客課題・機会・優先順位・次に取るべき集客アクションを整理します。</p>
      <form onSubmit={analyze} className="search"><input value={url} onChange={e=>setUrl(e.target.value)} placeholder="https://example.com/product" type="url" required/><button disabled={loading}>{loading ? "集客分析中..." : "集客分析を開始"}</button></form>
      {error && <p className="error">{error}</p>}
      <p className="hint">公開HTMLページを分析します。AIキー未設定時は抽出情報ベースの予備分析を返します。</p>
    </section>
    {result && <div className="results">
      <div className="source"><span>分析対象</span><a href={result.source.url} target="_blank" rel="noreferrer">{result.source.title || result.source.url}</a><small>{result.source.url}</small></div>
      <Section title="01 商品分析"><h2>{result.analysis.product.summary}</h2><List items={result.analysis.product.valueProposition}/></Section>
      <Section title="02 市場分析"><h2>{result.analysis.market.summary}</h2><List items={result.analysis.market.signals}/></Section>
      <Section title="03 顧客分析"><h2>{result.analysis.customer.summary}</h2><List items={[...result.analysis.customer.likelySegments,...result.analysis.customer.needs]}/></Section>
      <Section title="04 競合分析"><h2>{result.analysis.competitors.summary}</h2><List items={result.analysis.competitors.signals}/></Section>
      <Section title="05 実績分析"><h2>{result.analysis.performance.summary}</h2><List items={[...result.analysis.performance.availableEvidence,...result.analysis.performance.missingData.map(x=>"不足: "+x)]}/></Section>
      <section className="next"><p className="eyebrow">DECISION ENGINE</p><h2>次に何をすべきか</h2><article className="decision"><strong>狙う顧客</strong><p>{result.analysis.decision.target}</p><strong>顧客の問題</strong><p>{result.analysis.decision.problem}</p><strong>欲求</strong><p>{result.analysis.decision.desire}</p><strong>訴求</strong><p>{result.analysis.decision.valueProposition}</p><strong>媒体</strong><p>{result.analysis.decision.channel}</p><strong>投稿形式</strong><p>{result.analysis.decision.format}</p><strong>検証方法</strong><p>{result.analysis.decision.testPlan}</p>{result.analysis.decision.evidence?.length > 0 && <><strong>根拠</strong><List items={result.analysis.decision.evidence}/></>}</article></section><section className="next"><p className="eyebrow">NEXT ACTION</p><h2>次にやるべき集客</h2><div className="action-list">{result.analysis.priorities.map(x=><article key={x.priority}><b>#{x.priority}</b><div><strong>{x.action}</strong><p>{x.reason}</p><small>{x.channel}</small></div></article>)}</div></section>
      <section className="next"><p className="eyebrow">NEXT POSTS</p><h2>次に出す投稿</h2><div className="action-list">{result.analysis.nextPosts.map(x=><article key={x.rank}><b>#{x.rank}</b><div><strong>{x.concept}</strong><p><b>HOOK</b>　{x.hook}</p><p>{x.reason}</p><small>{x.channel} · {x.format} · 検証: {x.testMetric}</small></div></article>)}</div></section>
      <Section title="集客課題"><List items={result.analysis.acquisitionProblems}/></Section>
      <Section title="集客機会"><List items={result.analysis.opportunities}/></Section>
      <Section title="すぐやること"><List items={result.analysis.nextActions}/></Section>
      {result.analysis.socialSignals?.length > 0 && <Section title="SNS実データ"><div className="action-list">{result.analysis.socialSignals.map((x, i) => <article key={i}><b>{i + 1}</b><div><a href={x.url} target="_blank" rel="noreferrer"><strong>{x.title}</strong></a><p>@{x.author}</p><small>TikTok · 再生 {x.views ?? "-"} · いいね {x.likes ?? "-"} · コメント {x.comments ?? "-"} · シェア {x.shares ?? "-"}</small></div></article>)}</div></Section>}
      {result.analysis.searchEvidence?.length > 0 && <Section title="検索エビデンス"><List items={result.analysis.searchEvidence.map(x => x.title + " — " + x.url + " — " + x.snippet)}/></Section>}
      <p className="ai-note">{result.analysis.aiConnected ? "AI分析: 接続済み" : "AI分析: 未接続（ページ抽出ベース）"}</p>
    </div>}
  </main>;
}
