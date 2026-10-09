// On-device YOLO11n person detector for the Live camera mode (browser, ONNX Runtime Web).
// Model: /models/yolo11n.onnx, exported with Ultralytics (`yolo export model=yolo11n.pt format=onnx imgsz=640`).
// Output tensor [1, 84, 8400]: rows 0-3 = cx, cy, w, h (in 640x640 input pixels), rows 4-83 = class scores (COCO; 0 = person).
// Everything runs on the viewer's device; no frames leave the browser for detection.

export interface YoloBox {
  x: number; // px in source video coordinates
  y: number;
  w: number;
  h: number;
  score: number;
}

const SIZE = 640;
const ORT_VERSION = "1.30.0";

type Ort = typeof import("onnxruntime-web");
let ortMod: Ort | null = null;
let session: import("onnxruntime-web").InferenceSession | null = null;
let canvas: HTMLCanvasElement | null = null;

export async function loadYolo(modelUrl = "/models/yolo11n.onnx"): Promise<void> {
  if (session) return;
  ortMod = await import("onnxruntime-web");
  ortMod.env.wasm.wasmPaths = `https://cdn.jsdelivr.net/npm/onnxruntime-web@${ORT_VERSION}/dist/`;
  ortMod.env.wasm.numThreads = 1;
  session = await ortMod.InferenceSession.create(modelUrl, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
  canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
}

export function yoloReady(): boolean {
  return session !== null;
}

function iou(a: YoloBox, b: YoloBox): number {
  const x1 = Math.max(a.x, b.x), y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w), y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const u = a.w * a.h + b.w * b.h - inter;
  return u > 0 ? inter / u : 0;
}

/** Detect people in the current video frame. Returns boxes in video pixel coordinates. */
export async function detectPeople(video: HTMLVideoElement, minScore = 0.4, nmsIou = 0.45): Promise<YoloBox[]> {
  if (!session || !ortMod || !canvas) return [];
  const vw = video.videoWidth, vh = video.videoHeight;
  if (!vw || !vh) return [];
  const scale = Math.min(SIZE / vw, SIZE / vh);
  const nw = Math.round(vw * scale), nh = Math.round(vh * scale);
  const px = Math.floor((SIZE - nw) / 2), py = Math.floor((SIZE - nh) / 2);
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, SIZE, SIZE);
  ctx.drawImage(video, px, py, nw, nh);
  const { data } = ctx.getImageData(0, 0, SIZE, SIZE);
  const plane = SIZE * SIZE;
  const input = new Float32Array(3 * plane);
  for (let i = 0; i < plane; i++) {
    input[i] = data[i * 4] / 255;
    input[plane + i] = data[i * 4 + 1] / 255;
    input[2 * plane + i] = data[i * 4 + 2] / 255;
  }
  const tensor = new ortMod.Tensor("float32", input, [1, 3, SIZE, SIZE]);
  const out = await session.run({ [session.inputNames[0]]: tensor });
  const o = out[session.outputNames[0]];
  const d = o.data as Float32Array;
  const n = o.dims[2]; // 8400
  const boxes: YoloBox[] = [];
  for (let i = 0; i < n; i++) {
    const score = d[4 * n + i]; // class 0 = person
    if (score < minScore) continue;
    const cx = d[i], cy = d[n + i], w = d[2 * n + i], h = d[3 * n + i];
    boxes.push({ x: (cx - w / 2 - px) / scale, y: (cy - h / 2 - py) / scale, w: w / scale, h: h / scale, score });
  }
  boxes.sort((a, b) => b.score - a.score);
  const keep: YoloBox[] = [];
  for (const b of boxes) if (keep.every((k) => iou(k, b) < nmsIou)) keep.push(b);
  return keep;
}
