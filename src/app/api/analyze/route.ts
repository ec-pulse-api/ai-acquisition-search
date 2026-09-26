import { NextRequest, NextResponse } from "next/server";
import { analyzeAcquisitionTarget } from "@/lib/acquisition/ai";
import type { AcquisitionTarget } from "@/lib/acquisition/types";

export async function POST(request: NextRequest) {
  try {
    const target = (await request.json()) as AcquisitionTarget;
    if (!target?.id || !target?.name) {
      return NextResponse.json({ error: "A valid acquisition target is required." }, { status: 400 });
    }

    const analysis = await analyzeAcquisitionTarget(target);
    return NextResponse.json({
      data: analysis,
      meta: {
        aiConnected: Boolean(process.env.OPENAI_API_KEY),
        model: process.env.OPENAI_API_KEY ? process.env.OPENAI_MODEL || "gpt-5-mini" : null,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
