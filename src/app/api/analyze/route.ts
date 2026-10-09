import { analyze, type VideoSource } from "@/lib/analysis";

// POST /api/analyze — ingest a video (metadata + optional sampled palette) and return
// per-track features, trend aggregates and B2B/B2C recommendations.
export async function POST(req: Request) {
  const source = (await req.json()) as VideoSource;
  if (!source?.name || (source.kind !== "upload" && source.kind !== "url")) {
    return Response.json({ error: "Expected { kind: 'upload' | 'url', name }" }, { status: 400 });
  }
  if (source.kind === "url" && !/^https?:\/\//i.test(source.name)) {
    return Response.json({ error: "Video URL must start with http(s)://" }, { status: 400 });
  }
  await new Promise((r) => setTimeout(r, 700)); // simulated inference latency
  return Response.json(analyze(source));
}
