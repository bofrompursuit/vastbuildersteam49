// Server-only: merchandising-agent logic. Rule-based alerts + optional W&B Inference LLM alerts,
// both grounded in aggregates computed from the real detections file.
import type { ComputedAggregates } from "./realData";

export interface AgentAlertOut {
  id: string;
  severity: "info" | "action" | "critical";
  insight: string; // what the data shows (same text as `alert`)
  alert: string;
  action: string;
  metricPct: number | null; // the % quoted in the alert, when there is one
}

export interface AgentResult {
  source: "wandb" | "rules";
  model?: string;
  alerts: AgentAlertOut[];
  fallbackReason?: string;
}

const top = (m: Record<string, number>, skip: string[] = []): [string, number] | undefined =>
  Object.entries(m).filter(([k]) => !skip.includes(k.toLowerCase())).sort((a, b) => b[1] - a[1])[0];

export function rulesAlerts(a: ComputedAggregates): AgentAlertOut[] {
  if (a.sightings === 0) {
    return [{ id: "nodata", severity: "info", insight: "No detections in the data file yet.", alert: "No detections in the data file yet.", action: "Run the lab pipeline to generate public/data/detections.json.", metricPct: null }];
  }
  const small = a.sightings < 10 ? ` (small sample: ${a.sightings} sightings)` : "";
  const out: AgentAlertOut[] = [];

  const heavy = a.heavyOuterwearPct;
  const heavyText = `${heavy}% of person-sightings are wearing heavy outerwear (coat, puffer or parka)${small}.`;
  out.push({
    id: "signage",
    severity: heavy >= 25 ? "action" : "info",
    insight: heavyText,
    alert: heavyText,
    action: heavy >= 25 ? "Feature the Winter Outerwear Collection on the entrance display and front table." : "Keep heavy outerwear as a secondary placement; lead with lighter layers.",
    metricPct: heavy,
  });

  const style = top(a.aesthetics, ["unknown"]);
  if (style) {
    const t = `${style[0]} is the most common aesthetic (${style[1]}% of person-sightings)${small}.`;
    out.push({ id: "merch", severity: "info", insight: t, alert: t, action: `Re-merchandise the front table with ${style[0]} best-sellers.`, metricPct: style[1] });
  }

  const carry = top(a.carryPct, ["none"]);
  const color = top(a.topColors, ["unknown"]);
  if (carry && carry[1] >= 20) {
    const t = `${carry[1]}% of person-sightings carry a ${carry[0]}${small}.`;
    out.push({ id: "carry", severity: "info", insight: t, alert: t, action: `Cross-merchandise ${carry[0]}s and carry accessories near the entrance.`, metricPct: carry[1] });
  } else if (color) {
    const t = `${color[0]} is the most common primary colour (${color[1]}% of person-sightings)${small}.`;
    out.push({ id: "color", severity: "info", insight: t, alert: t, action: `Lead window and table displays with ${color[0].toLowerCase()} tones.`, metricPct: color[1] });
  }
  return out;
}

const BANNED = /\b(age|aged|ages|ageing|gender\w*|male|female|men|women|man|woman|boy|girl|boys|girls|body|bodies|bmi|weight|overweight|slim|plus-size|elderly|young|younger|old|older|teen\w*|kid\w*|child\w*|senior\w*)\b/i;

/** All numbers the model is allowed to quote (percentages and counts from the aggregates). */
function allowedNumbers(a: ComputedAggregates): number[] {
  return [a.heavyOuterwearPct, a.sightings, a.tracks, ...Object.values(a.carryPct), ...Object.values(a.topColors), ...Object.values(a.aesthetics), ...Object.values(a.topColorsCount), ...Object.values(a.aestheticsCount)];
}

function grounded(text: string, a: ComputedAggregates): boolean {
  const allowed = allowedNumbers(a);
  const nums = text.match(/\d+(?:\.\d+)?/g) ?? [];
  return nums.every((s) => allowed.some((v) => Math.abs(v - Number(s)) < 0.5));
}

