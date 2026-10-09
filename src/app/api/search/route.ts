import { loadRealData } from "@/lib/server/realData";
import { MATCH_TYPE, fmtTime, hueOf, parseQuery, searchData } from "@/lib/server/search";


// POST /api/search  { query: string }
// Real search over precomputed outfit labels (top, bottom, outer, carry, colours, aesthetic).
// Response keeps the UI shape { query, results: SearchResult[] } (one result per matching CLIP, unique clipId)
// and adds receipts: vssOriginalVideo, filename, tSec, per-track hits, matchType, notes.
export async function POST(req: Request) {
  let query: string | undefined;
  try {
    query = ((await req.json()) as { query?: string })?.query;
  } catch {
    return Response.json({ error: "JSON body { query } required" }, { status: 400 });
  }
  if (typeof query !== "string" || !query.trim()) return Response.json({ error: "query required" }, { status: 400 });

  let loaded;
  try {
    loaded = await loadRealData();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "data unavailable" }, { status: 503 });
  }
  const { data, file, isSample } = loaded;
  const pq = parseQuery(query);
  const notes: string[] = [];
  if (pq.unsupported.length) notes.push(`Ignored demographic terms (${pq.unsupported.join(", ")}): age, gender and body type are not inferred, by design.`);
  if (pq.hadNumbersOrTimes) notes.push("Ignored numbers/time-of-day: clips are matched on outfit labels only, not on time of day.");
  if (!pq.tokens.length) notes.push("No searchable outfit terms in the query. Try garments, colours, carried items or an aesthetic, e.g. 'black puffer jacket' or 'backpack'.");
  if (isSample) notes.push("Searching the tiny sample file (detections.sample.json), not the full lab output.");

  const hits = pq.tokens.length ? searchData(data, pq.tokens).slice(0, 12) : [];
  const results = hits.map(({ clip, best, tracks }) => {
    const o = best.outfit;
    const carry = o.carry?.length ? `, carrying ${o.carry.join(", ")}` : "";
    const outer = o.outer && o.outer.toLowerCase() !== "none" ? ` + ${o.outer}` : "";
    return {
      // UI contract (SearchResult)
      clipId: clip.clipId,
      camera: clip.camera,
      timeRange: `${fmtTime(best.tSec)} of ${fmtTime(clip.durationSec)} · ${clip.filename}`,
      matchConfidence: +(best.score * 100).toFixed(1), // % of query terms matched (not a vision-model confidence)
      description: `${o.top} / ${o.bottom}${outer}${carry}${tracks.length > 1 ? ` · ${tracks.length} matching tracks` : ""}`,
      thumbHue: hueOf(o.primaryHex),
      // receipts + extras
      score: best.score,
      matchType: MATCH_TYPE,
      matchedTerms: best.matchedTerms,
      matchedFields: best.matchedFields,
      location: clip.location,
      vssOriginalVideo: clip.vssOriginalVideo,
      filename: clip.filename,
      tSec: best.tSec,
      trackingId: best.trackingId,
      traceUrl: best.traceUrl ?? null,
      tracks: tracks.slice(0, 10).map((t) => ({
        trackingId: t.trackingId,
        tSec: t.tSec,
        score: t.score,
        confidence: t.confidence,
        matchedTerms: t.matchedTerms,
        matchedFields: t.matchedFields,
        outfit: t.outfit,
        bbox: t.bbox,
        traceUrl: t.traceUrl ?? null,
      })),
    };
  });

  return Response.json({
    query,
    matchType: MATCH_TYPE,
    terms: pq.tokens,
    notes,
    dataSource: { file, isSample, generatedAt: data.pipeline?.generatedAt ?? null, labeler: data.pipeline?.labeler ?? null },
    results,
  });
}
