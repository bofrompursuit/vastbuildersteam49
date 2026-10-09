import { toCsv, type ExtractedTrack, type VideoSource } from "@/lib/analysis";

// POST /api/analyze/csv — format extracted tracks as a downloadable CSV dataset.
export async function POST(req: Request) {
  const { tracks, source } = (await req.json()) as { tracks?: ExtractedTrack[]; source?: VideoSource };
  if (!tracks?.length || !source) return Response.json({ error: "tracks and source required" }, { status: 400 });
  return new Response(toCsv(tracks, source), {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="aurafit-video-features-${Date.now()}.csv"`,
    },
  });
}