function parseAlerts(content: string, a: ComputedAggregates): AgentAlertOut[] {
  let s = content.trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  const i = s.indexOf("{"), j = s.lastIndexOf("}");
  if (i < 0 || j <= i) throw new Error("no JSON object in model output");
  s = s.slice(i, j + 1);
  const parsed = JSON.parse(s) as { alerts?: unknown };
  if (!Array.isArray(parsed.alerts)) throw new Error("model output missing alerts array");
  const out: AgentAlertOut[] = [];
  for (const item of parsed.alerts) {
    if (!item || typeof item !== "object") continue;
    const r = item as Record<string, unknown>;
    const alert = typeof r.alert === "string" ? r.alert.trim().slice(0, 400) : "";
    const action = typeof r.action === "string" ? r.action.trim().slice(0, 400) : "";
    if (!alert || !action) continue;
    if (BANNED.test(alert) || BANNED.test(action)) continue; // never mention age / gender / body
    if (!grounded(alert, a) || !grounded(action, a)) continue; // numbers must come from the aggregates
    const m = alert.match(/(\d+(?:\.\d+)?)\s*%/);
    out.push({ id: `agent-${out.length + 1}`, severity: out.length === 0 ? "action" : "info", insight: alert, alert, action, metricPct: m ? Number(m[1]) : null });
    if (out.length === 3) break;
  }
  if (!out.length) throw new Error("no usable alerts after safety/grounding checks");
  return out;
}

export async function wandbAlerts(a: ComputedAggregates, ctx: { clips: number; isSample: boolean }): Promise<{ alerts: AgentAlertOut[]; model: string }> {
  const key = process.env.WANDB_API_KEY;
  if (!key) throw new Error("WANDB_API_KEY not set");
  const model = process.env.WANDB_AGENT_MODEL || "openai/gpt-oss-120b";
  const headers: Record<string, string> = { "Content-Type": "application/json", Authorization: `Bearer ${key}` };
  if (process.env.WANDB_PROJECT_PATH) headers["OpenAI-Project"] = process.env.WANDB_PROJECT_PATH;

  const facts = {
    sightings: a.sightings,
    uniqueTracks: a.tracks,
    clips: ctx.clips,
    heavyOuterwearPctOfSightings: a.heavyOuterwearPct,
    carryPctOfSightings: a.carryPct,
    topPrimaryColoursPctOfSightings: Object.fromEntries(Object.entries(a.topColors).slice(0, 8)),
    aestheticsPctOfSightings: a.aesthetics,
  };
  const system =
    "You are a retail merchandising analyst. You receive aggregate counts from an outfit-detection pipeline run on street-camera footage. " +
    "Write 2 to 3 short merchandising alerts, each with a concrete store action. Use ONLY the numbers and categories in the provided JSON; do not invent any figure, product, or fact. " +
    "NEVER mention or infer age, gender, body type, or any demographic. " +
    'Respond with ONLY a JSON object of the form {"alerts":[{"alert":"...","action":"..."}]} and nothing else.';
  const user = `Aggregates (percentages are of person-sightings, not unique shoppers):\n${JSON.stringify(facts)}${ctx.isSample ? "\nNote: this is a tiny sample file." : ""}`;

  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 20_000);
  try {
    const res = await fetch("https://api.inference.wandb.ai/v1/chat/completions", {
      method: "POST",
      headers,
      signal: ctrl.signal,
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 1500,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
      }),
    });
    if (!res.ok) throw new Error(`W&B Inference HTTP ${res.status}`);
    const json = (await res.json()) as { choices?: { message?: { content?: string | null } }[] };
    const content = json.choices?.[0]?.message?.content;
    if (!content) throw new Error("empty model response");
    return { alerts: parseAlerts(content, a), model };
  } catch (e) {
    if (e instanceof Error && e.name === "AbortError") throw new Error("W&B Inference timed out after 20s");
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export async function runAgent(a: ComputedAggregates, ctx: { clips: number; isSample: boolean }): Promise<AgentResult> {
  if (!process.env.WANDB_API_KEY) return { source: "rules", alerts: rulesAlerts(a), fallbackReason: "WANDB_API_KEY not set" };
  try {
    const r = await wandbAlerts(a, ctx);
    return { source: "wandb", model: r.model, alerts: r.alerts };
  } catch (e) {
    return { source: "rules", alerts: rulesAlerts(a), fallbackReason: e instanceof Error ? e.message : "W&B call failed" };
  }
}
