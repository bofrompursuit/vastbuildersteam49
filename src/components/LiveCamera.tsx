"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, CameraOff, Circle, Loader2, Square } from "lucide-react";

const LABEL_TICK_MS = 1000; // per-track labelling loop cadence
const LABEL_STALE_MS = 2000; // re-label a track when its label is older than this
const MAX_IN_FLIGHT = 2;
const MAX_PER_TICK = 4;
const MIN_SCORE = 0.5;
const IOU_MATCH = 0.3;
const DROP_MS = 1000;
const CROP_PAD = 0.08;
const CROP_MAX_SIDE = 512;
const MIN_CROP_SIDE = 40;
const RATE_WINDOW_MS = 10_000;

interface LivePerson {
  top: string;
  bottom: string;
  outer: string;
  carry: string[];
  motion: string;
}

interface LiveResponse {
  enabled?: boolean;
  message?: string;
  error?: string;
  model?: string;
  latencyMs?: number;
  people?: LivePerson[];
}

interface Track {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  lastSeen: number;
  label: LivePerson | null;
  labelAt: number; // when the last label attempt finished (0 = never)
  pending: boolean;
}

interface Totals {
  labels: number; // label responses received
  sightings: number; // responses with a described person
  outer: number;
  bag: number;
  backpack: number;
}

// Minimal shape of the coco-ssd model (loaded lazily).
interface Detector {
  detect(input: HTMLVideoElement): Promise<{ bbox: [number, number, number, number]; class: string; score: number }[]>;
}

const ZERO: Totals = { labels: 0, sightings: 0, outer: 0, bag: 0, backpack: 0 };
const hasOuter = (o: string) => !/^(none|unclear|)$/i.test(o.trim());
const pct = (n: number, d: number) => (d ? `${Math.round((n / d) * 100)}%` : "-");

function iou(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
  const x1 = Math.max(a.x, b.x);
  const y1 = Math.max(a.y, b.y);
  const x2 = Math.min(a.x + a.w, b.x + b.w);
  const y2 = Math.min(a.y + a.h, b.y + b.h);
  const inter = Math.max(0, x2 - x1) * Math.max(0, y2 - y1);
  const uni = a.w * a.h + b.w * b.h - inter;
  return uni > 0 ? inter / uni : 0;
}

function labelLines(t: Track, keyMissing: boolean): string[] {
  const lines = [`${t.id} · ${t.label ? t.label.top : keyMissing ? "needs W&B key" : "labelling…"}`];
  if (t.label) {
    if (t.label.bottom && t.label.bottom !== "unclear") lines.push(t.label.bottom);
    if (t.label.carry.length) lines.push(`carry: ${t.label.carry.join(", ")}`);
  }
  return lines;
}

/** Draws green boxes + multi-line labels. Shared by the on-screen overlay and the recording canvas. */
function drawTracks(ctx: CanvasRenderingContext2D, tracks: Iterable<Track>, w: number, keyMissing: boolean) {
  const fs = Math.max(11, Math.round(w / 55));
  ctx.font = `${fs}px ui-monospace, monospace`;
  ctx.textBaseline = "top";
  ctx.lineWidth = Math.max(2, Math.round(w / 400));
  for (const t of tracks) {
    ctx.strokeStyle = "rgba(52,211,153,0.95)";
    ctx.strokeRect(t.x, t.y, t.w, t.h);
    const lines = labelLines(t, keyMissing);
    const tw = Math.max(...lines.map((l) => ctx.measureText(l).width)) + 8;
    const th = lines.length * (fs + 2) + 4;
    const ly = t.y - th >= 0 ? t.y - th : t.y;
    const lx = Math.min(t.x, Math.max(0, w - tw));
    ctx.fillStyle = "rgba(16,185,129,0.92)";
    ctx.fillRect(lx, ly, tw, th);
    ctx.fillStyle = "#020617";
    lines.forEach((l, i) => ctx.fillText(l, lx + 4, ly + 2 + i * (fs + 2)));
  }
}

