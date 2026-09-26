export type AcquisitionDecision = { target: string; problem: string; desire: string; valueProposition: string; channel: string; format: string; testPlan: string; evidence: string[] };

export type AcquisitionAnalysis = {
  product: { summary: string; valueProposition: string[]; evidence: string[] };
  market: { summary: string; signals: string[] };
  customer: { summary: string; likelySegments: string[]; needs: string[] };
  competitors: { summary: string; signals: string[] };
  performance: { summary: string; availableEvidence: string[]; missingData: string[] };
  acquisitionProblems: string[];
  opportunities: string[];
  priorities: { priority: number; action: string; reason: string; channel: string }[];
  nextActions: string[];
  nextPosts: { rank: number; concept: string; hook: string; format: string; channel: string; reason: string; testMetric: string }[];
  searchEvidence: { query: string; category: "customer_pain" | "customer_desire" | "competitor" | "market" | "channel"; title: string; url: string; snippet: string }[];
  aiConnected: boolean;
};
export type PageSnapshot = { url: string; title: string; description: string; headings: string[]; text: string; links: string[]; productSignals: string[] };
export type AcquisitionAnalyzeResult = { source: PageSnapshot; analysis: AcquisitionAnalysis };
