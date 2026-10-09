// Real-data contract for AURAAFIT (team 49, alex branch).
// Produced on the lab VM from event footage: YOLO11 person boxes -> per-person crops ->
// W&B Inference vision labels (traced in W&B Weave). The app reads public/data/detections.json.
// Demographics are intentionally NOT inferred (privacy by design); fields stay null.

export interface RealBox {
  x: number; // % of frame width (left)
  y: number; // % of frame height (top)
  w: number; // % of frame width
  h: number; // % of frame height
}

export interface RealOutfit {
  top: string; // e.g. "white t-shirt"
  bottom: string; // e.g. "light blue jeans"
  outer: string; // e.g. "black puffer jacket" or "none"
  carry: string[]; // e.g. ["black backpack", "phone"]; [] when none
  primaryColor: string; // first colour word of the top (or outer if worn)
  secondaryColor: string; // colour of the bottom
  primaryHex: string;
  secondaryHex: string;
  aesthetic: string; // rule-derived from garments: Streetwear | Athleisure | Business Casual | Minimalist | Outdoor / Technical | Smart Casual | Casual
  heavyOuterwear: boolean; // outer is a coat / puffer / parka
}

export interface RealDetection {
  trackingId: string; // anonymous, per clip, e.g. "sf2c17-T07"
  clipId: string; // matches RealClip.clipId
  tSec: number; // seconds from clip start where the label was taken
  confidence: number; // YOLO person confidence 0-1
  bbox: RealBox;
  outfit: RealOutfit;
  demographics: null; // not inferred, by design
  model: string; // labelling model, e.g. "google/gemma-4-26B-A4B-it"
  traceUrl?: string; // W&B Weave call URL for this label, when available
}

export interface RealClip {
  clipId: string; // e.g. "sf2c17"
  camera: string; // e.g. "sf_streets_cam-2"
  location: string; // e.g. "san_francisco"
  vssOriginalVideo: string; // s3 URI in our VAST VSS index (the clip receipt)
  filename: string; // VSS Explore card title
  durationSec: number;
  description: string; // one line, human-written
}

export interface RealAggregates {
  sightings: number; // person-sightings (NOT unique people)
  tracks: number; // YOLO tracks across all clips (approx. unique people per clip)
  heavyOuterwearPct: number;
  carryPct: Record<string, number>; // backpack, tote, handbag, bag, box, phone, none
  topColors: Record<string, number>;
  aesthetics: Record<string, number>;
}

export interface RealPipelineInfo {
  generatedAt: string; // ISO
  detector: string; // "YOLO11s (event GPU endpoint, called directly)"
  labeler: string; // "W&B Inference: google/gemma-4-26B-A4B-it"
  tracing: string; // "W&B Weave project vastdata/team-49"
  index: string; // "VAST VSS (team-49), clips referenced by original_video"
  promptVersion: string;
  secondsPerLabel: number; // measured
  notes: string[]; // honest limits shown in the UI
}

export interface RealDataFile {
  pipeline: RealPipelineInfo;
  clips: RealClip[];
  detections: RealDetection[];
  aggregates: RealAggregates;
}
