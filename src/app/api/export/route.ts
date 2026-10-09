import { csvEscape, loadRealData, NOT_INFERRED } from "@/lib/server/realData";


// GET /api/export — CSV of the REAL detections (public/data/detections.json, or the sample file).
// Demographic columns are present for schema compatibility and always "not inferred".
export async function GET() {
  let loaded;
  try {
    loaded = await loadRealData();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "data unavailable" }, { status: 503 });
  }
  const { data, file } = loaded;
  const clips = new Map(data.clips.map((c) => [c.clipId, c]));
  const header = [
    "tracking_id", "clip_id", "filename", "vss_original_video", "camera", "location", "t_sec", "confidence",
    "top", "bottom", "outer", "carry", "primary_color", "primary_hex", "secondary_color", "secondary_hex",
    "aesthetic", "heavy_outerwear", "age_bracket", "gender_presentation", "height_cm", "fit_size",
    "model", "trace_url", "data_file",
  ];
  const rows = data.detections.map((d) => {
    const c = clips.get(d.clipId);
    const o = d.outfit;
    return [
      d.trackingId, d.clipId, c?.filename, c?.vssOriginalVideo, c?.camera, c?.location, d.tSec, d.confidence,
      o.top, o.bottom, o.outer, (o.carry ?? []).join("; "), o.primaryColor, o.primaryHex, o.secondaryColor, o.secondaryHex,
      o.aesthetic, o.heavyOuterwear, NOT_INFERRED, NOT_INFERRED, NOT_INFERRED, NOT_INFERRED,
      d.model, d.traceUrl, file,
    ].map(csvEscape).join(",");
  });
  return new Response([header.join(","), ...rows].join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="aurafit-detections-${new Date().toISOString().slice(0, 10)}.csv"`,
      "X-Data-File": file,
    },
  });
}
