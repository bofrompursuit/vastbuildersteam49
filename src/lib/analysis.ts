// Video feature extraction + business-intelligence engine.
// Colors can be supplied from real frame sampling (client canvas); detections are simulated
// until the AI video-ingestion pipeline replaces `extractTracks`.

export type Physique = "Athletic" | "Slim" | "Average" | "Structured Fit" | "Relaxed";
export type Accessory = "Cross-body Bag" | "Sunglasses" | "Beanie" | "Minimalist Watch" | "Tote" | "Belt" | "Backpack" | "Cap" | "Scarf";

export interface PaletteColor {
  hex: string;
  name: string;
  shade: "Light" | "Mid" | "Dark";
  share: number; // 0-1 of sampled pixels
}

export interface VideoSource {
  kind: "upload" | "url";
  name: string;
  sizeBytes?: number;
  durationSec?: number;
  sampledPalette?: PaletteColor[]; // real colors from frame sampling, if available
}

export interface ExtractedTrack {
  trackId: string;
  timestampSec: number;
  primaryHex: string;
  primaryColor: string;
  primaryShade: PaletteColor["shade"];
  secondaryHex: string;
  secondaryColor: string;
  accessories: Accessory[];
  heightCm: number;
  heightIn: number;
  physique: Physique;
  detectionConfidence: number;
  attributeConfidence: number;
}

export interface Distribution {
  label: string;
  count: number;
  pct: number;
  hex?: string;
}

export interface TrendAggregates {
  totalTracks: number;
  avgHeightCm: number;
  colors: Distribution[];
  accessories: Distribution[];
  physiques: Distribution[];
}

export interface Recommendations {
  b2b: { title: string; detail: string; tag: "GTM" | "Inventory" | "Merchandising" | "Visual Trigger" }[];
  b2c: { title: string; detail: string; swatches?: string[] }[];
}

export interface AnalysisResult {
  jobId: string;
  source: VideoSource;
  processedAt: string;
  tracks: ExtractedTrack[];
  aggregates: TrendAggregates;
  recommendations: Recommendations;
}

const NAMED: [string, number, number, number][] = [
  ["Black", 17, 24, 39], ["Charcoal", 55, 65, 81], ["Grey", 156, 163, 175], ["White", 248, 250, 252],
  ["Cream", 254, 243, 199], ["Beige", 231, 216, 201], ["Camel", 193, 154, 107], ["Brown", 120, 72, 40],
  ["Navy", 30, 58, 138], ["Denim Blue", 70, 110, 160], ["Sky Blue", 125, 190, 230], ["Olive", 85, 107, 47],
  ["Forest Green", 34, 85, 51], ["Sage", 156, 175, 136], ["Burgundy", 127, 29, 29], ["Red", 200, 40, 40],
  ["Rust", 183, 65, 14], ["Mustard", 210, 160, 40], ["Blush Pink", 240, 180, 190], ["Lavender", 180, 160, 220],
];

const hex = (r: number, g: number, b: number) => "#" + [r, g, b].map((v) => v.toString(16).padStart(2, "0")).join("");

export function nameColor(h: string): Pick<PaletteColor, "name" | "shade"> {
  const n = parseInt(h.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  let best = NAMED[0], bestD = Infinity;
  for (const c of NAMED) {
    const d = (c[1] - r) ** 2 + (c[2] - g) ** 2 + (c[3] - b) ** 2;
    if (d < bestD) [best, bestD] = [c, d];
  }
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return { name: best[0], shade: lum > 170 ? "Light" : lum > 80 ? "Mid" : "Dark" };
}

const DEFAULT_PALETTE: PaletteColor[] = ["#111827", "#1e3a8a", "#c19a6b", "#9ca3af", "#556b2f", "#f8fafc"].map((h, i) => ({
  hex: h, ...nameColor(h), share: [0.28, 0.2, 0.16, 0.14, 0.12, 0.1][i],
}));

const ACCESSORIES: Accessory[] = ["Cross-body Bag", "Sunglasses", "Beanie", "Minimalist Watch", "Tote", "Belt", "Backpack", "Cap", "Scarf"];
const PHYSIQUES: Physique[] = ["Athletic", "Slim", "Average", "Structured Fit", "Relaxed"];

// small seeded PRNG so the same video gives the same result
function rng(seed: string) {
  let h = 2166136261;
  for (const ch of seed) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return () => ((h = Math.imul(h ^ (h >>> 15), 2246822507) ^ Math.imul(h ^ (h >>> 13), 3266489909)) >>> 0) / 4294967296;
}

function weighted<T extends { share: number }>(items: T[], r: number): T {
  let acc = 0;
  for (const it of items) if ((acc += it.share) >= r) return it;
  return items[items.length - 1];
}

export function extractTracks(source: VideoSource): ExtractedTrack[] {
  const rand = rng(source.name + (source.sizeBytes ?? ""));
  const palette = source.sampledPalette?.length ? source.sampledPalette : DEFAULT_PALETTE;
  const total = palette.reduce((s, c) => s + c.share, 0);
  const norm = palette.map((c) => ({ ...c, share: c.share / total }));
  const duration = source.durationSec ?? 60;
  const n = 18 + Math.floor(rand() * 18);

  return Array.from({ length: n }, (_, i) => {
    const p = weighted(norm, rand());
    const s = weighted(norm.filter((c) => c.hex !== p.hex).map((c, _, a) => ({ ...c, share: 1 / a.length })), rand()) ?? p;
    const heightCm = 152 + Math.round(rand() * 38);
    const accessories = ACCESSORIES.filter(() => rand() < 0.22).slice(0, 3);
    return {
      trackId: `VID-${String(i + 1).padStart(3, "0")}`,
      timestampSec: +((duration * i) / n + rand() * 2).toFixed(1),
      primaryHex: p.hex,
      primaryColor: p.name,
      primaryShade: p.shade,
      secondaryHex: s.hex,
      secondaryColor: s.name,
      accessories,
      heightCm,
      heightIn: +(heightCm / 2.54).toFixed(1),
      physique: PHYSIQUES[Math.floor(rand() * PHYSIQUES.length)],
      detectionConfidence: +(0.82 + rand() * 0.17).toFixed(3),
      attributeConfidence: +(0.74 + rand() * 0.22).toFixed(3),
    };
  });
}

function distribution(values: string[], total: number, hexOf?: (l: string) => string): Distribution[] {
  const m = new Map<string, number>();
  values.forEach((v) => m.set(v, (m.get(v) ?? 0) + 1));
  return [...m.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, pct: Math.round((count / Math.max(total, 1)) * 100), hex: hexOf?.(label) }));
}

