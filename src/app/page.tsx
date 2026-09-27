"use client";

import { FormEvent, useState } from "react";
import type { AcquisitionAnalyzeResult } from "@/lib/acquisition/types";

function List({ items }: { items: string[] }) {
  return (
    <ul className="list">
      {items.filter(Boolean).map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <p className="eyebrow">{title}</p>
      {children}
    </section>
  );
}

export default function Home() {
  const [url, setUrl] = useState("");
  const [result, setResult] = useState<AcquisitionAnalyzeResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [narrationText, setNarrationText] = useState("");
  const [narrationAudio, setNarrationAudio] = useState("");
  const [narrationLoading, setNarrationLoading] = useState(false);

  async function analyze(e?: FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "分析に失敗しました。");

      setResult(data.data);
      const decision = data.data.analysis.decision;
      setNarrationText(
        `${decision.target}に向けて、${decision.problem}。だからこそ、${decision.valueProposition}。まずは${decision.channel}で${decision.format}を試してみましょう。`
      );
      setNarrationAudio("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "分析に失敗しました。");
    } finally {
      setLoading(false);
    }
  }

  async function generateNarration() {
    setNarrationLoading(true);
    setError("");

    try {
      const res = await fetch("/api/narration", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text: narrationText,
          voice: "Kore",
          style: "自然で明るく、信頼感のある日本語広告ナレーション",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "ナレーション生成に失敗しました。");
      setNarrationAudio(`data:${data.data.mimeType};base64,${data.data.audioBase64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "ナレーション生成に失敗しました。");
    } finally {
      setNarrationLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <strong>AI Acquisition Search</strong>
          <span>AI集客検索エンジン</span>
        </div>
        <span className="status">Customer Acquisition Intelligence</span>
      </header>

      <section className="hero">
        <p className="eyebrow">AI CUSTOMER ACQUISITION</p>
        <h1>
          商品・サービスURLから、
          <br />
          <span>次にやる集客を判断する。</span>
        </h1>
        <p className="lead">
          商品・市場・顧客・競合・実績を分析し、集客課題・機会・優先順位・次に取るべき集客アクションを整理します。
        </p>

        <form onSubmit={analyze} className="search">
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/product"
            type="url"
            required
          />
          <button disabled={loading}>
            {loading ? "集客分析中..." : "集客分析を開始"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
        <p className="hint">
          公開HTMLページを分析します。AIキー未設定時は抽出情報ベースの予備分析を返します。
        </p>
      </section>

      {result && (
        <div className="results">
          <div className="source">
            <span>分析対象</span>
            <a href={result.source.url} target="_blank" rel="noreferrer">
              {result.source.title || result.source.url}
            </a>
            <small>{result.source.url}</small>
          </div>

          <Section title="01 商品分析">
            <h2>{result.analysis.product.summary}</h2>
            <List items={result.analysis.product.valueProposition} />
          </Section>

          <Section title="02 市場分析">
            <h2>{result.analysis.market.summary}</h2>
            <List items={result.analysis.market.signals} />
          </Section>

          <Section title="03 顧客分析">
            <h2>{result.analysis.customer.summary}</h2>
            <List items={[...result.analysis.customer.likelySegments, ...result.analysis.customer.needs]} />
          </Section>

          <Section title="04 競合分析">
            <h2>{result.analysis.competitors.summary}</h2>
            <List items={result.analysis.competitors.signals} />
          </Section>

          <Section title="05 実績分析">
            <h2>{result.analysis.performance.summary}</h2>
            <List
              items={[
                ...result.analysis.performance.availableEvidence,
                ...result.analysis.performance.missingData.map((item) => "不足: " + item),
              ]}
            />
          </Section>

          <section className="next">
            <p className="eyebrow">DECISION ENGINE</p>
            <h2>次に何をすべきか</h2>
            <article className="decision">
              <strong>狙う顧客</strong>
              <p>{result.analysis.decision.target}</p>
              <strong>顧客の問題</strong>
              <p>{result.analysis.decision.problem}</p>
              <strong>欲求</strong>
              <p>{result.analysis.decision.desire}</p>
              <strong>訴求</strong>
              <p>{result.analysis.decision.valueProposition}</p>
              <strong>媒体</strong>
              <p>{result.analysis.decision.channel}</p>
              <strong>投稿形式</strong>
              <p>{result.analysis.decision.format}</p>
              <strong>検証方法</strong>
              <p>{result.analysis.decision.testPlan}</p>
              {result.analysis.decision.evidence?.length > 0 && (
                <>
                  <strong>根拠</strong>
                  <List items={result.analysis.decision.evidence} />
                </>
              )}
            </article>
          </section>

          <section className="next">
            <p className="eyebrow">NEXT ACTION</p>
            <h2>次にやるべき集客</h2>
            <div className="action-list">
              {result.analysis.priorities.map((item) => (
                <article key={item.priority}>
                  <b>#{item.priority}</b>
                  <div>
                    <strong>{item.action}</strong>
                    <p>{item.reason}</p>
                    <small>{item.channel}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section className="next">
            <p className="eyebrow">NEXT POSTS</p>
            <h2>次に出す投稿</h2>
            <div className="action-list">
              {result.analysis.nextPosts.map((item) => (
                <article key={item.rank}>
                  <b>#{item.rank}</b>
                  <div>
                    <strong>{item.concept}</strong>
                    <p><b>HOOK</b>　{item.hook}</p>
                    <p>{item.reason}</p>
                    <small>{item.channel} · {item.format} · 検証: {item.testMetric}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <Section title="集客課題"><List items={result.analysis.acquisitionProblems} /></Section>
          <Section title="集客機会"><List items={result.analysis.opportunities} /></Section>
          <Section title="すぐやること"><List items={result.analysis.nextActions} /></Section>

          {result.analysis.socialSignals?.length > 0 && (
            <Section title="SNS実データ">
              <div className="action-list">
                {result.analysis.socialSignals.map((item, index) => (
                  <article key={index}>
                    <b>{index + 1}</b>
                    <div>
                      <a href={item.url} target="_blank" rel="noreferrer">
                        <strong>{item.title}</strong>
                      </a>
                      <p>@{item.author}</p>
                      <small>
                        TikTok · 再生 {item.views ?? "-"} · いいね {item.likes ?? "-"} · コメント {item.comments ?? "-"} · シェア {item.shares ?? "-"}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {result.analysis.shopSignals?.length > 0 && (
            <Section title="TikTok Shop競合">
              <div className="action-list">
                {result.analysis.shopSignals.map((item, index) => (
                  <article key={index}>
                    <b>{index + 1}</b>
                    <div>
                      <a href={item.url || "#"} target="_blank" rel="noreferrer">
                        <strong>{item.title}</strong>
                      </a>
                      <p>{item.seller || "販売者不明"}</p>
                      <small>
                        価格 {item.price ?? "-"} {item.currency} · 販売数 {item.sales ?? "-"} · 評価 {item.rating ?? "-"} · レビュー {item.reviewCount ?? "-"}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {result.analysis.searchEvidence?.length > 0 && (
            <Section title="検索エビデンス">
              <List items={result.analysis.searchEvidence.map((item) => item.title + " — " + item.url + " — " + item.snippet)} />
            </Section>
          )}

          <section className="next">
            <p className="eyebrow">VIDEO ENGINE</p>
            <h2>Gemini TTS ナレーション</h2>
            <p className="hint">
              集客判断からナレーション本文を作り、Gemini TTSでWAV音声を生成します。
            </p>
            <textarea
              value={narrationText}
              onChange={(e) => setNarrationText(e.target.value)}
              rows={5}
              style={{ width: "100%", marginBottom: 12 }}
              placeholder="ナレーション本文"
            />
            <button
              type="button"
              disabled={narrationLoading || !narrationText.trim()}
              onClick={generateNarration}
            >
              {narrationLoading ? "音声生成中..." : "ナレーションを生成"}
            </button>

            {narrationAudio && (
              <div style={{ marginTop: 16 }}>
                <audio controls src={narrationAudio} style={{ width: "100%" }} />
                <a href={narrationAudio} download="narration.wav" style={{ display: "inline-block", marginTop: 8 }}>
                  WAVを保存
                </a>
              </div>
            )}
          </section>

          <p className="ai-note">
            {result.analysis.aiConnected ? "AI分析: 接続済み" : "AI分析: 未接続（ページ抽出ベース）"}
          </p>
        </div>
      )}
    </main>
  );
}
