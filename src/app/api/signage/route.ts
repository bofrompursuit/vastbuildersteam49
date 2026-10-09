export async function POST(req: Request) {
  const { campaign } = (await req.json()) as { campaign?: string };
  await new Promise((r) => setTimeout(r, 800));
  return Response.json({
    ok: true,
    display: "ENTRANCE-DISPLAY-01",
    campaign: campaign ?? "Winter Outerwear Collection",
    pushedAt: new Date().toISOString(),
  });
}
