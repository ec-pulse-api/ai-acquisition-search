import { POST as aiDecisionPost } from "@/app/api/operator/ai-decision/route";

export const runtime = "nodejs";

// Legacy endpoint kept for existing clients. The decision engine is unified with /api/operator/ai-decision.
export async function POST(request: Request) {
  return aiDecisionPost(request);
}
