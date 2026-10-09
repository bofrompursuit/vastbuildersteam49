export const NOT_INFERRED = "not inferred" as const;

/** Kept for UI slots only. Never inferred: every value is the literal "not inferred" (privacy by design). */
export type GenderPresentation = typeof NOT_INFERRED;
export type FitSize = typeof NOT_INFERRED;
/** Aesthetic label is rule-derived from garments upstream (see realTypes.ts). */
export type StyleAesthetic = string;

export interface BoundingBox {
  x: number; // % of frame width
  y: number; // % of frame height
  w: number;
  h: number;
}

/** Slots retained in the UI; values are always "not inferred". */
export interface DemographicInference {
  ageBracket: typeof NOT_INFERRED;
  genderPresentation: GenderPresentation;
  heightCm: typeof NOT_INFERRED;
  fitSize: FitSize;
}

export interface OutfitDetection {
  primaryGarment: string; // outer garment if worn, else the top, e.g. "black puffer jacket"
  garmentCategory: string; // "Outerwear" | "Top"
  top: string;
  bottom: string;
  outer: string;
  carry: string[];
  primaryColor: string;
  secondaryColor: string;
  primaryHex: string;
  secondaryHex: string;
  aesthetic: StyleAesthetic;
  heavyOuterwear: boolean;
}

/** Demo-catalog suggestion: a deterministic rule from the real outfit to a sample SKU. NOT a model output. */
export interface ProductRecommendation {
  sku: string;
  name: string;
  priceUsd: number;
  matchScore?: number; // unused: the mapping is a rule, not a score
  rule?: string; // human-readable rule that produced it
}

/** One real detection (YOLO11 box + W&B Inference outfit label) from the replayed clips. */
export interface DetectionPayload {
  trackingId: string; // anonymous, per clip, e.g. "sf2c17-T07"
  timestamp: string; // "<clipId> @ <tSec>s" (position in the recorded clip, not wall-clock time)
  clipId?: string;
  tSec?: number;
  camera?: string;
  model?: string;
  traceUrl?: string;
  confidence: number;
  bbox: BoundingBox;
  demographics: DemographicInference;
  outfit: OutfitDetection;
  recommendation: ProductRecommendation;
}

export interface SearchResult {
  clipId: string;
  camera: string;
  timeRange: string;
  matchConfidence: number; // percent of query terms matched against the outfit label (not a model score)
  description: string;
  thumbHue: number;
  // receipts added by /api/search (all optional)
  matchType?: string;
  filename?: string;
  location?: string;
  vssOriginalVideo?: string;
  tSec?: number;
  trackingId?: string;
  traceUrl?: string | null;
}

/** Response of POST /api/agent (see docs/API_NOTES.md). */
export interface AgentResponse {
  source: "wandb" | "rules";
  model?: string;
  fallbackReason?: string;
  alerts: { id: string; severity: AgentAlert["severity"]; insight: string; action: string; metricPct: number | null }[];
  aggregates: { sightings: number; tracks: number; heavyOuterwearPct: number; aesthetics: Record<string, number> };
  data: { file: string; isSample: boolean; labeler?: string | null };
}

export interface AgentAlert {
  id: string;
  severity: "info" | "action" | "critical";
  insight: string;
  action: string;
  metricPct: number;
  campaign?: string; // used when pushing the (demo) signage preview
}

/** Replay speed multiplier (1x / 5x / 15x). Does not change inference; only how fast recorded detections replay. */
export type SamplingRate = 1 | 5 | 15;
