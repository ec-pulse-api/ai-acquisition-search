import { NextRequest, NextResponse } from "next/server";
import { normalizeImportedTarget } from "@/lib/acquisition/source";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const targets = Array.isArray(body) ? body : body.targets;

    if (!Array.isArray(targets)) {
      return NextResponse.json({ error: "Expected { targets: [...] }" }, { status: 400 });
    }

    const normalized = targets.map(normalizeImportedTarget);
    return NextResponse.json({
      data: normalized,
      meta: {
        count: normalized.length,
        status: "validated",
        persistence: "not_configured",
        note: "Import validation is ready. Persistence and live source connectors are the next integration.",
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid import payload";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
