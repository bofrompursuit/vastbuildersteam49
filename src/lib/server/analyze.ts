// Server-only: build an AnalysisResult-shaped response from REAL precomputed detections.
// Fields that the old simulator invented (height, physique) are "not inferred": 0 / "Not inferred".
import { nameColor, type AnalysisResult, type Distribution, type ExtractedTrack, type Recommendations, type VideoSource } from "@/lib/analysis";
import type { RealClip, RealDataFile, RealDetection } from "@/lib/realTypes";
import { carryCategory, computeAggregates, csvEscape, NOT_INFERRED } from "./realData";

/** An ExtractedTrack plus the real outfit fields. Extra fields survive the client round-trip to /api/analyze/csv. */
export interface RealExtractedTrack extends ExtractedTrack {
  clipId?: string;
  top?: string;
  bottom?: string;
  outer?: string;
  carry?: string[];
  aesthetic?: string;
  heavyOuterwear?: boolean;
  model?: string;
  traceUrl?: string | null;
}

export const LAB_ONLY_MESSAGE =
  "Uploaded-video analysis runs in the lab pipeline (YOLO11 person detection + W&B Inference vision labels, traced in W&B Weave), not on this demo deployment. " +
  "This request does not name one of our precomputed clips, so no features were extracted. Re-submit with one of the clip filenames listed in realDataAvailableFor to see real per-track features.";

export function clipSummaries(data: RealDataFile) {
  return data.clips.map((c) => ({
    clipId: c.clipId,
    filename: c.filename,
    vssOriginalVideo: c.vssOriginalVideo,
    camera: c.camera,
    location: c.location,
    durationSec: c.durationSec,
    sightings: data.detections.filter((d) => d.clipId === c.clipId).length,
  }));
}

const toTrack = (d: RealDetection): RealExtractedTrack => {
  const o = d.outfit;
  return {
    trackId: d.trackingId,
    timestampSec: d.tSec,
    primaryHex: o.primaryHex,
    primaryColor: o.primaryColor,
    primaryShade: nameColor(o.primaryHex || "#999999").shade,
    secondaryHex: o.secondaryHex,
    secondaryColor: o.secondaryColor,
    accessories: (o.carry ?? []) as ExtractedTrack["accessories"], // real carried-item labels, e.g. "black backpack"
    heightCm: null, // not inferred
    heightIn: null, // not inferred
    physique: NOT_INFERRED as ExtractedTrack["physique"],
    detectionConfidence: d.confidence,
    attributeConfidence: null, // no per-attribute confidence is produced by the labeller
    clipId: d.clipId,
    top: o.top,
    bottom: o.bottom,
    outer: o.outer,
    carry: o.carry ?? [],
    aesthetic: o.aesthetic,
    heavyOuterwear: o.heavyOuterwear,
    model: d.model,
    traceUrl: d.traceUrl ?? null,
  };
};

function dist(counts: Map<string, number>, total: number, hexOf?: (l: string) => string | undefined): Distribution[] {
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([label, count]) => ({ label, count, pct: Math.round((count / Math.max(total, 1)) * 100), hex: hexOf?.(label) }));
}

function recommendations(dets: RealDetection[]): Recommendations {
  const a = computeAggregates(dets);
  const colors = Object.entries(a.topColors);
  const style = Object.entries(a.aesthetics)[0];
  const carry = Object.entries(a.carryPct).filter(([k]) => k !== "none").sort((x, y) => y[1] - x[1])[0];
  const hexOf = new Map<string, string>();
  dets.forEach((d) => d.outfit.primaryColor && !hexOf.has(d.outfit.primaryColor) && hexOf.set(d.outfit.primaryColor, d.outfit.primaryHex));
  const darkPct = dets.length
    ? Math.round((dets.filter((d) => nameColor(d.outfit.primaryHex || "#999999").shade === "Dark").length / dets.length) * 100)
    : 0;
  const [c1, c2] = colors;
  const b2b: Recommendations["b2b"] = [];
  if (c1) b2b.push({ tag: "GTM", title: `Lead with ${c1[0]} tones`, detail: `${c1[1]}% of person-sightings have ${c1[0]} as the primary colour${c2 ? `, followed by ${c2[0]} (${c2[1]}%)` : ""}.` });
  b2b.push({ tag: "Inventory", title: a.heavyOuterwearPct >= 25 ? "Weight stock toward heavy outerwear" : "Keep heavy outerwear secondary", detail: `${a.heavyOuterwearPct}% of person-sightings wear a coat, puffer or parka.` });
  if (carry && carry[1] > 0) b2b.push({ tag: "Merchandising", title: `Cross-merchandise ${carry[0]}s`, detail: `${carry[1]}% of person-sightings carry a ${carry[0]}.` });
  else if (style) b2b.push({ tag: "Merchandising", title: `Merchandise for ${style[0]}`, detail: `${style[0]} is the most common aesthetic (${style[1]}% of person-sightings).` });
  b2b.push({ tag: "Visual Trigger", title: darkPct > 50 ? "Brighten window displays for contrast" : "Feature darker statement pieces", detail: `${darkPct}% of primary colours observed are dark shades.` });
  return {
    b2b,
    b2c: [
      { title: "Trending palette in this footage", detail: `Most common primary colours: ${colors.slice(0, 3).map(([k]) => k).join(", ") || "n/a"}.`, swatches: colors.slice(0, 4).map(([k]) => hexOf.get(k) ?? "#999999") },
    ],
  };
}