export function aggregate(tracks: ExtractedTrack[]): TrendAggregates {
  const n = tracks.length;
  const hexByName = new Map(tracks.map((t) => [t.primaryColor, t.primaryHex]));
  return {
    totalTracks: n,
    avgHeightCm: Math.round(tracks.reduce((s, t) => s + t.heightCm, 0) / Math.max(n, 1)),
    colors: distribution(tracks.map((t) => t.primaryColor), n, (l) => hexByName.get(l) ?? "#999"),
    accessories: distribution(tracks.flatMap((t) => t.accessories), n),
    physiques: distribution(tracks.map((t) => t.physique), n),
  };
}

export function recommend(a: TrendAggregates): Recommendations {
  const [c1, c2] = a.colors;
  const acc = a.accessories[0];
  const fit = a.physiques[0];
  const dark = a.colors.filter((c) => nameColor(c.hex ?? "#000").shade === "Dark").reduce((s, c) => s + c.pct, 0);
  return {
    b2b: [
      { tag: "GTM", title: `Lead the next drop with ${c1?.label ?? "core"} tones`, detail: `${c1?.pct ?? 0}% of tracked subjects wear ${c1?.label} as their primary color${c2 ? `, followed by ${c2.label} (${c2.pct}%)` : ""}. Prioritise these colorways in paid social creative and launch lookbooks.` },
      { tag: "Inventory", title: `Shift stock toward ${fit?.label ?? "core"} silhouettes`, detail: `${fit?.label} physiques make up ${fit?.pct ?? 0}% of traffic (avg height ${a.avgHeightCm} cm). Rebalance size curves and reorder ${fit?.label === "Slim" ? "slim/tapered" : fit?.label === "Athletic" ? "stretch & athletic-cut" : "regular & relaxed"} fits.` },
      { tag: "Merchandising", title: acc ? `Cross-merchandise ${acc.label.toLowerCase()}s at point of sale` : "Add accessory add-ons at checkout", detail: acc ? `${acc.pct}% of subjects carry a ${acc.label.toLowerCase()} — bundle with top garments and place on front tables.` : "Low accessory prevalence: introduce entry-price add-ons." },
      { tag: "Visual Trigger", title: dark > 50 ? "Brighten window displays for contrast" : "Feature darker statement pieces", detail: dark > 50 ? `${dark}% of observed palettes are dark shades — a light, high-contrast window will stand out to passers-by.` : `Only ${dark}% dark shades observed — anchor displays with deep tones to create focal points.` },
    ],
    b2c: [
      { title: "Your trending palette", detail: `The street is wearing ${a.colors.slice(0, 3).map((c) => c.label).join(", ")}. These pair well as a tonal base with one accent.`, swatches: a.colors.slice(0, 4).map((c) => c.hex ?? "#999") },
      { title: "Complementary pieces", detail: `With ${c1?.label ?? "neutral"} as a base, try a ${c2?.label ?? "contrasting"} layer and ${acc ? (acc.label === "Sunglasses" ? "sunglasses" : `a ${acc.label.toLowerCase()}`) : "a minimalist watch"} to match what's trending.` },
      { title: "Fit insight", detail: `${fit?.label ?? "Average"} cuts dominate — look for ${fit?.label === "Structured Fit" ? "tailored shoulders and clean lines" : fit?.label === "Relaxed" ? "dropped shoulders and wide legs" : "a true-to-size, slightly tapered fit"}.` },
    ],
  };
}

export function toCsv(tracks: ExtractedTrack[], source: VideoSource): string {
  const head = "source,track_id,timestamp_sec,primary_color,primary_hex,primary_shade,secondary_color,secondary_hex,accessories,height_cm,height_in,physique,detection_confidence,attribute_confidence";
  const esc = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return [head, ...tracks.map((t) =>
    [esc(source.name), t.trackId, t.timestampSec, t.primaryColor, t.primaryHex, t.primaryShade, t.secondaryColor, t.secondaryHex, esc(t.accessories.join("; ")), t.heightCm, t.heightIn, t.physique, t.detectionConfidence, t.attributeConfidence].join(","),
  )].join("\n");
}

export function analyze(source: VideoSource): AnalysisResult {
  const tracks = extractTracks(source);
  const aggregates = aggregate(tracks);
  return { jobId: `JOB-${Date.now().toString(36).toUpperCase()}`, source, processedAt: new Date().toISOString(), tracks, aggregates, recommendations: recommend(aggregates) };
}

export { hex as rgbToHex };
