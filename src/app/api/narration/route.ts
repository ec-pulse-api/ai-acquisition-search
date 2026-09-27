import { NextRequest, NextResponse } from "next/server";
import { generateNarration } from "@/lib/video/gemini-tts";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const text = typeof body?.text === "string" ? body.text : "";
    const voice = typeof body?.voice === "string" ? body.voice : undefined;
    const style = typeof body?.style === "string" ? body.style : undefined;

    const result = await generateNarration({ text, voice, style });

    return NextResponse.json({
      data: {
        model: result.model,
        voice: result.voice,
        mimeType: result.mimeType,
        audioBase64: result.audioBase64,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "ナレーション生成に失敗しました。";

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
