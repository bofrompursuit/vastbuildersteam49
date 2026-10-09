import type { ProductRecommendation } from "./types";

// DEMO CATALOG: sample SKUs that already shipped in the AURAAFIT prototype. The mapping from a real
// outfit to one of these is a fixed rule (aesthetic, then heavy outerwear). It is not a model output
// and not a score. Prices are demo prices.
const SKU = {
  jogger: { sku: "SW-2210", name: "Heavyweight Cargo Jogger", priceUsd: 68 },
  beanie: { sku: "OW-4471", name: "Thermal Fleece Beanie", priceUsd: 24 },
  sweater: { sku: "BC-1180", name: "Cashmere Crew Sweater", priceUsd: 129 },
  tight: { sku: "AT-3302", name: "Performance Running Tight", priceUsd: 58 },
  boot: { sku: "OW-4502", name: "Waterproof Trail Boot", priceUsd: 149 },
  chino: { sku: "MN-0912", name: "Tapered Chino", priceUsd: 72 },
  turtleneck: { sku: "SC-5521", name: "Merino Turtleneck", priceUsd: 89 },
} as const;

export const DEMO_CATALOG_LABEL = "Demo catalog";

export function recommendFor(aesthetic: string, heavyOuterwear: boolean): ProductRecommendation {
  const pick = (s: (typeof SKU)[keyof typeof SKU], rule: string): ProductRecommendation => ({ ...s, rule });
  switch (aesthetic) {
    case "Streetwear":
      return pick(SKU.jogger, "Streetwear -> cargo jogger");
    case "Outdoor / Technical":
      return heavyOuterwear ? pick(SKU.beanie, "Outdoor + heavy outerwear -> fleece beanie") : pick(SKU.boot, "Outdoor, light layer -> trail boot");
    case "Business Casual":
      return pick(SKU.sweater, "Business Casual -> crew sweater");
    case "Athleisure":
      return pick(SKU.tight, "Athleisure -> running tight");
    case "Minimalist":
      return pick(SKU.chino, "Minimalist -> tapered chino");
    case "Smart Casual":
      return pick(SKU.turtleneck, "Smart Casual -> merino turtleneck");
    default:
      return heavyOuterwear ? pick(SKU.beanie, "Heavy outerwear -> fleece beanie") : pick(SKU.chino, "Casual / other -> tapered chino (basics)");
  }
}
