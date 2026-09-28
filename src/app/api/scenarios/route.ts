import { NextResponse } from "next/server";
import { buildVideoScenario } from "@/lib/acquisition/video-scenario";
import type { AcquisitionAnalysis } from "@/lib/acquisition/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const analysis = body?.analysis as AcquisitionAnalysis | undefined;
    const rank = Number(body?.rank ?? 1);

    if (!analysis?.nextPosts?.length) {
      return NextResponse.json({ error: "NEXT POSTSがありません。" }, { status: 400 });
    }

    const scenario = buildVideoScenario(analysis, rank);
    return NextResponse.json({ data: scenario });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "動画シナリオ生成に失敗しました。" },
      { status: 500 }
    );
  }
}
