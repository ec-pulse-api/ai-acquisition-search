import { NextRequest, NextResponse } from "next/server";
import { searchTargets } from "@/lib/acquisition/data";

export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const minScore = params.get("minScore");

  const targets = searchTargets({
    query: params.get("q") ?? undefined,
    category: params.get("category") ?? undefined,
    model: params.get("model") ?? undefined,
    minScore: minScore ? Number(minScore) : undefined,
  });

  return NextResponse.json({
    data: targets,
    meta: {
      count: targets.length,
      source: "sample",
      note: "Sample acquisition universe. Connect external data sources before using for live deal research.",
    },
  });
}
