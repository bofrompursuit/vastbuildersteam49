// POST /api/signage { campaign? } — "push to entrance display".
// There is no physical display attached to this demo, so this is an honest simulation of the push:
// same shape as before, plus simulated: true and a note. The decision to push comes from /api/agent.
export async function POST(req: Request) {
  let campaign: string | undefined;
  try {
    campaign = ((await req.json()) as { campaign?: string })?.campaign;
  } catch {
    /* empty body is fine */
  }
  return Response.json({
    ok: true,
    simulated: true,
    note: "Demo only: no physical display is connected. The campaign selection is logged, not delivered.",
    display: "ENTRANCE-DISPLAY-01",
    campaign: campaign ?? "Winter Outerwear Collection",
    pushedAt: new Date().toISOString(),
  });
}
