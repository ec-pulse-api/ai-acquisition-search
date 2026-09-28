"use client";

import { FormEvent, useState } from "react";`r`nimport GoogleSignIn from "@/components/GoogleSignIn";
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
  const [ecPulseLoading, setEcPulseLoading] = useState(false);

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
      if (!res.ok) throw new Error(data.error || "蛻・梵縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);

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
        setEcPulse({ connected: false, research: null, products: [], error: "EC Pulse繝ｪ繧ｵ繝ｼ繝√↓謗･邯壹〒縺阪∪縺帙ｓ縺ｧ縺励◆縲・ });
      } finally {
        setEcPulseLoading(false);
      }
      const decision = data.data.analysis.decision;
      setNarrationText(
        `${decision.target}縺ｫ蜷代￠縺ｦ縲・{decision.problem}縲ゅ□縺九ｉ縺薙◎縲・{decision.valueProposition}縲ゅ∪縺壹・${decision.channel}縺ｧ${decision.format}繧定ｩｦ縺励※縺ｿ縺ｾ縺励ｇ縺・Ａ
      );
      setNarrationAudio("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "蛻・梵縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
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
          style: "閾ｪ辟ｶ縺ｧ譏弱ｋ縺上∽ｿ｡鬆ｼ諢溘・縺ゅｋ譌･譛ｬ隱槫ｺ・相繝翫Ξ繝ｼ繧ｷ繝ｧ繝ｳ",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "繝翫Ξ繝ｼ繧ｷ繝ｧ繝ｳ逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
      setNarrationAudio(`data:${data.data.mimeType};base64,${data.data.audioBase64}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "繝翫Ξ繝ｼ繧ｷ繝ｧ繝ｳ逕滓・縺ｫ螟ｱ謨励＠縺ｾ縺励◆縲・);
    } finally {
      setNarrationLoading(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <strong>AI Acquisition Search</strong>
          <span>AI髮・ｮ｢讀懃ｴ｢繧ｨ繝ｳ繧ｸ繝ｳ</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>`r`n          <span className="status">Customer Acquisition Intelligence</span>`r`n          <GoogleSignIn />`r`n        </div>
      </header>

      <section className="hero">
        <p className="eyebrow">AI CUSTOMER ACQUISITION</p>
        <h1>
          蝠・刀繝ｻ繧ｵ繝ｼ繝薙せURL縺九ｉ縲・
          <br />
          <span>谺｡縺ｫ繧・ｋ髮・ｮ｢繧貞愛譁ｭ縺吶ｋ縲・/span>
        </h1>
        <p className="lead">
          蝠・刀繝ｻ蟶ょｴ繝ｻ鬘ｧ螳｢繝ｻ遶ｶ蜷医・螳溽ｸｾ繧貞・譫舌＠縲・寔螳｢隱ｲ鬘後・讖滉ｼ壹・蜆ｪ蜈磯・ｽ阪・谺｡縺ｫ蜿悶ｋ縺ｹ縺埼寔螳｢繧｢繧ｯ繧ｷ繝ｧ繝ｳ繧呈紛逅・＠縺ｾ縺吶・
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
            {loading ? "髮・ｮ｢蛻・梵荳ｭ..." : "髮・ｮ｢蛻・梵繧帝幕蟋・}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
        <p className="hint">
          蜈ｬ髢稀TML繝壹・繧ｸ繧貞・譫舌＠縺ｾ縺吶・I繧ｭ繝ｼ譛ｪ險ｭ螳壽凾縺ｯ謚ｽ蜃ｺ諠・ｱ繝吶・繧ｹ縺ｮ莠亥ｙ蛻・梵繧定ｿ斐＠縺ｾ縺吶・
        </p>
      </section>

      {result && (
        <div className="results">
          <div className="source">
            <span>蛻・梵蟇ｾ雎｡</span>
            <a href={result.source.url} target="_blank" rel="noreferrer">
              {result.source.title || result.source.url}
            </a>
            <small>{result.source.url}</small>
          </div>

          <section className="research-flow">
            <div className="research-head">
              <div>
                <p className="eyebrow">EC PULSE RESEARCH LOOP</p>
                <h2>蟶ょｴ繝ｪ繧ｵ繝ｼ繝・竊・逞帷せ 竊・蝠・刀蛟呵｣・竊・蠎・相險ｴ豎・/h2>
                <p>蜈ｬ髢九Ξ繝薙Η繝ｼ繧帝寔險医＠縲・ｻ蜃ｺ縺吶ｋ鬘ｧ螳｢逞帷せ縺九ｉ蝠・刀蛟呵｣懊→蠎・相繝・せ繝域｡医∪縺ｧ縺､縺ｪ縺偵∪縺吶・/p>
              </div>
              <span className={ecPulse?.connected ? "pulse-on" : "pulse-off"}>
                {ecPulseLoading ? "RESEARCHING" : ecPulse?.connected ? "EC PULSE CONNECTED" : "NOT CONNECTED"}
              </span>
            </div>
            {ecPulseLoading && <div className="research-loading">蜈ｬ髢九さ繝｡繝ｳ繝医ｒ蜿朱寔 竊・逞帷せ繧帝寔險・竊・蝠・刀蛟呵｣懊ｒ讀懃ｴ｢荳ｭ窶ｦ</div>}
            {!ecPulseLoading && ecPulse?.error && <div className="research-error">{ecPulse.error}</div>}
            {!ecPulseLoading && ecPulse?.research?.analysis && (
              <div className="research-grid">
                <article className="research-card">
                  <p className="eyebrow">01 PAIN POINTS</p>
                  <h3>鬆ｻ蜃ｺ縺吶ｋ鬘ｧ螳｢縺ｮ逞帙∩</h3>
                  <div className="pain-list">
                    {ecPulse.research.analysis.pain_points.slice(0, 5).map((pain) => (
                      <div key={pain.pain} className="pain-row">
                        <div><strong>{pain.pain}</strong><small>{pain.count}莉ｶ ﾂｷ {pain.share_percent}%</small></div>
                        <span>{pain.examples?.[0] || "繝ｬ繝薙Η繝ｼ萓九↑縺・}</span>
                      </div>
                    ))}
                  </div>
                </article>
                <article className="research-card">
                  <p className="eyebrow">02 AD ANGLES</p>
                  <h3>蠎・相縺ｧ讀懆ｨｼ縺吶ｋ險ｴ豎・/h3>
                  <div className="angle">
                    <strong>{ecPulse.research.analysis.recommended_angle || "鬆ｻ蜃ｺ逞帷せ繧定ｨｴ豎りｻｸ縺ｨ縺励※讀懆ｨｼ"}</strong>
                    <ul>
                      {(ecPulse.research.analysis.ad_copy_candidates || []).slice(0, 4).map((copy, index) => <li key={index}>{copy}</li>)}
                    </ul>
                  </div>
                </article>
                <article className="research-card candidates">
                  <p className="eyebrow">03 PRODUCT CANDIDATES</p>
                  <h3>逞帷せ縺九ｉ謗｢縺励◆蝠・刀蛟呵｣・/h3>
                  {ecPulse.products.length ? ecPulse.products.slice(0, 8).map((product, index) => (
                    <div className="candidate" key={product.url || product.title || String(index)}>
                      <div><strong>{product.title || "蝠・刀蛟呵｣・}</strong><small>{product.marketplace || "market"} ﾂｷ {product.price ?? "-"} {product.currency || ""}</small></div>
                      {product.url && <a href={product.url} target="_blank" rel="noreferrer">隕九ｋ 竊・/a>}
                    </div>
                  )) : <p className="muted">逞帷せ縺ｫ邏舌▼縺丞膚蜩∝呵｣懊ｒ蜿門ｾ励〒縺阪∪縺帙ｓ縺ｧ縺励◆縲・/p>}
                </article>
                {ecPulse.opportunity && (
                  <article className="research-card opportunity">
                    <p className="eyebrow">04 OPPORTUNITY ENGINE</p>
                    <h3>逞帷せ 竊・蝠・刀險ｭ險・竊・蠎・相繝・せ繝・/h3>
                    {ecPulse.opportunity.top_pain && (
                      <p><strong>譛驥崎ｦ∫李轤ｹ・・/strong>{ecPulse.opportunity.top_pain.pain}・・ecPulse.opportunity.top_pain.count}莉ｶ / {ecPulse.opportunity.top_pain.share_percent}%・・/p>
                    )}
                    {(ecPulse.opportunity.ad_test_angles || []).slice(0, 3).map((angle, index) => (
                      <div className="angle" key={index}>
                        <strong>{angle.hook}</strong>
                        <small>{angle.proof}</small>
                      </div>
                    ))}
                    {(ecPulse.opportunity.next_actions || []).slice(0, 3).map((action, index) => (
                      <small key={index}>竊・{action}</small>
                    ))}
                  </article>
                )}
                <article className="research-card">
                  <p className="eyebrow">05 NEXT TEST</p>
                  <h3>谺｡縺ｮ蠎・相繝・せ繝・/h3>
                  <p className="test-copy">縲鶏ecPulse.research.analysis.recommended_angle || "譛鬆ｻ蜃ｺ縺ｮ鬘ｧ螳｢逞帷せ"}縲阪ｒ荳ｻ險ｴ豎ゅ↓縺励※縲∫洒蟆ｺ蜍慕判繝ｻ髱呎ｭ｢逕ｻ縺ｮ2繝代ち繝ｼ繝ｳ繧剃ｽ懈・縲ゅけ繝ｪ繝・け邇・→雉ｼ蜈･邇・〒豈碑ｼ・＠縺ｾ縺吶・/p>
                  {ecPulse.research.analysis.next_action && <small>{ecPulse.research.analysis.next_action}</small>}
                </article>
              </div>
            )}
          </section>

          <Section title="01 蝠・刀蛻・梵">
            <h2>{result.analysis.product.summary}</h2>
            <List items={result.analysis.product.valueProposition} />
          </Section>

          <Section title="02 蟶ょｴ蛻・梵">
            <h2>{result.analysis.market.summary}</h2>
            <List items={result.analysis.market.signals} />
          </Section>

          <Section title="03 鬘ｧ螳｢蛻・梵">
            <h2>{result.analysis.customer.summary}</h2>
            <List items={[...result.analysis.customer.likelySegments, ...result.analysis.customer.needs]} />
          </Section>

          <Section title="04 遶ｶ蜷亥・譫・>
            <h2>{result.analysis.competitors.summary}</h2>
            <List items={result.analysis.competitors.signals} />
          </Section>

          <Section title="05 螳溽ｸｾ蛻・梵">
            <h2>{result.analysis.performance.summary}</h2>
            <List
              items={[
                ...result.analysis.performance.availableEvidence,
                ...result.analysis.performance.missingData.map((item) => "荳崎ｶｳ: " + item),
              ]}
            />
          </Section>

          <section className="next">
            <p className="eyebrow">DECISION ENGINE</p>
            <h2>谺｡縺ｫ菴輔ｒ縺吶∋縺阪°</h2>
            <article className="decision">
              <strong>迢吶≧鬘ｧ螳｢</strong>
              <p>{result.analysis.decision.target}</p>
              <strong>鬘ｧ螳｢縺ｮ蝠城｡・/strong>
              <p>{result.analysis.decision.problem}</p>
              <strong>谺ｲ豎・/strong>
              <p>{result.analysis.decision.desire}</p>
              <strong>險ｴ豎・/strong>
              <p>{result.analysis.decision.valueProposition}</p>
              <strong>蟐剃ｽ・/strong>
              <p>{result.analysis.decision.channel}</p>
              <strong>謚慕ｨｿ蠖｢蠑・/strong>
              <p>{result.analysis.decision.format}</p>
              <strong>讀懆ｨｼ譁ｹ豕・/strong>
              <p>{result.analysis.decision.testPlan}</p>
              {result.analysis.decision.evidence?.length > 0 && (
                <>
                  <strong>譬ｹ諡</strong>
                  <List items={result.analysis.decision.evidence} />
                </>
              )}
            </article>
          </section>

          <section className="next">
            <p className="eyebrow">NEXT ACTION</p>
            <h2>谺｡縺ｫ繧・ｋ縺ｹ縺埼寔螳｢</h2>
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
            <h2>谺｡縺ｫ蜃ｺ縺呎兜遞ｿ</h2>
            <div className="action-list">
              {result.analysis.nextPosts.map((item) => (
                <article key={item.rank}>
                  <b>#{item.rank}</b>
                  <div>
                    <strong>{item.concept}</strong>
                    <p><b>HOOK</b>縲{item.hook}</p>
                    <p>{item.reason}</p>
                    <small>{item.channel} ﾂｷ {item.format} ﾂｷ 讀懆ｨｼ: {item.testMetric}</small>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <Section title="髮・ｮ｢隱ｲ鬘・><List items={result.analysis.acquisitionProblems} /></Section>
          <Section title="髮・ｮ｢讖滉ｼ・><List items={result.analysis.opportunities} /></Section>
          <Section title="縺吶＄繧・ｋ縺薙→"><List items={result.analysis.nextActions} /></Section>

          {result.analysis.socialSignals?.length > 0 && (
            <Section title="SNS螳溘ョ繝ｼ繧ｿ">
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
                        TikTok ﾂｷ 蜀咲函 {item.views ?? "-"} ﾂｷ 縺・＞縺ｭ {item.likes ?? "-"} ﾂｷ 繧ｳ繝｡繝ｳ繝・{item.comments ?? "-"} ﾂｷ 繧ｷ繧ｧ繧｢ {item.shares ?? "-"}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {result.analysis.shopSignals?.length > 0 && (
            <Section title="TikTok Shop遶ｶ蜷・>
              <div className="action-list">
                {result.analysis.shopSignals.map((item, index) => (
                  <article key={index}>
                    <b>{index + 1}</b>
                    <div>
                      <a href={item.url || "#"} target="_blank" rel="noreferrer">
                        <strong>{item.title}</strong>
                      </a>
                      <p>{item.seller || "雋ｩ螢ｲ閠・ｸ肴・"}</p>
                      <small>
                        萓｡譬ｼ {item.price ?? "-"} {item.currency} ﾂｷ 雋ｩ螢ｲ謨ｰ {item.sales ?? "-"} ﾂｷ 隧穂ｾ｡ {item.rating ?? "-"} ﾂｷ 繝ｬ繝薙Η繝ｼ {item.reviewCount ?? "-"}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </Section>
          )}

          {result.analysis.searchEvidence?.length > 0 && (
            <Section title="讀懃ｴ｢繧ｨ繝薙ョ繝ｳ繧ｹ">
              <List items={result.analysis.searchEvidence.map((item) => item.title + " 窶・" + item.url + " 窶・" + item.snippet)} />
            </Section>
          )}

          <section className="next">
            <p className="eyebrow">VIDEO ENGINE</p>
            <h2>Gemini TTS 繝翫Ξ繝ｼ繧ｷ繝ｧ繝ｳ</h2>
            <p className="hint">
              髮・ｮ｢蛻､譁ｭ縺九ｉ繝翫Ξ繝ｼ繧ｷ繝ｧ繝ｳ譛ｬ譁・ｒ菴懊ｊ縲；emini TTS縺ｧWAV髻ｳ螢ｰ繧堤函謌舌＠縺ｾ縺吶・
            </p>
            <textarea
              value={narrationText}
              onChange={(e) => setNarrationText(e.target.value)}
              rows={5}
              style={{ width: "100%", marginBottom: 12 }}
              placeholder="繝翫Ξ繝ｼ繧ｷ繝ｧ繝ｳ譛ｬ譁・
            />
            <button
              type="button"
              disabled={narrationLoading || !narrationText.trim()}
              onClick={generateNarration}
            >
              {narrationLoading ? "髻ｳ螢ｰ逕滓・荳ｭ..." : "繝翫Ξ繝ｼ繧ｷ繝ｧ繝ｳ繧堤函謌・}
            </button>

            {narrationAudio && (
              <div style={{ marginTop: 16 }}>
                <audio controls src={narrationAudio} style={{ width: "100%" }} />
                <a href={narrationAudio} download="narration.wav" style={{ display: "inline-block", marginTop: 8 }}>
                  WAV繧剃ｿ晏ｭ・
                </a>
              </div>
            )}
          </section>

          <p className="ai-note">
            {result.analysis.aiConnected ? "AI蛻・梵: 謗･邯壽ｸ医∩" : "AI蛻・梵: 譛ｪ謗･邯夲ｼ医・繝ｼ繧ｸ謚ｽ蜃ｺ繝吶・繧ｹ・・}
          </p>
        </div>
      )}
    </main>
  );
}

