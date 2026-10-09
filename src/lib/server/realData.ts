// Server-only helpers: load the real precomputed detections and derive aggregates from them.
// Reads public/data/detections.json (lab VM output), falling back to detections.sample.json.
import { promises as fs } from "fs";
import path from "path";
import type { RealClip, RealDataFile, RealDetection } from "@/lib/realTypes";

export interface LoadedData {
  data: RealDataFile;
  file: string; // "detections.json" | "detections.sample.json"
  isSample: boolean;
}

const DATA_DIR = () => path.join(process.cwd(), "public", "data");
let cache: { key: string; loaded: LoadedData } | null = null;

async function tryRead(name: string): Promise<{ key: string; data: RealDataFile } | null> {
  const p = path.join(DATA_DIR(), name);
  try {
    const st = await fs.stat(p);
    const key = `${name}:${st.mtimeMs}:${st.size}`;
    if (cache && cache.key === key) return { key, data: cache.loaded.data };
    const parsed = JSON.parse(await fs.readFile(p, "utf8")) as Partial<RealDataFile>;
    if (!parsed || !Array.isArray(parsed.detections) || !Array.isArray(parsed.clips)) return null;
    return { key, data: parsed as RealDataFile };
  } catch {
    return null;
  }
}

export async function loadRealData(): Promise<LoadedData> {
  for (const name of ["detections.json", "detections.sample.json"]) {
    const r = await tryRead(name);
    if (r) {
      if (cache && cache.key === r.key) return cache.loaded;
      const loaded = { data: r.data, file: name, isSample: name !== "detections.json" };
      cache = { key: r.key, loaded };
      return loaded;
    }
  }
  throw new Error("No detections data file found in public/data (detections.json or detections.sample.json)");
}

/** Carry categories used by the aggregates contract. */
export const CARRY_CATEGORIES = ["backpack", "tote", "handbag", "bag", "box", "phone"] as const;

export function carryCategory(item: string): string {
  const s = item.toLowerCase();
  if (s.includes("backpack") || s.includes("rucksack")) return "backpack";
  if (s.includes("tote")) return "tote";
  if (s.includes("handbag") || s.includes("purse") || s.includes("clutch")) return "handbag";
  if (s.includes("bag")) return "bag";
  if (s.includes("box") || s.includes("package") || s.includes("parcel")) return "box";
  if (s.includes("phone")) return "phone";
  return "other";
}

const carryList = (d: RealDetection): string[] => (Array.isArray(d.outfit?.carry) ? d.outfit.carry.filter((c) => typeof c === "string") : []);

export interface ComputedAggregates {
  sightings: number;
  tracks: number;
  heavyOuterwearPct: number;
  carryPct: Record<string, number>; // % of sightings carrying each category; "none" = carrying nothing detected
  topColors: Record<string, number>; // primary colour -> % of sightings
  aesthetics: Record<string, number>; // aesthetic -> % of sightings
  topColorsCount: Record<string, number>;
  aestheticsCount: Record<string, number>;
}

const pct = (n: number, d: number) => (d > 0 ? Math.round((n / d) * 100) : 0);
const sortDesc = (m: Record<string, number>) => Object.fromEntries(Object.entries(m).sort((a, b) => b[1] - a[1]));

export function computeAggregates(dets: RealDetection[]): ComputedAggregates {
  const n = dets.length;
  const colorCount: Record<string, number> = {};
  const aesCount: Record<string, number> = {};
  const carryCount: Record<string, number> = Object.fromEntries([...CARRY_CATEGORIES, "none"].map((k) => [k, 0]));
  let heavy = 0;
  for (const d of dets) {
    if (d.outfit?.heavyOuterwear) heavy++;
    const c = d.outfit?.primaryColor || "Unknown";
    colorCount[c] = (colorCount[c] ?? 0) + 1;
    const a = d.outfit?.aesthetic || "Unknown";
    aesCount[a] = (aesCount[a] ?? 0) + 1;
    const cats = new Set(carryList(d).map(carryCategory));
    if (cats.size === 0) carryCount.none++;
    cats.forEach((k) => (carryCount[k] = (carryCount[k] ?? 0) + 1));
  }
  return {
    sightings: n,
    tracks: new Set(dets.map((d) => d.trackingId)).size,
    heavyOuterwearPct: pct(heavy, n),
    carryPct: Object.fromEntries(Object.entries(carryCount).map(([k, v]) => [k, pct(v, n)])),
    topColors: sortDesc(Object.fromEntries(Object.entries(colorCount).map(([k, v]) => [k, pct(v, n)]))),
    aesthetics: sortDesc(Object.fromEntries(Object.entries(aesCount).map(([k, v]) => [k, pct(v, n)]))),
    topColorsCount: sortDesc(colorCount),
    aestheticsCount: sortDesc(aesCount),
  };
}

export function clipById(data: RealDataFile): Map<string, RealClip> {
  return new Map(data.clips.map((c) => [c.clipId, c]));
}

/** Normalise a user-supplied name/URL to a basename without extension, lower-case. */
function baseName(s: string): string {
  const noQuery = s.split(/[?#]/)[0];
  const last = noQuery.split(/[\/]/).filter(Boolean).pop() ?? noQuery;
  return last.replace(/\.[a-z0-9]{2,4}$/i, "").trim().toLowerCase();
}

/** Find one of our clips by filename, clipId, or VSS URI (exact basename match; no fuzzy guessing). */
export function findClip(data: RealDataFile, ...candidates: (string | undefined)[]): RealClip | undefined {
  for (const cand of candidates) {
    if (!cand || typeof cand !== "string") continue;
    const b = baseName(cand);
    if (!b) continue;
    const hit = data.clips.find(
      (c) => c.clipId.toLowerCase() === b || baseName(c.filename) === b || baseName(c.vssOriginalVideo) === b,
    );
    if (hit) return hit;
  }
  return undefined;
}

export function csvEscape(v: string | number | boolean | null | undefined): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = "'" + s; // neutralise spreadsheet formula injection from model-generated labels
  return `"${s.replace(/"/g, '""')}"`;
}

export const NOT_INFERRED = "not inferred";
