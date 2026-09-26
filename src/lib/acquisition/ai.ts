import type { AcquisitionTarget } from "./types";

export type AIAnalysis = {
  thesis: string;
  acquisitionFit: string;
  strengths: string[];
  risks: string[];
  aiOpportunities: string[];
  diligenceQuestions: string[];
};

export async function analyzeAcquisitionTarget(target: AcquisitionTarget): Promise<AIAnalysis> {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    return {
      thesis: "AI analysis is not connected yet. The target has been normalized and is ready for LLM analysis.",
      acquisitionFit: "Pending AI analysis",
      strengths: target.signals,
      risks: target.risks,
      aiOpportunities: ["Connect OPENAI_API_KEY to generate target-specific AI opportunities."],
      diligenceQuestions: defaultDiligenceQuestions,
    };
  }

  const model = process.env.OPENAI_MODEL || "gpt-5-mini";
  const prompt = `Analyze this acquisition target as an M&A research analyst. Do not invent facts. Separate known facts from hypotheses and flag missing data.

Target:
${JSON.stringify(target, null, 2)}

Return JSON only with:
{
  "thesis": "concise acquisition thesis",
  "acquisitionFit": "why this could or could not fit an acquisition strategy",
  "strengths": ["..."],
  "risks": ["..."],
  "aiOpportunities": ["..."],
  "diligenceQuestions": ["..."]
}`;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      response_format: { type: "json_object" },
      messages: [
        { role: "system", content: "You are a conservative acquisition research analyst." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!response.ok) {
    throw new Error(`OpenAI API returned ${response.status}`);
  }

  const payload = await response.json();
  const content = payload.choices?.[0]?.message?.content;
  if (!content) throw new Error("OpenAI returned no analysis");

  return JSON.parse(content) as AIAnalysis;
}

const defaultDiligenceQuestions = [
  "Can reported revenue and profit be verified from source financial statements?",
  "What are the latest 12-month revenue, profit, and growth trends?",
  "How concentrated are customers, traffic sources, suppliers, or platforms?",
  "How dependent is the business on the current owner?",
  "Which assets, IP, contracts, data, and liabilities transfer with the acquisition?",
];
