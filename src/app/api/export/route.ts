import { generateDetection } from "@/lib/engine";

export async function GET() {
  const rows = Array.from({ length: 50 }, generateDetection);
  const header = "tracking_id,timestamp,age_bracket,gender_presentation,height_cm,fit_size,garment,primary_color,aesthetic,recommended_sku";
  const csv = [
    header,
    ...rows.map((d) =>
      [d.trackingId, d.timestamp, d.demographics.ageBracket, d.demographics.genderPresentation, d.demographics.heightCm, d.demographics.fitSize, `"${d.outfit.primaryGarment}"`, d.outfit.primaryColor, d.outfit.aesthetic, d.recommendation.sku].join(","),
    ),
  ].join("\n");
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="aurafit-compliance-${Date.now()}.csv"`,
    },
  });
}
