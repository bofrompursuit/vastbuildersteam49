// Truth layer: maps REAL detections (public/data/detections.json, see realTypes.ts) into the shapes the UI uses.
// Nothing here generates data. No random numbers, no invented demographics.
import type { RealClip, RealDataFile, RealDetection } from "./realTypes";
import { recommendFor } from "./realCatalog";
import { NOT_INFERRED } from "./types";
import type { AgentAlert, DetectionPayload, SearchResult } from "./types";

const none = (s: string | undefined) => !s || s.trim().toLowerCase() === "none";

export function toPayload(d: RealDetection, clip?: RealClip): DetectionPayload {
  const o = d.outfit;
  const hasOuter = !none(o.outer);
  return {
    trackingId: d.trackingId,
    timestamp: `${d.clipId} @ ${d.tSec}s`,
    clipId: d.clipId,
    tSec: d.tSec,
    camera: clip?.camera,
    model: d.model,
    traceUrl: d.traceUrl,
    confidence: d.confidence,
    bbox: d.bbox,
    demographics: { ageBracket: NOT_INFERRED, genderPresentation: NOT_INFERRED, heightCm: NOT_INFERRED, fitSize: NOT_INFERRED },
    outfit: {
      primaryGarment: hasOuter ? o.outer : o.top,
      garmentCategory: hasOuter ? "Outerwear" : "Top",
      top: o.top,
      bottom: o.bottom,
      outer: o.outer,
      carry: o.carry,
      primaryColor: o.primaryColor,
      secondaryColor: o.secondaryColor,
      primaryHex: o.primaryHex,
      secondaryHex: o.secondaryHex,
      aesthetic: o.aesthetic,
      heavyOuterwear: o.heavyOuterwear,
    },
    recommendation: recommendFor(o.aesthetic, o.heavyOuterwear),
  };
}

const pct = (n: number, d: number) => Math.round((n / Math.max(d, 1)) * 100);

