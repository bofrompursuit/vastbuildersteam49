// Server-only: token search over real outfit labels (W&B vision labels on YOLO person crops).
import type { RealClip, RealDataFile, RealDetection } from "@/lib/realTypes";

export const MATCH_TYPE = "outfit-tag search over W&B vision labels";

const STOP = new Set(
  ("a an the and or of to in on at for with without who whom whose that this these those is are was were be show find me us all any some " +
    "shopper shoppers people person persons customer customers visitor visitors pedestrian pedestrians wearing wear wears wore dressed carrying carry carries " +
    "holding has have having look looks looking footage video clips clip camera cameras between from near around over under pm am").split(" "),
);
// Query terms we cannot honour because we do not infer demographics or time-of-day.
const UNSUPPORTED = new Set(
  ("age aged ages young younger old older elderly teen teens teenager kid kids child children adult adults senior seniors male female men women man woman boy girl boys girls " +
    "gender height physique body").split(" "),
);

export function stem(t: string): string {
  if (t.length > 4 && t.endsWith("ies")) return t.slice(0, -3) + "y";
  if (t.length > 3 && t.endsWith("s") && !t.endsWith("ss")) return t.slice(0, -1);
  return t;
}

const words = (s: string): string[] => (s.toLowerCase().match(/[a-z]+/g) ?? []).map(stem);

export interface ParsedQuery {
  tokens: string[];
  unsupported: string[];
  hadNumbersOrTimes: boolean;
}

export function parseQuery(q: string): ParsedQuery {
  const lower = q.toLowerCase();
  const raw = lower.match(/[a-z]+/g) ?? [];
  const tokens: string[] = [];
  const unsupported: string[] = [];
  for (const w of raw) {
    if (UNSUPPORTED.has(w)) { unsupported.push(w); continue; }
    if (STOP.has(w) || w.length < 2) continue;
    const s = stem(w);
    if (!tokens.includes(s)) tokens.push(s);
  }
  return { tokens, unsupported, hadNumbersOrTimes: /\d/.test(lower) };
}

type FieldName = "top" | "bottom" | "outer" | "carry" | "primaryColor" | "secondaryColor" | "aesthetic";

function fieldWords(d: RealDetection): Record<FieldName, Set<string>> {
  const o = d.outfit ?? ({} as RealDetection["outfit"]);
  const outer = o.outer && o.outer.toLowerCase() !== "none" ? `${o.outer} outerwear` : "";
  return {
    top: new Set(words(o.top ?? "")),
    bottom: new Set(words(o.bottom ?? "")),
    outer: new Set(words(outer)),
    carry: new Set(words(Array.isArray(o.carry) ? o.carry.join(" ") : "")),
    primaryColor: new Set(words(o.primaryColor ?? "")),
    secondaryColor: new Set(words(o.secondaryColor ?? "")),
    aesthetic: new Set(words(o.aesthetic ?? "")),
  };
}

export interface TrackHit {
  trackingId: string;
  clipId: string;
  tSec: number;
  confidence: number;
  score: number; // 0-1: fraction of query terms matched
  matchedTerms: string[];
  matchedFields: FieldName[];
  outfit: RealDetection["outfit"];
  bbox: RealDetection["bbox"];
  traceUrl?: string;
  model: string;
}

export function scoreDetection(d: RealDetection, tokens: string[]): TrackHit | null {
  if (!tokens.length) return null;
  const f = fieldWords(d);
  const matchedTerms: string[] = [];
  const fields = new Set<FieldName>();
  for (const t of tokens) {
    let hit = false;
    for (const name of Object.keys(f) as FieldName[]) {
      if (f[name].has(t)) { hit = true; fields.add(name); }
    }
    if (hit) matchedTerms.push(t);
  }
  if (!matchedTerms.length) return null;
  return {
    trackingId: d.trackingId,
    clipId: d.clipId,
    tSec: d.tSec,
    confidence: d.confidence,
    score: +(matchedTerms.length / tokens.length).toFixed(3),
    matchedTerms,
    matchedFields: [...fields],
    outfit: d.outfit,
    bbox: d.bbox,
    traceUrl: d.traceUrl,
    model: d.model,
  };
}

export interface ClipHit {
  clip: RealClip;
  best: TrackHit;
  tracks: TrackHit[];
}

export function searchData(data: RealDataFile, tokens: string[]): ClipHit[] {
  const byClip = new Map<string, TrackHit[]>();
  for (const d of data.detections) {
    const h = scoreDetection(d, tokens);
    if (h) (byClip.get(h.clipId) ?? byClip.set(h.clipId, []).get(h.clipId)!).push(h);
  }
  const clips = new Map(data.clips.map((c) => [c.clipId, c]));
  const out: ClipHit[] = [];
  for (const [clipId, hits] of byClip) {
    const clip = clips.get(clipId);
    if (!clip) continue;
    hits.sort((a, b) => b.score - a.score || b.confidence - a.confidence || a.tSec - b.tSec);
    out.push({ clip, best: hits[0], tracks: hits });
  }
  // rank clips by best score, then by how many tracks match
  out.sort((a, b) => b.best.score - a.best.score || b.tracks.length - a.tracks.length);
  return out;
}

export const fmtTime = (s: number): string => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

/** Hue (0-360) of a hex colour; used only for the thumbnail tint. Deterministic from the label colour. */
export function hueOf(hex: string | undefined): number {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex ?? "");
  if (!m) return 210;
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => v / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min;
  if (d === 0) return 210;
  const h = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return Math.round(((h * 60) + 360) % 360);
}
