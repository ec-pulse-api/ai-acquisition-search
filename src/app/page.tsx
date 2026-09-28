"use client";

import { FormEvent, useState } from "react";
import GoogleSignIn from "@/components/GoogleSignIn";
import BillingButton from "@/components/BillingButton";
import LinkedInConnect from "@/components/LinkedInConnect";
import type { AcquisitionAnalyzeResult, EcPulseResearchBundle, EcPulseResearchRun } from "@/lib/acquisition/types";

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
  const [ecPulseLoading, setEcPulseLoading] = useState(false);
  const [testSaving, setTestSaving] = useState(false);
  const [testSaved, setTestSaved] = useState("");
  const [metricsOpen, setMetricsOpen] = useState(false);
  const [metrics, setMetrics] = useState({ impressions:"", views:"", clicks:"", conversions:"", revenue:"", grossProfit:"", adSpend:"" });
  const [verdict, setVerdict] = useState<{verdict:string;reason:string}|null>(null);
  const [socialPostId, setSocialPostId] = useState("");
  const [researchHistory, setResearchHistory] = useState<EcPulseResearchRun[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);


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

      setHistoryLoading(true);
      try {
        const historyResponse = await fetch("/api/ec-pulse-research/history?url=" + encodeURIComponent(url) + "&limit=8", {
          cache: "no-store"
        });
        const historyData = await historyResponse.json().catch(() => ({}));
        setResearchHistory(historyData.runs || []);
      } catch {
        setResearchHistory([]);
      } finally {
        setHistoryLoading(false);
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

  async function saveTestPlan() {
    if (!result) return;
    setTestSaving(true);
    setTestSaved("");
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) throw new Error("Supabase設定がありません。");
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, anonKey);
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("先にGoogleでログインしてください。");
      const res = await fetch("/api/operator/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.session.access_token}` },
        body: JSON.stringify({ source: result.source, analysis: result.analysis }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error || "テスト計画の保存に失敗しました。");
      setSocialPostId(body.socialPostId || "");
      setTestSaved(body.message || "テスト計画を保存しました。");
    } catch (err) {
      setError(err instanceof Error ? err.message : "テスト計画の保存に失敗しました。");
    } finally {
      setTestSaving(false);
    }
  }

  async function saveMetrics() {
    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
      if (!supabaseUrl || !anonKey) throw new Error("Supabase設定がありません。");
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(supabaseUrl, anonKey);
      const { data } = await supabase.auth.getSession();
      if (!data.session) throw new Error("先にGoogleでログインしてください。");
      const saved = await fetch("/api/operator/metrics", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`}, body:JSON.stringify({...metrics, socialPostId}) });
      const body = await saved.json();
      if (!saved.ok) throw new Error(body.error || "実績保存に失敗しました。");
      if (!socialPostId) throw new Error("先に「このテスト計画を保存」してください。");
      const decision = await fetch("/api/operator/decision", { method:"POST", headers:{"Content-Type":"application/json",Authorization:`Bearer ${data.session.access_token}`}, body:JSON.stringify({socialPostId}) });
      const verdictBody = await decision.json();
      if (!decision.ok) throw new Error(verdictBody.error || "判定に失敗しました。");
      setVerdict({verdict:verdictBody.verdict, reason:verdictBody.reason});
    } catch(err) { setError(err instanceof Error ? err.message : "実績保存に失敗しました。"); }
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
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <span className="status">AI AD OPERATOR</span>
          <GoogleSignIn />
          <a href="/billing" style={{ color: "#ffffff70", fontSize: 11 }}>契約管理</a>
        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">AI CUSTOMER ACQUISITION</p>
        <h1>
          市場の声から、
          <br />
          <span>次の商品と広告を決める。</span>
        </h1>
        <p className="lead">
          商品URLから市場・レビュー・顧客の痛点を調査。頻出する不満から商品候補と広告訴求を作り、次のテストまでつなげます。
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
        <div className="hero-proof">
          <div><b>01</b><strong>市場を調査</strong><span>レビュー・コメントから顧客の声を集計</span></div>
          <div><b>02</b><strong>痛点から商品を探す</strong><span>頻出する不満を商品候補と設計方向へ</span></div>
          <div><b>03</b><strong>広告をテストする</strong><span>痛点をHookに変えて次の検証へ</span></div>
        </div>
        <div className="hero-loop">
          <span>RESEARCH</span><i>→</i><span>PAIN POINT</span><i>→</i><span>PRODUCT</span><i>→</i><span>AD TEST</span><i>→</i><span>LEARN</span>
        </div>
        <p className="hint">まずは商品URLを入力。調査結果は履歴として蓄積し、再調査で変化を追えます。</p>
      </section>

      <LinkedInConnect socialPostId={socialPostId} />

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

          <section className="research-history">
            <div className="research-head">
              <div>
                <p className="eyebrow">RESEARCH HISTORY</p>
                <h2>調査を蓄積して、変化を見る</h2>
                <p>同じ商品を再調査するたびに、前回の痛点と比較できるように履歴を残します。</p>
              </div>
              <span className="history-count">{historyLoading ? "LOADING" : `${researchHistory.length} RUNS`}</span>
            </div>
            {researchHistory.length > 0 ? (
              <div className="history-list">
                {researchHistory.map((run, index) => (
                  <article className="history-row" key={run.run_id}>
                    <div className="history-index">{String(researchHistory.length - index).padStart(2, "0")}</div>
                    <div>
                      <strong>{new Date(run.captured_at).toLocaleString("ja-JP")}</strong>
                      <small>{run.comments_count}件のコメント · {run.market || "GLOBAL"} · {run.source_type || "research"}</small>
                    </div>
                    <div className="history-pain">
                      {run.top_pain ? <><span>TOP PAIN</span><strong>{run.top_pain.pain}</strong><small>{run.top_pain.count}件 / {run.top_pain.share_percent}%</small></> : <span>痛点データなし</span>}
                    </div>
                    <div className="history-trend">
                      {run.trend?.emerging_pains?.[0] ? (() => {
                        const pain = run.trend.emerging_pains[0];
                        const delta = pain.share_delta_percent;
                        return (
                          <>
                            <span className={pain.status === "new" ? "trend-new" : "trend-rising"}>{pain.status === "new" ? "NEW" : "RISING"}</span>
                            <strong>{pain.pain}</strong>
                            <small>{delta >= 0 ? "+" : ""}{delta}pt · {pain.current_share_percent}%</small>
                          </>
                        );
                      })() : run.trend?.signal === "no_previous_run" ? (
                        <><span className="trend-neutral">BASELINE</span><small>次回調査から変化を比較</small></>
                      ) : (
                        <><span className="trend-neutral">STABLE</span><small>大きな上昇シグナルなし</small></>
                      )}
                    </div>
                  </article>
                ))}
              </div>
            ) : !historyLoading ? (
              <div className="history-empty">
                <strong>まだ比較できる履歴はありません。</strong>
                <span>この商品をもう一度調査すると、痛点の増減を追えるようになります。</span>
              </div>
            ) : null}
          </section>

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

          <section className="next performance-loop">
            <p className="eyebrow">PERFORMANCE LOOP</p>
            <h2>投稿結果を入れて、次の判断へ</h2>
            <p className="hint">投稿後の数字を保存すると、AIが継続・ピボット・停止の次アクションを判断します。</p>
            <button type="button" onClick={()=>setMetricsOpen(!metricsOpen)}>{metricsOpen ? "入力を閉じる" : "実績を入力する"}</button>
            {metricsOpen && <div className="metrics-form">
              {(["impressions","views","clicks","conversions","revenue","grossProfit","adSpend"] as const).map(k=><label key={k}>{k}<input type="number" value={metrics[k]} onChange={e=>setMetrics({...metrics,[k]:e.target.value})}/></label>)}
              <p className="hint">テスト計画を保存すると投稿IDが自動発行されます。投稿後の実績を入力してください。</p>
              <button type="button" onClick={saveMetrics}>実績を保存してAI判定</button>
            </div>}
            {verdict && <div className="verdict"><strong>{verdict.verdict}</strong><p>{verdict.reason}</p></div>}
          </section>

          <section className="next test-loop">
            <p className="eyebrow">AD TEST LOOP</p>
            <h2>次の広告を「テスト」として残す</h2>
            <p className="hint">今回の判断を仮説として保存し、投稿結果をもとに次のテストへつなげます。</p>
            <div className="test-loop-grid">
              <article><span>仮説</span><strong>{result.analysis.decision.valueProposition}</strong><p>{result.analysis.decision.testPlan}</p></article>
              <article><span>最初に試す</span><strong>{result.analysis.nextPosts[0]?.hook || "次の投稿仮説"}</strong><p>{result.analysis.nextPosts[0]?.channel} · {result.analysis.nextPosts[0]?.format}</p></article>
              <article><span>見る数字</span><strong>{result.analysis.nextPosts[0]?.testMetric || "CTR / CVR / CPA"}</strong><p>結果を取得したら、次の訴求・クリエイティブを変更します。</p></article>
            </div>
            <button type="button" onClick={saveTestPlan} disabled={testSaving}>
              {testSaving ? "保存中..." : "このテスト計画を保存"}
            </button>
            {testSaved && <p className="success">{testSaved}</p>}
          </section>

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


      <section className="next">
        <p className="eyebrow">MONETIZATION</p>
        <h2>AI集客を継続運用する</h2>
        <p className="hint">無料で入口を試し、Proでは広告テストを継続。結果を蓄積して次の施策につなげます。</p>
        <div className="action-list">
          <article>
            <b>FREE</b>
            <div><strong>まず試す</strong><p>商品分析・顧客分析・次の集客アクションを利用。</p><small>月5回まで</small></div>
          </article>
          <article>
            <b>PRO</b>
            <div><strong>広告運用を回す</strong><p>継続的なテスト、クリエイティブ生成、結果学習を想定。</p><small>月額4,980円（税込）</small><div style={{ marginTop: 10 }}><BillingButton /></div></div>
          </article>
          <article>
            <b>AGENCY</b>
            <div><strong>複数商品を運用</strong><p>複数商品の運用・チーム利用向け。</p><small>複数商品・チーム運用向け（順次提供）</small></div>
          </article>
        </div>
      </section>

          <p className="ai-note">
            {result.analysis.aiConnected ? "AI分析: 接続済み" : "AI分析: 未接続（ページ抽出ベース）"}
          </p>
        </div>
      )}
    </main>
  );
}
