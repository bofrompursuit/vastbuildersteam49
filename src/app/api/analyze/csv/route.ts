import type { VideoSource } from "@/lib/analysis";
import { tracksToCsv, type RealExtractedTrack } from "@/lib/server/analyze";


// POST /api/analyze/csv { tracks, source } — format tracks from /api/analyze as a CSV dataset.
// Demographic columns (age, gender, height, fit size) are always "not inferred".
export async function POST(req: Request) {
  let body: { tracks?: RealExtractedTrack[]; source?: VideoSource };
  try {
    body = await req.json();
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const { tracks, source } = body;
  if (!tracks?.length || !source) return Response.json({ error: "tracks and source required" }, { status: 400 });
  return new Response(tracksToCsv(tracks, source), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aurafit-video-features-${Date.now()}.csv"`,
    },
  });
}