export default function LiveCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<Detector | null>(null);
  const tracksRef = useRef<Map<string, Track>>(new Map());
  const nextId = useRef(1);
  const inFlight = useRef(0);
  const keyMissing = useRef(false);
  const labelTimes = useRef<number[]>([]);
  const detTimes = useRef<number[]>([]);
  const lastMeta = useRef<{ model: string; latencyMs: number; at: number } | null>(null);
  const recRef = useRef<{ rec: MediaRecorder; chunks: Blob[]; raf: number; mime: string } | null>(null);

  const [on, setOn] = useState(false);
  const [starting, setStarting] = useState(false);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detName, setDetName] = useState("loading detector");
  const [disabledMsg, setDisabledMsg] = useState<string | null>(null);
  const [cards, setCards] = useState<Track[]>([]);
  const [totals, setTotals] = useState<Totals>(ZERO);
  const [stats, setStats] = useState({ fps: 0, lps: 0, tracks: 0, model: "", latencyMs: 0, ago: null as number | null });

  const downloadAndClearRecording = useCallback(() => {
    const r = recRef.current;
    if (!r) return;
    recRef.current = null;
    cancelAnimationFrame(r.raf);
    r.rec.onstop = () => {
      if (r.chunks.length === 0) return;
      const blob = new Blob(r.chunks, { type: r.mime || "video/webm" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `auraafit-live-${new Date().toISOString().replace(/[:.]/g, "-")}.webm`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
    };
    try {
      if (r.rec.state !== "inactive") r.rec.stop();
    } catch {
      /* already stopped */
    }
    setRecording(false);
  }, []);

  const stop = useCallback(() => {
    downloadAndClearRecording();
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    tracksRef.current.clear();
    setCards([]);
    setOn(false);
  }, [downloadAndClearRecording]);

  useEffect(() => stop, [stop]);

  const start = async () => {
    setError(null);
    setDisabledMsg(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setError("This browser cannot access a camera (needs https or localhost).");
      return;
    }
    setStarting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      streamRef.current = stream;
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError" || name === "SecurityError"
          ? "Camera permission was denied. Allow camera access in the browser and try again."
          : name === "NotFoundError"
            ? "No camera found on this device."
            : "Could not start the camera.",
      );
      setStarting(false);
      return;
    }
    tracksRef.current.clear();
    nextId.current = 1;
    keyMissing.current = false;
    labelTimes.current = [];
    detTimes.current = [];
    lastMeta.current = null;
    inFlight.current = 0;
    setTotals(ZERO);
    setOn(true);
    // Lazy-load the on-device detector only now (keeps SSR/build free of TensorFlow).
    try {
      if (!detectorRef.current) {
        try {
          // Primary: YOLO11n on-device (ONNX Runtime Web), same YOLO11 family as the event's detector.
          const y = await import("@/lib/yoloWeb");
          await y.loadYolo("/models/yolo11n.onnx");
          detectorRef.current = {
            detect: async (v: HTMLVideoElement) =>
              (await y.detectPeople(v, MIN_SCORE)).map((b) => ({ bbox: [b.x, b.y, b.w, b.h] as [number, number, number, number], class: "person", score: b.score })),
          };
          setDetName("YOLO11n (on-device, ONNX Runtime Web)");
        } catch {
          // Fallback: TensorFlow.js COCO-SSD.
          const tf = await import("@tensorflow/tfjs");
          const coco = await import("@tensorflow-models/coco-ssd");
          await tf.ready();
          detectorRef.current = (await coco.load({ base: "lite_mobilenet_v2" })) as unknown as Detector;
          setDetName("COCO-SSD (on-device, TensorFlow.js fallback)");
        }
      }
    } catch {
      setError("Could not load the on-device person detector (TensorFlow.js). The camera preview works, but there are no boxes.");
    } finally {
      setStarting(false);
    }
  };

  // Attach the stream once the <video> is mounted.
  useEffect(() => {
    if (on && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current;
      videoRef.current.play().catch(() => undefined);
    }
  }, [on]);

  // Detection + tracking + overlay drawing (animation-frame loop).
  useEffect(() => {
    if (!on) return;
    let raf = 0;
    let busy = false;
    let alive = true;

    const frame = async () => {
      if (!alive) return;
      raf = requestAnimationFrame(frame);
      const video = videoRef.current;
      const overlay = overlayRef.current;
      if (!video || !overlay || video.videoWidth === 0) return;
      if (overlay.width !== video.videoWidth || overlay.height !== video.videoHeight) {
        overlay.width = video.videoWidth;
        overlay.height = video.videoHeight;
      }
      const ctx = overlay.getContext("2d");
      if (ctx) {
        ctx.clearRect(0, 0, overlay.width, overlay.height);
        drawTracks(ctx, tracksRef.current.values(), overlay.width, keyMissing.current);
      }
      const det = detectorRef.current;
      if (!det || busy) return;
      busy = true;
      try {
        const preds = await det.detect(video);
        const nowMs = performance.now();
        detTimes.current.push(nowMs);
        const persons = preds
          .filter((p) => p.class === "person" && p.score >= MIN_SCORE)
          .map((p) => ({ x: p.bbox[0], y: p.bbox[1], w: p.bbox[2], h: p.bbox[3] }));
        const tracks = tracksRef.current;
        // Greedy IoU matching, best pairs first.
        const pairs: { id: string; di: number; v: number }[] = [];
        tracks.forEach((t) => persons.forEach((d, di) => {
          const v = iou(t, d);
          if (v >= IOU_MATCH) pairs.push({ id: t.id, di, v });
        }));
        pairs.sort((a, b) => b.v - a.v);
        const usedT = new Set<string>();
        const usedD = new Set<number>();
        for (const pr of pairs) {
          if (usedT.has(pr.id) || usedD.has(pr.di)) continue;
          usedT.add(pr.id);
          usedD.add(pr.di);
          const t = tracks.get(pr.id)!;
          const d = persons[pr.di];
          Object.assign(t, { x: d.x, y: d.y, w: d.w, h: d.h, lastSeen: nowMs });
        }
        persons.forEach((d, di) => {
          if (usedD.has(di)) return;
          const id = `L${String(nextId.current++).padStart(2, "0")}`;
          tracks.set(id, { id, ...d, lastSeen: nowMs, label: null, labelAt: 0, pending: false });
        });
        tracks.forEach((t, id) => {
          if (nowMs - t.lastSeen > DROP_MS) tracks.delete(id);
        });
      } catch {
        /* skip this frame */
      } finally {
        busy = false;
      }
    };
    raf = requestAnimationFrame(frame);
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
    };
  }, [on]);

  // Per-track outfit labelling via W&B (1 s cadence, max 2 in flight).
  useEffect(() => {
    if (!on) return;
    const sendCrop = async (t: Track, video: HTMLVideoElement) => {
      const padX = t.w * CROP_PAD;
      const padY = t.h * CROP_PAD;
      const sx = Math.max(0, t.x - padX);
      const sy = Math.max(0, t.y - padY);
      const sw = Math.min(video.videoWidth - sx, t.w + 2 * padX);
      const sh = Math.min(video.videoHeight - sy, t.h + 2 * padY);
      if (sw < MIN_CROP_SIDE || sh < MIN_CROP_SIDE) return;
      const scale = Math.min(1, CROP_MAX_SIDE / Math.max(sw, sh));
      const c = document.createElement("canvas");
      c.width = Math.max(1, Math.round(sw * scale));
      c.height = Math.max(1, Math.round(sh * scale));
      c.getContext("2d")?.drawImage(video, sx, sy, sw, sh, 0, 0, c.width, c.height);
      const image = c.toDataURL("image/jpeg", 0.85);
      t.pending = true;
      inFlight.current += 1;
      try {
        const res = await fetch("/api/live", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ image, single: true }),
        });
        const j = (await res.json().catch(() => ({}))) as LiveResponse;
        if (!streamRef.current) return;
        if (j.enabled === false) {
          keyMissing.current = true;
          setDisabledMsg(j.message ?? "Live labels are not enabled on the server.");
          return;
        }
        if (!res.ok || j.error || !j.people) {
          setError(j.error ?? `Label request failed (${res.status}).`);
          return;
        }
        setError(null);
        const nowMs = performance.now();
        labelTimes.current.push(nowMs);
        lastMeta.current = { model: j.model ?? "", latencyMs: j.latencyMs ?? 0, at: nowMs };
        const p = j.people[0];
        if (p) t.label = p;
        setTotals((s) => ({
          labels: s.labels + 1,
          sightings: s.sightings + (p ? 1 : 0),
          outer: s.outer + (p && hasOuter(p.outer) ? 1 : 0),
          bag: s.bag + (p && p.carry.some((x) => /bag|purse|tote|satchel/i.test(x)) ? 1 : 0),
          backpack: s.backpack + (p && p.carry.some((x) => /backpack|rucksack/i.test(x)) ? 1 : 0),
        }));
      } catch {
        setError("Could not reach /api/live.");
      } finally {
        t.pending = false;
        t.labelAt = performance.now();
        inFlight.current -= 1;
      }
    };

    const tick = () => {
      const video = videoRef.current;
      if (!video || video.videoWidth === 0 || keyMissing.current) return;
      if (inFlight.current >= MAX_IN_FLIGHT) return;
      const nowMs = performance.now();
      const cands = [...tracksRef.current.values()]
        .filter((t) => !t.pending && (t.labelAt === 0 || nowMs - t.labelAt > LABEL_STALE_MS))
        .sort((a, b) => Number(a.label !== null) - Number(b.label !== null) || b.w * b.h - a.w * a.h)
        .slice(0, MAX_PER_TICK);
      for (const t of cands) {
        if (inFlight.current >= MAX_IN_FLIGHT) break;
        void sendCrop(t, video);
      }
    };
    const id = setInterval(tick, LABEL_TICK_MS);
    return () => clearInterval(id);
  }, [on]);

  // UI refresh (cards + stats) a few times per second, independent of the draw loop.
  useEffect(() => {
    if (!on) return;
    const id = setInterval(() => {
      const nowMs = performance.now();
      detTimes.current = detTimes.current.filter((t) => nowMs - t < RATE_WINDOW_MS);
      labelTimes.current = labelTimes.current.filter((t) => nowMs - t < RATE_WINDOW_MS);
      const span = Math.max(1, Math.min(RATE_WINDOW_MS, nowMs - (detTimes.current[0] ?? nowMs)) / 1000);
      const m = lastMeta.current;
      setStats({
        fps: detTimes.current.length / span,
        lps: labelTimes.current.length / (RATE_WINDOW_MS / 1000),
        tracks: tracksRef.current.size,
        model: m?.model ?? "",
        latencyMs: m?.latencyMs ?? 0,
        ago: m ? Math.max(0, Math.round((nowMs - m.at) / 1000)) : null,
      });
      setCards([...tracksRef.current.values()].map((t) => ({ ...t })));
    }, 500);
    return () => clearInterval(id);
  }, [on]);

  const startRecording = () => {
    const video = videoRef.current;
    if (!video || video.videoWidth === 0 || recRef.current) return;
    if (typeof MediaRecorder === "undefined") {
      setError("This browser cannot record video (MediaRecorder is missing).");
      return;
    }
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const mime = ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"].find((m) => MediaRecorder.isTypeSupported(m)) ?? "";
    let rec: MediaRecorder;
    try {
      rec = new MediaRecorder(canvas.captureStream(15), mime ? { mimeType: mime } : undefined);
    } catch {
      setError("Could not start recording in this browser.");
      return;
    }
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.push(e.data);
    };
    const entry = { rec, chunks, raf: 0, mime };
    const draw = () => {
      const v = videoRef.current;
      if (v && v.videoWidth > 0) {
        ctx.drawImage(v, 0, 0, canvas.width, canvas.height);
        drawTracks(ctx, tracksRef.current.values(), canvas.width, keyMissing.current);
      }
      entry.raf = requestAnimationFrame(draw);
    };
    recRef.current = entry;
    rec.start(1000);
    draw();
    setRecording(true);
  };

  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <Camera className="h-4 w-4 text-brand" /> Live camera (W&amp;B vision, near-real-time)
      </h3>
      <p className="mb-2 text-xs leading-relaxed text-neutral-600">
        Point a camera at people who agreed to it. Person crops (about one per second) are sent to W&amp;B Inference; nothing is stored. Clothing and carried items only; age, gender and identity are not inferred.
      </p>
      <p className="mb-3 text-xs leading-relaxed text-neutral-600">
        Live boxes: {detName}, running on this device. The event&apos;s server-side YOLO11s/Cosmos are only reachable inside the lab network, so the live mode uses YOLO11n in the browser. Outfit labels: W&amp;B Inference vision.
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {!on ? (
          <button
            type="button"
            onClick={start}
            disabled={starting}
            className="flex items-center gap-1.5 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
          >
            {starting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Camera className="h-3 w-3" />} Start camera
          </button>
        ) : (
          <>
            <button
              type="button"
              onClick={stop}
              className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
            >
              <CameraOff className="h-3 w-3" /> Stop
            </button>
            {!recording ? (
              <button
                type="button"
                onClick={startRecording}
                className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-medium text-neutral-800 hover:bg-neutral-50"
              >
                <Circle className="h-3 w-3 fill-red-500 text-red-500" /> Record
              </button>
            ) : (
              <button
                type="button"
                onClick={downloadAndClearRecording}
                className="flex items-center gap-1.5 rounded-full bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700"
              >
                <Square className="h-3 w-3 fill-white" /> Stop recording
              </button>
            )}
            {recording && <span className="flex items-center gap-1 font-mono text-[11px] font-semibold text-red-600"><span className="h-2 w-2 animate-pulse rounded-full bg-red-600" /> REC</span>}
            {starting && <span className="flex items-center gap-1 font-mono text-[11px] text-neutral-600"><Loader2 className="h-3 w-3 animate-spin" /> loading detector…</span>}
          </>
        )}
      </div>

      {error && <div className="mb-3 rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</div>}
      {disabledMsg && <div className="mb-3 rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">{disabledMsg} Boxes, tracking and recording still work.</div>}

      {on && (
        <div className="grid gap-3 lg:grid-cols-2">
          <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
            <video ref={videoRef} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-contain" />
            <canvas ref={overlayRef} className="pointer-events-none absolute inset-0 h-full w-full object-contain" />
            <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-200">
              <span className="h-2 w-2 rounded-full bg-red-500" /> LIVE · {detName.split(" (")[0]} boxes · W&amp;B labels
            </div>
            <div className="absolute bottom-3 left-3 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-emerald-400">
              detector {stats.fps.toFixed(1)} fps · {stats.tracks} tracked
            </div>
          </div>

          <div className="space-y-2">
            <div className="font-mono text-[11px] text-neutral-600">
              {stats.ago === null
                ? keyMissing.current ? "labels: needs W&B key" : "waiting for first label…"
                : `last label ${stats.ago}s ago · W&B latency ${stats.latencyMs} ms · ${stats.model}`}
              {" · "}
              {stats.lps.toFixed(1)} labels/s
            </div>
            <div className="grid grid-cols-2 gap-2 font-mono text-[11px] text-neutral-700 sm:grid-cols-4">
              <div className="rounded-lg border border-neutral-200 bg-white p-2">labels analysed<b className="block text-sm text-neutral-900">{totals.labels}</b></div>
              <div className="rounded-lg border border-neutral-200 bg-white p-2">outer layer<b className="block text-sm text-neutral-900">{pct(totals.outer, totals.sightings)}</b></div>
              <div className="rounded-lg border border-neutral-200 bg-white p-2">bag<b className="block text-sm text-neutral-900">{pct(totals.bag, totals.sightings)}</b></div>
              <div className="rounded-lg border border-neutral-200 bg-white p-2">backpack<b className="block text-sm text-neutral-900">{pct(totals.backpack, totals.sightings)}</b></div>
            </div>
            <div className="font-mono text-[10px] text-neutral-500">share of {totals.sightings} labelled sightings since start (sightings, not unique people)</div>

            {cards.length === 0 && <div className="rounded-lg border border-neutral-200 bg-white p-3 text-xs text-neutral-500">No person tracked right now.</div>}
            {cards.map((t) => (
              <div key={t.id} className="rounded-lg border border-neutral-200 bg-white p-3 font-mono text-[11px] leading-relaxed text-neutral-600">
                <div className="mb-1 flex justify-between">
                  <span className="font-semibold text-brand">{t.id}</span>
                  <span className="text-neutral-500">{t.label?.motion ?? ""}</span>
                </div>
                {t.label ? (
                  <>
                    <div>top: <b className="text-neutral-900">{t.label.top}</b></div>
                    <div>bottom: <b className="text-neutral-900">{t.label.bottom}</b></div>
                    <div>outer: <b className="text-neutral-900">{t.label.outer}</b></div>
                    <div>carry: <b className="text-neutral-900">{t.label.carry.length ? t.label.carry.join(", ") : "none"}</b></div>
                  </>
                ) : (
                  <div className="text-neutral-500">{keyMissing.current ? "needs W&B key" : "labelling…"}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
