export type GenderPresentation = "Masculine" | "Feminine" | "Androgynous";
export type FitSize = "XS" | "S" | "M" | "L" | "XL" | "XXL";
export type StyleAesthetic =
  | "Athleisure"
  | "Streetwear"
  | "Business Casual"
  | "Minimalist"
  | "Outdoor / Technical"
  | "Smart Casual";

export interface BoundingBox {
  x: number; // % of frame width
  y: number; // % of frame height
  w: number;
  h: number;
}

export interface DemographicInference {
  ageBracket: string; // e.g. "24-30"
  genderPresentation: GenderPresentation;
  heightCm: number;
  fitSize: FitSize;
}

export interface OutfitDetection {
  primaryGarment: string; // e.g. "Black Oversized Hoodie"
  garmentCategory: "Outerwear" | "Top" | "Dress" | "Activewear";
  primaryColor: string;
  secondaryColor: string;
  primaryHex: string;
  secondaryHex: string;
  aesthetic: StyleAesthetic;
  heavyOuterwear: boolean;
}

export interface ProductRecommendation {
  sku: string;
  name: string;
  priceUsd: number;
  matchScore: number; // 0-1
}

/** One YOLO detection enriched by NVIDIA Cosmos. */
export interface DetectionPayload {
  trackingId: string; // anonymous, e.g. "TRK-8092"
  timestamp: string; // ISO
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
  matchConfidence: number; // percent
  description: string;
  thumbHue: number;
}

export interface AgentAlert {
  id: string;
  severity: "info" | "action" | "critical";
  insight: string;
  action: string;
  metricPct: number;
}

export type SamplingRate = 1 | 5 | 15;
