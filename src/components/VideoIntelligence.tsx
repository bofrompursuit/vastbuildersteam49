"use client";

import { useRef, useState } from "react";
import { CheckCircle2, Download, Film, Link2, Loader2, ShoppingBag, Store, UploadCloud, User } from "lucide-react";
import { nameColor, rgbToHex, type AnalysisResult, type Distribution, type PaletteColor, type VideoSource } from "@/lib/analysis";

const STEPS = ["Ingesting video", "Sampling frames", "YOLO subject tracking", "Cosmos attribute extraction", "Aggregating trends", "Generating GTM intelligence"];

/** Sample real frames in the browser and return the dominant colors. Fails soft (CORS, codecs). */
async function sampleVideo(src: string, crossOrigin: boolean): Promise<{ palette?: PaletteColor[]; duration?: number }> {
  const v = document.createElement("video");
  v.muted = true;
  v.preload = "auto";
  if (crossOrigin) v.crossOrigin = "anonymous";
  v.src = src;
  try {
    await new Promise<void>((ok, fail) => {
      v.onloadeddata = () => ok();
      v.onerror = () => fail(new Error("load"));
      setTimeout(() => fail(new Error("timeout")), 8000);
    });
    const duration = isFinite(v.duration) ? v.duration : undefined;
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 36;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const buckets = new Map<number, [number, number, number, number]>();
    for (let i = 1; i <= 8; i++) {
      v.currentTime = ((duration ?? 8) * i) / 9;
      await new Promise((r) => (v.onseeked = r));
      ctx.drawImage(v, 0, 0, 64, 36);
      const px = ctx.getImageData(0, 0, 64, 36).data; // throws if canvas is tainted
      for (let p = 0; p < px.length; p += 4) {
        const key = ((px[p] >> 5) << 6) | ((px[p + 1] >> 5) << 3) | (px[p + 2] >> 5);
        const b = buckets.get(key) ?? [0, 0, 0, 0];
        buckets.set(key, [b[0] + px[p], b[1] + px[p + 1], b[2] + px[p + 2], b[3] + 1]);
      }
    }
    const total = [...buckets.values()].reduce((s, b) => s + b[3], 0);
    const palette = [...buckets.values()]
      .sort((a, b) => b[3] - a[3])
      .slice(0, 8)
      .map(([r, g, b, n]) => {
        const h = rgbToHex(Math.round(r / n), Math.round(g / n), Math.round(b / n));
        return { hex: h, ...nameColor(h), share: n / total };
      });
    return { palette, duration };
  } catch {
    return {};
  } finally {
    v.removeAttribute("src");
    v.load();
  }
}

function Bars({ title, data, unit = "%" }: { title: string; data: Distribution[]; unit?: string }) {
  return (
    <div className="rounded-2xl border border-neutral-200 bg-white p-4">
      <h4 className="mb-3 font-mono text-[11px] uppercase tracking-wider text-neutral-500">{title}</h4>
      <div className="space-y-2">
        {data.slice(0, 6).map((d) => (
          <div key={d.label} className="text-xs">
            <div className="mb-1 flex justify-between text-neutral-700">
              <span className="flex items-center gap-1.5">
                {d.hex && <span className="h-2.5 w-2.5 rounded-sm border border-neutral-300" style={{ background: d.hex }} />}
                {d.label}
              </span>
              <span className="font-mono text-neutral-500">{d.pct}{unit}</span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-100">
              <div className="h-1.5 rounded-full bg-brand" style={{ width: `${Math.max(d.pct, 2)}%`, background: d.hex }} />
            </div>
          </div>
        ))}
        {data.length === 0 && <p className="text-xs text-neutral-400">None detected</p>}
      </div>
    </div>
  );
}

