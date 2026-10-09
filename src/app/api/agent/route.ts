import { runAgent } from "@/lib/server/agent";
import { computeAggregates, findClip, loadRealData } from "@/lib/server/realData";


// POST /api/agent  body (optional): { clipId?: string }  -> scope to one clip, default = all clips
// GET  /api/agent  -> same, all clips.
// Response: { source: "wandb"|"rules", model?, alerts: [{id,severity,insight,alert,action,metricPct}],
//             aggregates, data: { file, isSample, generatedAt, clips }, fallbackReason? }
async function handle(clipId?: string) {
  try {
    const { data, file, isSample } = await loadRealData();
    const clip = clipId ? findClip(data, clipId) : undefined;
    if (clipId && !clip) return Response.json({ error: `Unknown clip '${clipId}'`, clips: data.clips.map((c) => c.clipId) }, { status: 404 });
    const dets = clip ? data.detections.filter((d) => d.clipId === clip.clipId) : data.detections;
    const aggregates = computeAggregates(dets);
    const result = await runAgent(aggregates, { clips: clip ? 1 : data.clips.length, isSample });
    return Response.json({
      ...result,
      aggregates,
      data: { file, isSample, generatedAt: data.pipeline?.generatedAt ?? null, clips: clip ? [clip.clipId] : data.clips.map((c) => c.clipId), labeler: data.pipeline?.labeler ?? null },
    });
  } catch (e) {
    return Response.json({ error: e instanceof Error ? e.message : "agent failed" }, { status: 503 });
  }
}

export async function POST(req: Request) {
  let clipId: string | undefined;
  try {
    const body = (await req.json()) as { clipId?: unknown };
    if (typeof body?.clipId === "string") clipId = body.clipId;
  } catch {
    /* empty body is fine */
  }
  return handle(clipId);
}

export async function GET() {
  return handle();
}
