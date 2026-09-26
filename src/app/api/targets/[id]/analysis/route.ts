import { NextResponse } from "next/server";
import { acquisitionTargets } from "@/lib/acquisition/data";
import { buildAcquisitionAnalysis } from "@/lib/acquisition/analysis";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const target = acquisitionTargets.find((item) => item.id === id);

  if (!target) {
    return NextResponse.json({ error: "Target not found" }, { status: 404 });
  }

  return NextResponse.json({
    data: buildAcquisitionAnalysis(target),
    meta: { generatedBy: "rule-based acquisition screening", aiProvider: "not-connected" },
  });
}
