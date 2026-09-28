"use client";

import { FormEvent, useState } from "react";
import type { AcquisitionAnalyzeResult, EcPulseResearchBundle } from "@/lib/acquisition/types";

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
  const [ecPulse, setEcPulse] = useState<EcPulseResearchBundle | null>(null);
  const [ecPulseLoading, setEcPulseLoading] = useState(false);\n  const [batchUrls, setBatchUrls] = useState("");\n  const [batchResult, setBatchResult] = useState<any>(null);\n  const [batchLoading, setBatchLoading] = useState(false);

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
      setEcPulse(null);
      setEcPulseLoading(true);
      try {
        const researchRes = await fetch("/api/ec-pulse-research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        });
        const researchData = await researchRes.json();
        setEcPulse(researchData);
      } catch {
        setEcPulse({ connected: false, research: null, products: [], error: "EC Pulseリサーチに接続できませんでした。" });
      } finally {
        setEcPulseLoading(false);
      }
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

  async function runBatchResearch() {
    const urls = [...new Set(batchUrls.split(/[\\n,]+/).map((item) => item.trim()).filter(Boolean))].slice(0, 20);
    if (!urls.length) return;
    setBatchLoading(true);
    setBatchResult(null);
    setError("");
    try {
      const res = await fetch("/api/ec-pulse-research-batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ urls }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "一括リサーチに失敗しました。");
      setBatchResult(data);
    } catch (err) {
      setBatchResult({ connected: false, results: [], error: err instanceof Error ? err.message : "一括リサーチに失敗しました。" });
    } finally {
      setBatchLoading(false);
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

          <section className="research-flow">
            <div className="research-head">
              <div>
                <p className="eyebrow">EC PULSE RESEARCH LOOP</p>
                <h2>市場リサーチ → 痛点 → 商品候補 → 広告訴求</h2>
                <p>公開レビューを集計し、頻出する顧客痛点から商品候補と広告テスト案までつなげます。</p>
              </div>
              <span className={ecPulse?.connected ? "pulse-on" : "pulse-off"}>
                {ecPulseLoading ? "RESEARCHING" : ecPulse?.connected ? "EC PULSE CONNECTED" : "NOT CONNECTED"}
              </span>
            </div>
            {ecPulseLoading && <div className="research-loading">公開コメントを収集 → 痛点を集計 → 商品候補を検索中…</div>}
            {!ecPulseLoading && ecPulse?.error && <div className="research-error">{ecPulse.error}</div>}
            {!ecPulseLoading && ecPulse?.research?.analysis && (
              <div className="research-grid">
                <article className="research-card">
                  <p className="eyebrow">01 PAIN POINTS</p>
                  <h3>頻出する顧客の痛み</h3>
                  <div className="pain-list">
                    {ecPulse.research.analysis.pain_points.slice(0, 5).map((pain) => (
                      <div key={pain.pain} className="pain-row">
                        <div><strong>{pain.pain}</strong><small>{pain.count}件 · {pain.share_percent}%</small></div>
                        <span>{pain.examples?.[0] || "レビュー例なし"}</span>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="research-card">
                  <p className="eyebrow">02 AD ANGLES</p>
                  <h3>広告で検証する訴求</h3>
                  <div className="angle">
                    <strong>{ecPulse.research.analysis.recommended_angle || "頻出痛点を訴求軸として検証"}</strong>
                    <ul>
                      {(ecPulse.research.analysis.ad_copy_candidates || []).slice(0, 4).map((copy, index) => <li key={index}>{copy}</li>)}
                    </ul>
                  </div>
                </article>
                <article className="research-card candidates">
                  <p className="eyebrow">03 PRODUCT CANDIDATES</p>
                  <h3>痛点から探した商品候補</h3>
                  {ecPulse.products.length ? ecPulse.products.slice(0, 8).map((product, index) => (
                    <div className="candidate" key={product.url || product.title || String(index)}>
                      <div><strong>{product.title || "商品候補"}</strong><small>{product.marketplace || "market"} · {product.price ?? "-"} {product.currency || ""}</small></div>
                      {product.url && <a href={product.url} target="_blank" rel="noreferrer">見る →</a>}
                    </div>
                  )) : <p className="muted">痛点に紐づく商品候補を取得できませんでした。</p>}
                </article>
                {ecPulse.opportunity && (
                  <article className="research-card opportunity">
                    <p className="eyebrow">04 OPPORTUNITY ENGINE</p>
                    <h3>痛点 → 商品設計 → 広告テスト</h3>
                    {ecPulse.opportunity.top_pain && (
                      <p><strong>最重要痛点：</strong>{ecPulse.opportunity.top_pain.pain}（{ecPulse.opportunity.top_pain.count}件 / {ecPulse.opportunity.top_pain.share_percent}%）</p>
                    )}
                    {(ecPulse.opportunity.ad_test_angles || []).slice(0, 3).map((angle, index) => (
                      <div className="angle" key={index}>
                        <strong>{angle.hook}</strong>
                        <small>{angle.proof}</small>
                      </div>
                    ))}
                    {(ecPulse.opportunity.next_actions || []).slice(0, 3).map((action, index) => (
                      <small key={index}>→ {action}</small>
                    ))}
                  </article>
                )}
                <article className="research-card">
                  <p className="eyebrow">05 NEXT TEST</p>
                  <h3>次の広告テスト</h3>
                  <p className="test-copy">「{ecPulse.research.analysis.recommended_angle || "最頻出の顧客痛点"}」を主訴求にして、短尺動画・静止画の2パターンを作成。クリック率と購入率で比較します。</p>
                  {ecPulse.research.analysis.next_action && <small>{ecPulse.research.analysis.next_action}</small>}
                </article>
              </div>
            )}
          </section>

          {batchResult && (
            <section className="research-flow batch-results">
              <div className="research-head">
                <div>
                  <p className="eyebrow">CROSS-SOURCE SIGNALS</p>
                  <h2>複数ソース横断の痛点シグナル</h2>
                </div>
                <span className={batchResult.connected ? "pulse-on" : "pulse-off"}>
                  {batchResult.connected ? "BATCH CONNECTED" : "BATCH ERROR"}
                </span>
              </div>
              {batchResult.error && <div className="research-error">{batchResult.error}</div>}
              {batchResult.summary && (
                <div className="research-grid">
                  <article className="research-card">
                    <p className="eyebrow">SUMMARY</p>
                    <h3>横断集計</h3>
                    <p>URL {batchResult.summary.urls_analyzed ?? 0}件 · コメント {batchResult.summary.comments_analyzed ?? 0}件</p>
                    {(batchResult.summary.top_pains || []).slice(0, 8).map((pain: any, index: number) => (
                      <div className="pain-row" key={pain.pain || index}>
                        <div><strong>{pain.pain}</strong><small>{pain.count}件</small></div>
                        <span>{pain.sources ?? 0}ソース</span>
                      </div>
                    ))}
                  </article>
                  <article className="research-card">
                    <p className="eyebrow">RISING PAINS</p>
                    <h3>上昇している痛点</h3>
                    {(batchResult.summary.rising_pains || []).slice(0, 8).map((pain: any, index: number) => (
                      <div className="angle" key={pain.pain || index}>
                        <strong>{pain.pain}</strong>
                        <small>件数差 {pain.count_delta > 0 ? "+" : ""}{pain.count_delta} · シェア差 {pain.share_delta_percent > 0 ? "+" : ""}{pain.share_delta_percent}%</small>
                      </div>
                    ))}
                    {!batchResult.summary.rising_pains?.length && <p className="muted">今回の比較では上昇痛点はまだ検出されていません。</p>}
                  </article>
                  <article className="research-card">
                    <p className="eyebrow">SOURCE MIX</p>
                    <h3>市場・ソース構成</h3>
                    {Object.entries(batchResult.summary.source_counts || {}).map(([source, count]) => (
                      <p key={source}><strong>{source}</strong> · {String(count)}件</p>
                    ))}
                    {Object.entries(batchResult.summary.market_counts || {}).map(([market, count]) => (
                      <p key={market}><strong>{market}</strong> · {String(count)}件</p>
                    ))}
                  </article>
                </div>
              )}
            </section>
          )}

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