/** Rule-based summary over a window of REAL replayed detections (no LLM, no demographics). */
export function agentAlerts(window: DetectionPayload[]): AgentAlert[] {
  const n = window.length;
  if (n === 0) {
    return [{ id: "wait", severity: "info", metricPct: 0, insight: "Waiting for the replay to reach the first labelled sighting.", action: "No action yet." }];
  }
  const heavy = pct(window.filter((d) => d.outfit.heavyOuterwear).length, n);
  const counts = new Map<string, number>();
  window.forEach((d) => counts.set(d.outfit.aesthetic, (counts.get(d.outfit.aesthetic) ?? 0) + 1));
  const [topStyle, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
  const bags = pct(window.filter((d) => d.outfit.carry.some((c) => /bag|backpack|tote|purse|satchel/i.test(c))).length, n);
  return [
    {
      id: "signage",
      severity: "action",
      metricPct: heavy,
      campaign: heavy >= 40 ? "Winter Outerwear Collection" : `${topStyle} Edit`,
      insight: `${heavy}% of the last ${n} replayed person-sightings show heavy outerwear.`,
      action: heavy >= 40 ? "Suggest: feature the Winter Outerwear Collection on the entrance display (demo)." : `Suggest: feature the ${topStyle} edit on the entrance display (demo).`,
    },
    {
      id: "merch",
      severity: "info",
      metricPct: pct(topCount, n),
      insight: `${topStyle} is the most common aesthetic (${pct(topCount, n)}% of the last ${n} sightings).`,
      action: `Suggest: re-merchandise the front table with ${topStyle} best-sellers.`,
    },
    {
      id: "carry",
      severity: "info",
      metricPct: bags,
      insight: `${bags}% of the last ${n} sightings carry a bag, backpack or tote.`,
      action: "Suggest: place bag and carry accessories near checkout.",
    },
  ];
}

// ---- text search over the labelled detections (term overlap, not embeddings) ----

const STOP = new Set(["show", "shoppers", "shopper", "people", "person", "wearing", "wear", "wears", "with", "the", "and", "between", "who", "that", "all", "any", "from", "find", "for", "clips", "clip", "under", "over", "aged", "age", "men", "women", "man", "woman"]);

function hueOf(hex: string): number {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return 210;
  const r = ((n >> 16) & 255) / 255, g = ((n >> 8) & 255) / 255, b = (n & 255) / 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  if (d === 0) return 210;
  const h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}

export const fmtClock = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

export function searchDetections(data: RealDataFile, query: string, limit = 3): SearchResult[] {
  const stem = (w: string) => w.replace(/(es|s)$/, "");
  const terms = [...new Set(query.toLowerCase().split(/[^a-z]+/).filter((w) => w.length >= 3 && w !== "pm" && !STOP.has(w)).map(stem))];
  if (terms.length === 0) return [];
  const clips = new Map(data.clips.map((c) => [c.clipId, c]));
  return data.detections
    .map((d) => {
      const o = d.outfit;
      const hay = [o.top, o.bottom, o.outer, ...o.carry, o.primaryColor, o.secondaryColor, o.aesthetic].join(" ").toLowerCase();
      const words = hay.split(/[^a-z]+/).map(stem);
      const hit = terms.filter((t) => words.includes(t)).length;
      return { d, score: hit / terms.length };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.d.confidence - a.d.confidence)
    .slice(0, limit)
    .map(({ d, score }) => {
      const clip = clips.get(d.clipId);
      const o = d.outfit;
      const parts = [o.outer && !none(o.outer) ? o.outer : null, o.top, o.bottom].filter(Boolean).join(" + ");
      return {
        clipId: d.clipId,
        camera: clip ? `${clip.camera} (${clip.location.replace(/_/g, " ")})` : d.clipId,
        timeRange: `at ${fmtClock(d.tSec)} in clip`,
        matchConfidence: Math.round(score * 100),
        description: `${d.trackingId}: ${parts}`,
        thumbHue: hueOf(o.primaryHex),
      };
    });
}

// ---- server-side helpers kept for the API routes (export / search) ----
// They read the same real file from disk (detections.json, else detections.sample.json). No random data.

let serverCache: RealDataFile | null | undefined;
let genIdx = 0;

interface NodeBuiltins {
  fs: { existsSync(p: string): boolean; readFileSync(p: string, enc: string): string };
  path: { join(...p: string[]): string };
}

export function readRealDataSync(): RealDataFile | null {
  if (serverCache !== undefined) return serverCache;
  serverCache = null;
  try {
    const get = (process as unknown as { getBuiltinModule?: (m: string) => unknown }).getBuiltinModule;
    if (!get) return null;
    const b: NodeBuiltins = { fs: get("fs") as NodeBuiltins["fs"], path: get("path") as NodeBuiltins["path"] };
    for (const f of ["detections.json", "detections.sample.json"]) {
      const p = b.path.join(process.cwd(), "public", "data", f);
      if (b.fs.existsSync(p)) {
        serverCache = JSON.parse(b.fs.readFileSync(p, "utf8")) as RealDataFile;
        break;
      }
    }
  } catch {
    serverCache = null;
  }
  return serverCache;
}

/** Returns the next REAL detection (cycles through the file in order). Works as an Array.from callback. */
export function generateDetection(_v?: unknown, i?: number): DetectionPayload {
  const data = readRealDataSync();
  if (!data || data.detections.length === 0) throw new Error("No real detections found in public/data");
  const idx = typeof i === "number" ? i : genIdx++;
  const d = data.detections[idx % data.detections.length];
  return toPayload(d, data.clips.find((c) => c.clipId === d.clipId));
}

/** Text search over the real labelled detections. */
export function semanticSearch(query: string): SearchResult[] {
  const data = readRealDataSync();
  return data ? searchDetections(data, query) : [];
}
