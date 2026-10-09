// POST /api/live  body: { image: "data:image/jpeg;base64,..." }
// Sends one camera frame to W&B Inference (OpenAI-compatible vision model) and returns clothing/carry
// descriptions only. The image is never logged, stored or returned. The key stays on the server.

const ENDPOINT = "https://api.inference.wandb.ai/v1/chat/completions";
const DEFAULT_MODEL = "google/gemma-4-26B-A4B-it";
const MAX_IMAGE_BYTES = 1_500_000;
const TIMEOUT_MS = 20_000;

const PROMPT =
  "Photo from a camera. Describe up to 6 clearly visible people, nearest first, one line each:\n" +
  "P1: top=<colour garment>; bottom=<colour garment>; outer=<colour coat or jacket, or none>; carry=<colour bag or object, or none>; <walking|standing|sitting>\n" +
  "Each value is a colour then a garment or object. If unsure, write unclear. Clothing and carried items only; never age, gender, race, face, hair or body. If nobody is visible, write: none. No other text.";

// Single-person variant, used for per-track crops from the on-device detector.
const PROMPT_SINGLE = PROMPT.replace(
  "Photo from a camera. Describe up to 6 clearly visible people, nearest first, one line each:",
  "Cropped photo of one person. Describe that person in one line:",
);

const PROTECTED = /\b(man|woman|boy|girl|male|female|lady|guy|old|young|elderly|child|kid|teen|blonde|bald|beard|skin)\b/i;
const MOTIONS = ["walking", "standing", "sitting"];
const POSITIONAL = ["top", "bottom", "outer", "carry", "motion"] as const;

interface Person {
  top: string;
  bottom: string;
  outer: string;
  carry: string[];
  motion: string;
}

function clean(v: string | undefined): string {
  const s = (v ?? "").trim().replace(/^[<["']+|[>\]"'.]+$/g, "").trim();
  return s || "unclear";
}

function parseLine(line: string): Person {
  const body = line.replace(/^P\d+:\s*/i, "");
  const f: Record<string, string> = {};
  body.split(";").forEach((raw, i) => {
    const part = raw.trim();
    if (!part) return;
    const kv = part.match(/^([a-z]+)\s*=\s*(.*)$/i);
    if (kv) {
      const k = kv[1].toLowerCase();
      f[k === "pose" || k === "activity" ? "motion" : k] = kv[2];
    } else if (MOTIONS.includes(part.toLowerCase().replace(/[^a-z]/g, ""))) {
      f.motion = part;
    } else if (i < POSITIONAL.length) {
      f[POSITIONAL[i]] = part;
    }
  });
  const motionRaw = clean(f.motion).toLowerCase();
  const motion = MOTIONS.find((m) => motionRaw.includes(m)) ?? "unclear";
  const carryRaw = clean(f.carry);
  const carry = /^(none|unclear)$/i.test(carryRaw)
    ? []
    : carryRaw.split(/,|\band\b/i).map((c) => c.trim()).filter((c) => c && !/^none$/i.test(c));
  return { top: clean(f.top), bottom: clean(f.bottom), outer: clean(f.outer), carry, motion };
}

export async function POST(req: Request) {
  const key = process.env.WANDB_API_KEY;
  if (!key) {
    return Response.json({ enabled: false, message: "Live mode needs WANDB_API_KEY on the server (Vercel env or .env.local)." });
  }

  let image: unknown;
  let single = false;
  try {
    const body = (await req.json()) as { image?: unknown; single?: unknown };
    image = body?.image;
    single = body?.single === true;
  } catch {
    return Response.json({ error: "Body must be JSON: { image: 'data:image/jpeg;base64,...' }" }, { status: 400 });
  }
  if (typeof image !== "string" || !/^data:image\/(jpeg|png|webp);base64,/i.test(image)) {
    return Response.json({ error: "image must be a base64 data URL (jpeg/png/webp)" }, { status: 400 });
  }
  if (image.length > MAX_IMAGE_BYTES) {
    return Response.json({ error: "image too large (max ~1.5 MB)" }, { status: 413 });
  }

  const model = process.env.WANDB_VISION_MODEL || DEFAULT_MODEL;
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  if (process.env.WANDB_PROJECT_PATH) headers["OpenAI-Project"] = process.env.WANDB_PROJECT_PATH;

  const t0 = Date.now();
  let text = "";
  try {
    const res = await fetch(ENDPOINT, {
      method: "POST",
      headers,
      signal: AbortSignal.timeout(TIMEOUT_MS),
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: single ? 250 : 700,
        messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: image } }, { type: "text", text: single ? PROMPT_SINGLE : PROMPT }] }],
      }),
    });
    if (!res.ok) {
      const detail = (await res.text().catch(() => "")).slice(0, 200);
      return Response.json({ error: `W&B Inference returned ${res.status}${detail ? `: ${detail}` : ""}` }, { status: 502 });
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    text = json.choices?.[0]?.message?.content ?? "";
  } catch (e) {
    const timedOut = e instanceof Error && (e.name === "TimeoutError" || e.name === "AbortError");
    return Response.json({ error: timedOut ? "W&B Inference timed out" : "W&B Inference request failed" }, { status: 504 });
  }
  const latencyMs = Date.now() - t0;

  const people: Person[] = [];
  const seen = new Set<string>();
  const dropped = { protected: 0, duplicate: 0 };
  for (const line of text.split(/\r?\n/).map((l) => l.trim())) {
    if (!/^P\d+:/i.test(line)) continue;
    if (PROTECTED.test(line)) {
      dropped.protected += 1;
      continue;
    }
    const norm = line.replace(/^P\d+:\s*/i, "").toLowerCase().replace(/\s+/g, " ");
    if (seen.has(norm)) {
      dropped.duplicate += 1;
      continue;
    }
    seen.add(norm);
    people.push(parseLine(line));
  }

  if (single) {
    const one = people.slice(0, 1);
    return Response.json({ enabled: true, model, latencyMs, people: one, person: one[0] ?? null, dropped });
  }
  return Response.json({ enabled: true, model, latencyMs, people, dropped });
}
