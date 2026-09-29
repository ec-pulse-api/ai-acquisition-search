import { NextRequest, NextResponse } from "next/server";
import { generateNarration } from "@/lib/video/gemini-tts";
import { consumeMonthlyUsage, getUserFromBearer } from "@/lib/billing";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const user = await getUserFromBearer(request);
    if (!user) return NextResponse.json({ error: "ログインが必要です。" }, { status: 401 });
    const usage = await consumeMonthlyUsage(user.id, "narration_generation", 5);
    if (!usage.allowed) return NextResponse.json({ error: `今月の無料ナレーション生成回数（${usage.limit}回）を使い切りました。Proへアップグレードしてください。`, usage }, { status: 429 });
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