export default function VideoIntelligence() {
  const [url, setUrl] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [step, setStep] = useState(-1);
  const [error, setError] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const busy = step >= 0 && step < STEPS.length;

  async function run(kind: "upload" | "url") {
    if (kind === "upload" && !file) return;
    if (kind === "url" && !url.trim()) return;
    setError("");
    setResult(null);
    setStep(0);
    const tick = () => setStep((s) => Math.min(s + 1, STEPS.length - 1));
    try {
      const objectUrl = kind === "upload" ? URL.createObjectURL(file!) : url.trim();
      tick();
      const sampled = await sampleVideo(objectUrl, kind === "url");
      if (kind === "upload") URL.revokeObjectURL(objectUrl);
      tick();
      const timer = setInterval(tick, 450);
      const source: VideoSource = {
        kind,
        name: kind === "upload" ? file!.name : url.trim(),
        sizeBytes: file?.size,
        durationSec: sampled.duration,
        sampledPalette: sampled.palette,
      };
      const res = await fetch("/api/analyze", { method: "POST", body: JSON.stringify(source) });
      clearInterval(timer);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setResult(data as AnalysisResult);
      setStep(STEPS.length);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setStep(-1);
    }
  }

  async function exportCsv() {
    if (!result) return;
    const res = await fetch("/api/analyze/csv", { method: "POST", body: JSON.stringify({ tracks: result.tracks, source: result.source }) });
    const blob = await res.blob();
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `aurafit-video-features-${result.jobId}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const pickFile = (f?: File | null) => f && f.type.startsWith("video/") ? (setFile(f), setError("")) : f && setError("Please choose a video file");

  return (
    <div id="video-intel" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
      <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <Film className="h-4 w-4 text-brand" /> Video Feature Extraction &amp; Business Intelligence
      </h3>
      <p className="mb-4 text-xs text-neutral-500">Upload footage or paste a link — extract color palettes, accessories and physique estimates, then generate GTM and shopper insights.</p>

      <div className="grid gap-3 sm:grid-cols-2">
        <div
          onDragOver={(e) => (e.preventDefault(), setDragging(true))}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => (e.preventDefault(), setDragging(false), pickFile(e.dataTransfer.files[0]))}
          onClick={() => inputRef.current?.click()}
          className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border-2 border-dashed p-4 text-center text-xs transition ${dragging ? "border-brand bg-brand/5" : "border-neutral-300 bg-white hover:border-brand"}`}
        >
          <UploadCloud className="h-6 w-6 text-brand" />
          <span className="font-medium text-neutral-800">{file ? file.name : "Drop a video or click to browse"}</span>
          <span className="text-neutral-500">{file ? `${(file.size / 1e6).toFixed(1)} MB` : "MP4, MOV, WebM"}</span>
          <input ref={inputRef} type="file" accept="video/*" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          {file && (
            <button
              onClick={(e) => (e.stopPropagation(), run("upload"))}
              disabled={busy}
              className="mt-2 rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              Analyze upload
            </button>
          )}
        </div>
        <form onSubmit={(e) => (e.preventDefault(), run("url"))} className="flex flex-col justify-center gap-2 rounded-2xl border border-neutral-200 bg-white p-4">
          <label className="flex items-center gap-1.5 text-xs font-medium text-neutral-800"><Link2 className="h-3.5 w-3.5 text-brand" /> Video URL</label>
          <input
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…/footage.mp4"
            className="rounded-full border border-neutral-300 px-3 py-1.5 text-xs outline-none focus:border-brand"
          />
          <button disabled={busy || !url.trim()} className="rounded-full bg-brand px-4 py-1.5 text-xs font-medium text-white hover:bg-brand-dark disabled:opacity-60">
            Analyze URL
          </button>
        </form>
      </div>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

      {step >= 0 && (
        <ol className="mt-4 grid gap-1.5 sm:grid-cols-3">
          {STEPS.map((s, i) => (
            <li key={s} className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-[11px] ${i < step || step === STEPS.length ? "bg-brand/10 text-brand" : i === step ? "bg-white text-neutral-800" : "text-neutral-400"}`}>
              {i < step || step === STEPS.length ? <CheckCircle2 className="h-3.5 w-3.5" /> : i === step ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <span className="h-3.5 w-3.5 rounded-full border border-neutral-300" />}
              {s}
            </li>
          ))}
        </ol>
      )}

      {result && (
        <div className="mt-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="font-mono text-[11px] text-neutral-500">
              {result.jobId} · {result.aggregates.totalTracks} tracks · avg height {result.aggregates.avgHeightCm} cm
              {result.source.sampledPalette?.length ? " · palette from real frames" : " · palette estimated"}
            </p>
            <button onClick={exportCsv} className="flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-medium text-neutral-800 hover:border-brand hover:text-brand">
              <Download className="h-3.5 w-3.5" /> Export CSV
            </button>
          </div>

          {result.source.sampledPalette?.length ? (
            <div className="flex h-8 overflow-hidden rounded-full border border-neutral-200">
              {result.source.sampledPalette.map((c) => (
                <div key={c.hex} title={`${c.name} · ${c.shade} · ${c.hex}`} style={{ background: c.hex, flex: c.share }} />
              ))}
            </div>
          ) : null}

          <div className="grid gap-3 sm:grid-cols-3">
            <Bars title="Dominant colors" data={result.aggregates.colors} />
            <Bars title="Accessory prevalence" data={result.aggregates.accessories} />
            <Bars title="Fit / physique" data={result.aggregates.physiques} />
          </div>

          <div className="max-h-56 overflow-auto rounded-2xl border border-neutral-200 bg-white">
            <table className="w-full text-left font-mono text-[11px]">
              <thead className="sticky top-0 bg-white text-neutral-500">
                <tr>{["Track", "t (s)", "Colors", "Accessories", "Height", "Physique", "Conf."].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr>
              </thead>
              <tbody className="text-neutral-700">
                {result.tracks.map((t) => (
                  <tr key={t.trackId} className="border-t border-neutral-100">
                    <td className="px-3 py-1.5 text-brand">{t.trackId}</td>
                    <td className="px-3 py-1.5">{t.timestampSec}</td>
                    <td className="px-3 py-1.5">
                      <span className="flex items-center gap-1">
                        <span className="h-2.5 w-2.5 rounded-sm border border-neutral-300" style={{ background: t.primaryHex }} />
                        <span className="h-2.5 w-2.5 rounded-sm border border-neutral-300" style={{ background: t.secondaryHex }} />
                        {t.primaryShade} {t.primaryColor}
                      </span>
                    </td>
                    <td className="px-3 py-1.5">{t.accessories.join(", ") || "—"}</td>
                    <td className="px-3 py-1.5">{t.heightCm} cm / {t.heightIn}″</td>
                    <td className="px-3 py-1.5">{t.physique}</td>
                    <td className="px-3 py-1.5">{(t.detectionConfidence * 100).toFixed(0)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-neutral-200 bg-white p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><Store className="h-4 w-4 text-brand" /> B2B · Brands &amp; Retailers</h4>
              <ul className="space-y-3">
                {result.recommendations.b2b.map((r) => (
                  <li key={r.title} className="text-xs">
                    <span className="mr-1.5 rounded-full bg-brand/10 px-2 py-0.5 font-mono text-[10px] text-brand">{r.tag}</span>
                    <b className="text-neutral-900">{r.title}</b>
                    <p className="mt-1 text-neutral-600">{r.detail}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-orange-200 bg-gradient-to-br from-orange-50 to-white p-4">
              <h4 className="mb-3 flex items-center gap-1.5 text-sm font-semibold text-neutral-900"><User className="h-4 w-4 text-orange-600" /> B2C · Shoppers</h4>
              <ul className="space-y-3">
                {result.recommendations.b2c.map((r) => (
                  <li key={r.title} className="text-xs">
                    <b className="flex items-center gap-1.5 text-neutral-900"><ShoppingBag className="h-3.5 w-3.5 text-orange-600" />{r.title}</b>
                    <p className="mt-1 text-neutral-600">{r.detail}</p>
                    {r.swatches && (
                      <div className="mt-1.5 flex gap-1">
                        {r.swatches.map((s) => <span key={s} className="h-5 w-5 rounded-full border border-neutral-200" style={{ background: s }} />)}
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
