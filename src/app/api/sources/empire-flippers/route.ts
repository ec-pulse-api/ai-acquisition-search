import { NextRequest, NextResponse } from "next/server";
import { fetchEmpireFlippersListings } from "@/lib/acquisition/empire-flippers";

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const data = await fetchEmpireFlippersListings({
      page: Number(params.get("page") ?? "1"),
      limit: Number(params.get("limit") ?? "20"),
      query: params.get("q") ?? undefined,
    });

    return NextResponse.json({
      data,
      meta: {
        source: "Empire Flippers",
        live: true,
        fetchedAt: new Date().toISOString(),
        count: data.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Source request failed";
    return NextResponse.json({ error: message, source: "Empire Flippers" }, { status: 502 });
  }
}