export function buildRealResult(data: RealDataFile, clip: RealClip, source: VideoSource, file: string, isSample: boolean) {
  const dets = data.detections.filter((d) => d.clipId === clip.clipId);
  const tracks = dets.map(toTrack);
  const n = tracks.length;
  const agg = computeAggregates(dets);

  const colorCounts = new Map<string, number>();
  const hexByColor = new Map<string, string>();
  const accCounts = new Map<string, number>();
  for (const d of dets) {
    colorCounts.set(d.outfit.primaryColor, (colorCounts.get(d.outfit.primaryColor) ?? 0) + 1);
    if (!hexByColor.has(d.outfit.primaryColor)) hexByColor.set(d.outfit.primaryColor, d.outfit.primaryHex);
    for (const cat of new Set((d.outfit.carry ?? []).map(carryCategory))) accCounts.set(cat, (accCounts.get(cat) ?? 0) + 1);
  }

  const result: AnalysisResult & Record<string, unknown> = {
    jobId: `REAL-${clip.clipId}`,
    source: { ...source, name: clip.filename },
    processedAt: data.pipeline?.generatedAt ?? new Date().toISOString(),
    tracks,
    aggregates: {
      totalTracks: agg.tracks,
      avgHeightCm: null, // not inferred
      colors: dist(colorCounts, n, (l) => hexByColor.get(l)),
      accessories: dist(accCounts, n),
      physiques: [{ label: "Not inferred", count: n, pct: n ? 100 : 0 }],
    },
    recommendations: recommendations(dets),
    // honest-mode extras (UI may ignore)
    mode: "precomputed-real",
    realData: true,
    clip,
    dataSource: { file, isSample, generatedAt: data.pipeline?.generatedAt ?? null, detector: data.pipeline?.detector ?? null, labeler: data.pipeline?.labeler ?? null, tracing: data.pipeline?.tracing ?? null },
    notes: [
      "Real precomputed per-track outfit labels (YOLO11 person boxes, W&B Inference vision labels). Not computed on upload.",
      "Height and physique are not inferred, by design (shown as 0 / 'Not inferred'). Accessories are the labelled carried items.",
      "Counts are person-sightings per sampled frame, not unique shoppers.",
      ...(isSample ? ["Data is from detections.sample.json (shape sample), not the full lab output."] : []),
    ],
  };
  return result;
}

export function buildLabOnlyResult(data: RealDataFile, source: VideoSource) {
  const result: AnalysisResult & Record<string, unknown> = {
    jobId: "LAB-PIPELINE-ONLY",
    source,
    processedAt: new Date().toISOString(),
    tracks: [],
    aggregates: { totalTracks: 0, avgHeightCm: null, colors: [], accessories: [], physiques: [] },
    recommendations: { b2b: [], b2c: [] },
    mode: "lab-pipeline-only",
    realData: false,
    message: LAB_ONLY_MESSAGE,
    realDataAvailableFor: clipSummaries(data),
  };
  return result;
}

const HEAD = [
  "source", "clip_id", "track_id", "timestamp_sec", "top", "bottom", "outer", "carry", "primary_color", "primary_hex",
  "secondary_color", "secondary_hex", "aesthetic", "heavy_outerwear", "detection_confidence", "model", "trace_url",
  "age_bracket", "gender_presentation", "height_cm", "fit_size",
];

/** CSV for tracks round-tripped from /api/analyze. Demographic columns are always "not inferred". */
export function tracksToCsv(tracks: RealExtractedTrack[], source: VideoSource): string {
  const rows = tracks.map((t) =>
    [
      source.name, t.clipId, t.trackId, t.timestampSec, t.top, t.bottom, t.outer, (t.carry ?? t.accessories ?? []).join("; "),
      t.primaryColor, t.primaryHex, t.secondaryColor, t.secondaryHex, t.aesthetic, t.heavyOuterwear, t.detectionConfidence, t.model, t.traceUrl,
      NOT_INFERRED, NOT_INFERRED, NOT_INFERRED, NOT_INFERRED,
    ].map(csvEscape).join(","),
  );
  return [HEAD.join(","), ...rows].join("\n");
}
