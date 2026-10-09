import type {
  AgentAlert,
  DetectionPayload,
  FitSize,
  GenderPresentation,
  OutfitDetection,
  ProductRecommendation,
  SearchResult,
} from "./types";

const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

type OutfitTemplate = Omit<OutfitDetection, "primaryColor" | "secondaryColor" | "primaryHex" | "secondaryHex"> & {
  colors: [string, string, string, string];
  rec: ProductRecommendation;
};

const OUTFITS: OutfitTemplate[] = [
  { primaryGarment: "Black Oversized Hoodie", garmentCategory: "Outerwear", aesthetic: "Streetwear", heavyOuterwear: false, colors: ["Black", "Charcoal", "#111827", "#374151"], rec: { sku: "SW-2210", name: "Heavyweight Cargo Jogger", priceUsd: 68, matchScore: 0.94 } },
  { primaryGarment: "Navy Puffer Jacket", garmentCategory: "Outerwear", aesthetic: "Outdoor / Technical", heavyOuterwear: true, colors: ["Navy", "White", "#1e3a8a", "#f8fafc"], rec: { sku: "OW-4471", name: "Thermal Fleece Beanie", priceUsd: 24, matchScore: 0.91 } },
  { primaryGarment: "Camel Wool Overcoat", garmentCategory: "Outerwear", aesthetic: "Business Casual", heavyOuterwear: true, colors: ["Camel", "Grey", "#c19a6b", "#6b7280"], rec: { sku: "BC-1180", name: "Cashmere Crew Sweater", priceUsd: 129, matchScore: 0.89 } },
  { primaryGarment: "Grey Zip Track Jacket", garmentCategory: "Activewear", aesthetic: "Athleisure", heavyOuterwear: false, colors: ["Grey", "Lime", "#9ca3af", "#a3e635"], rec: { sku: "AT-3302", name: "Performance Running Tight", priceUsd: 58, matchScore: 0.92 } },
  { primaryGarment: "Olive Shell Parka", garmentCategory: "Outerwear", aesthetic: "Outdoor / Technical", heavyOuterwear: true, colors: ["Olive", "Black", "#556b2f", "#111827"], rec: { sku: "OW-4502", name: "Waterproof Trail Boot", priceUsd: 149, matchScore: 0.88 } },
  { primaryGarment: "White Linen Shirt", garmentCategory: "Top", aesthetic: "Minimalist", heavyOuterwear: false, colors: ["White", "Beige", "#f8fafc", "#e7d8c9"], rec: { sku: "MN-0912", name: "Tapered Chino", priceUsd: 72, matchScore: 0.87 } },
  { primaryGarment: "Burgundy Quilted Vest", garmentCategory: "Outerwear", aesthetic: "Smart Casual", heavyOuterwear: true, colors: ["Burgundy", "Cream", "#7f1d1d", "#fef3c7"], rec: { sku: "SC-5521", name: "Merino Turtleneck", priceUsd: 89, matchScore: 0.9 } },
];

const AGES = ["16-23", "24-30", "31-40", "41-55", "55+"] as const;
const GENDERS: GenderPresentation[] = ["Masculine", "Feminine", "Androgynous"];
const SIZES: FitSize[] = ["XS", "S", "M", "L", "XL", "XXL"];

let seq = 8090;

export function generateDetection(): DetectionPayload {
  const o = pick(OUTFITS);
  const height = 152 + Math.round(Math.random() * 38);
  return {
    trackingId: `TRK-${seq++}`,
    timestamp: new Date().toISOString(),
    confidence: +(0.86 + Math.random() * 0.13).toFixed(3),
    bbox: { x: -12, y: 22 + Math.random() * 22, w: 9 + Math.random() * 3, h: 44 + Math.random() * 14 },
    demographics: {
      ageBracket: pick(AGES),
      genderPresentation: pick(GENDERS),
      heightCm: height,
      fitSize: SIZES[Math.min(5, Math.max(0, Math.floor((height - 150) / 7)))],
    },
    outfit: {
      primaryGarment: o.primaryGarment,
      garmentCategory: o.garmentCategory,
      aesthetic: o.aesthetic,
      heavyOuterwear: o.heavyOuterwear,
      primaryColor: o.colors[0],
      secondaryColor: o.colors[1],
      primaryHex: o.colors[2],
      secondaryHex: o.colors[3],
    },
    recommendation: { ...o.rec, matchScore: +(o.rec.matchScore - Math.random() * 0.05).toFixed(2) },
  };
}

/** Simulated vector search over temporal clip embeddings. */
export function semanticSearch(query: string): SearchResult[] {
  const q = query.toLowerCase();
  const garment = OUTFITS.find((o) => q.includes(o.colors[0].toLowerCase()) || q.includes(o.primaryGarment.split(" ").pop()!.toLowerCase()));
  const label = garment?.primaryGarment ?? "matching outfit";
  const base = 98.4;
  return [
    { cam: "CAM-01 Entrance", t: "14:12:08 – 14:12:31", h: 210 },
    { cam: "CAM-03 Outerwear Aisle", t: "14:47:52 – 14:48:20", h: 160 },
    { cam: "CAM-01 Entrance", t: "15:36:04 – 15:36:19", h: 260 },
  ].map((c, i) => ({
    clipId: `CLIP-${(Date.now() % 100000) + i}`,
    camera: c.cam,
    timeRange: c.t,
    matchConfidence: +(base - i * (2.1 + Math.random() * 2)).toFixed(1),
    description: `Shopper in ${label}`,
    thumbHue: c.h,
  }));
}

/** W&B managed LLM agent: reasons over a window of detections. */
export function agentAlerts(window: DetectionPayload[]): AgentAlert[] {
  const n = Math.max(window.length, 1);
  const heavy = Math.round((window.filter((d) => d.outfit.heavyOuterwear).length / n) * 100);
  const counts = new Map<string, number>();
  window.forEach((d) => counts.set(d.outfit.aesthetic, (counts.get(d.outfit.aesthetic) ?? 0) + 1));
  const [topStyle, topCount] = [...counts.entries()].sort((a, b) => b[1] - a[1])[0] ?? ["Streetwear", 0];
  const youth = Math.round((window.filter((d) => ["16-23", "24-30"].includes(d.demographics.ageBracket)).length / n) * 100);
  return [
    {
      id: "signage",
      severity: "action",
      metricPct: heavy,
      insight: `${heavy}% of incoming foot traffic in the last 30 mins is wearing heavy outerwear.`,
      action: "Auto-update entrance digital display to feature Winter Outerwear Collection.",
    },
    {
      id: "merch",
      severity: "info",
      metricPct: Math.round((topCount / n) * 100),
      insight: `${topStyle} is the dominant aesthetic (${Math.round((topCount / n) * 100)}% of tracked shoppers).`,
      action: `Re-merchandise front table with ${topStyle} best-sellers; replenish sizes M/L.`,
    },
    {
      id: "staff",
      severity: youth > 60 ? "critical" : "info",
      metricPct: youth,
      insight: `${youth}% of shoppers are under 30.`,
      action: "Push mobile-checkout QR prompts to the fitting-room displays.",
    },
  ];
}
