import { semanticSearch } from "@/lib/engine";

export async function POST(req: Request) {
  const { query } = (await req.json()) as { query?: string };
  if (!query?.trim()) return Response.json({ error: "query required" }, { status: 400 });
  await new Promise((r) => setTimeout(r, 600)); // simulated vector-index latency
  return Response.json({ query, results: semanticSearch(query) });
}
