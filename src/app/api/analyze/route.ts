import type { VideoSource } from "@/lib/analysis";
import { buildLabOnlyResult, buildRealResult } from "@/lib/server/analyze";
import { findClip, loadRealData } from "@/lib/server/realData";


// POST /api/analyze  { kind: 'upload'|'url', name, clipId?, sizeBytes?, durationSec?, sampledPalette? }
// - If `name` (filename or URL basename) or `clipId` names one of our precomputed clips: returns the REAL
//   per-track features (AnalysisResult shape, mode: "precomputed-real").
// - Otherwise 200 with an empty AnalysisResult-shaped body, mode: "lab-pipeline-only", a `message`, and
//   `realDataAvailableFor` (list of clips we do have real data for). Nothing is simulated.
export async function POST(req: Request) {
  let source: (VideoSource & { clipId?: string }) | undefined;
  try {
    source = (await req.json()) as VideoSource & { clipId?: string };
  } catch {
    return Response.json({ error: "JSON body required" }, { status: 400 });
  }
  const byClipId = typeof source?.clipId === "string" && source.clipId.trim() !== "";
  if (!byClipId && (!source?.name || (source.kind !== "upload" && source.kind !== "url"))) {
    return Response.json({ error: "Expected { kind: 'upload' | 'url', name } or { clipId }" }, { status: 400 });
  }
  if (!byClipId && source!.kind === "url" && !/^https?:\/\//i.test(source!.name)) {
    return Response.json({ error: "Video URL must start with http(s)://" }, { status: 400 });
  }

  let loaded;
  try {
    loaded = await loadRealData();
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "data unavailable" }, { status: 503 });
  }
  const { data, file, isSample } = loaded;
  const src: VideoSource = { kind: source!.kind ?? "upload", name: source!.name ?? source!.clipId!, sizeBytes: source!.sizeBytes, durationSec: source!.durationSec, sampledPalette: source!.sampledPalette };

  const clip = findClip(data, source!.clipId, source!.name);
  if (clip) return Response.json(buildRealResult(data, clip, src, file, isSample));
  return Response.json(buildLabOnlyResult(data, src));
}
