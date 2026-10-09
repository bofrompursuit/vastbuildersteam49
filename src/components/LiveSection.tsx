"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Clock, Loader2, MonitorPlay, Search, Sparkles, Video, Zap } from "lucide-react";
import { agentAlerts, generateDetection } from "@/lib/engine";
import type { AgentAlert, DetectionPayload, SamplingRate, SearchResult } from "@/lib/types";

const TICK_MS = 80;

interface Track extends DetectionPayload {
  speed: number;
}

function VideoFeed({ tracks, clock }: { tracks: Track[]; clock: string }) {
  return (
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
      {/* storefront scene */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-800 via-slate-900 to-slate-950" />
      <div className="absolute inset-x-0 bottom-0 h-[38%] bg-[repeating-linear-gradient(90deg,#1e293b_0_2px,transparent_2px_60px)] opacity-60" />
      <div className="absolute left-[38%] top-[10%] h-[62%] w-[24%] rounded-t-md border-4 border-slate-700 bg-slate-950/70">
        <div className="mt-2 text-center font-mono text-[10px] tracking-widest text-emerald-400/70">ENTRANCE</div>
      </div>
      <div className="absolute left-[6%] top-[14%] h-[40%] w-[26%] border-2 border-slate-700 bg-sky-950/30" />
      <div className="absolute right-[6%] top-[14%] h-[40%] w-[26%] border-2 border-slate-700 bg-sky-950/30" />
      <div className="pointer-events-none absolute inset-0 bg-[repeating-linear-gradient(0deg,rgba(255,255,255,0.03)_0_1px,transparent_1px_3px)]" />

      {tracks.map((t) => (
        <div
          key={t.trackingId}
          className="absolute"
          style={{ left: `${t.bbox.x}%`, top: `${t.bbox.y}%`, width: `${t.bbox.w}%`, height: `${t.bbox.h}%` }}
        >
          {/* shopper silhouette */}
          <div className="absolute left-1/2 top-[4%] h-[16%] w-[42%] -translate-x-1/2 rounded-full bg-slate-400/80" />
          <div className="absolute left-[18%] top-[20%] h-[42%] w-[64%] rounded-t-lg" style={{ background: t.outfit.primaryHex }} />
          <div className="absolute left-[26%] top-[62%] h-[36%] w-[48%]" style={{ background: t.outfit.secondaryHex }} />
          {/* YOLO box */}
          <div className="absolute inset-0 border-2 border-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.5)]" />
          <div className="absolute bottom-full left-0 mb-1 whitespace-nowrap rounded bg-emerald-400 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-950 sm:text-[10px]">
            #{t.trackingId} | {t.outfit.garmentCategory}: {t.outfit.primaryGarment} | Est. Age: {t.demographics.ageBracket}
          </div>
        </div>
      ))}

      <div className="absolute left-3 top-3 flex items-center gap-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-200">
        <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" /> REC · CAM-01 ENTRANCE
      </div>
      <div className="absolute right-3 top-3 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-300">{clock}</div>
      <div className="absolute bottom-3 left-3 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-emerald-400">
        YOLOv8 · {tracks.length} active tracks
      </div>
    </div>
  );
}

function DetectionCard({ d }: { d: DetectionPayload }) {
  return (
    <div className="animate-[fadeIn_0.4s_ease-out] rounded-lg border border-neutral-200 bg-white p-3 font-mono text-[11px] leading-relaxed">
      <div className="mb-1 flex justify-between">
        <span className="font-semibold text-brand">#{d.trackingId}</span>
        <span className="text-neutral-500">{new Date(d.timestamp).toLocaleTimeString()} · conf {d.confidence}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-neutral-600">
        <span>age: <b className="text-neutral-900">{d.demographics.ageBracket}</b></span>
        <span>gender: <b className="text-neutral-900">{d.demographics.genderPresentation}</b></span>
        <span>height: <b className="text-neutral-900">{d.demographics.heightCm}cm</b></span>
        <span>fit: <b className="text-neutral-900">{d.demographics.fitSize}</b></span>
      </div>
      <div className="mt-1 text-neutral-600">
        outfit: <b className="text-neutral-900">{d.outfit.primaryGarment}</b>
      </div>
      <div className="flex flex-wrap items-center gap-2 text-neutral-600">
        <span className="inline-block h-3 w-3 rounded-sm border border-slate-600" style={{ background: d.outfit.primaryHex }} />
        {d.outfit.primaryColor}
        <span className="inline-block h-3 w-3 rounded-sm border border-slate-600" style={{ background: d.outfit.secondaryHex }} />
        {d.outfit.secondaryColor}
        <span className="rounded bg-brand/10 px-1.5 text-brand">{d.outfit.aesthetic}</span>
      </div>
      <div className="mt-1.5 border-t border-neutral-200 pt-1.5 text-sky-700">
        ↳ rec: {d.recommendation.name} ({d.recommendation.sku}, ${d.recommendation.priceUsd}) · {(d.recommendation.matchScore * 100).toFixed(0)}%
      </div>
    </div>
  );
}

function SemanticSearch() {
  const [query, setQuery] = useState("Show shoppers under 30 wearing navy puffer jackets between 2 PM and 4 PM.");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/search", { method: "POST", body: JSON.stringify({ query }) });
      const data = (await res.json()) as { results: SearchResult[] };
      setResults(data.results ?? []);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="search" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <Search className="h-4 w-4 text-brand" /> Semantic Footage Search
        <span className="text-xs font-normal text-neutral-500">· vector search over temporal embeddings</span>
      </h3>
      <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 outline-none focus:border-brand"
          placeholder="Describe who or what you're looking for…"
        />
        <button className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Search
        </button>
      </form>
      {results.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {results.map((r) => (
            <button key={r.clipId} className="group overflow-hidden rounded-lg border border-neutral-200 bg-white text-left hover:border-brand">
              <div
                className="relative flex aspect-video items-center justify-center"
                style={{ background: `linear-gradient(135deg, hsl(${r.thumbHue} 40% 18%), hsl(${r.thumbHue} 30% 8%))` }}
              >
                <MonitorPlay className="h-8 w-8 text-neutral-500 transition group-hover:scale-110 group-hover:text-brand" />
                <span className="absolute right-2 top-2 rounded bg-brand px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {r.matchConfidence}% Match
                </span>
              </div>
              <div className="p-2 text-xs">
                <div className="font-medium text-neutral-800">{r.description}</div>
                <div className="mt-0.5 flex items-center gap-1 text-neutral-500">
                  <Video className="h-3 w-3" /> {r.camera} <Clock className="ml-1 h-3 w-3" /> {r.timeRange}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentPanel({ alerts }: { alerts: AgentAlert[] }) {
  const [status, setStatus] = useState<"idle" | "pushing" | "done">("idle");
  const [pushedAt, setPushedAt] = useState("");

  async function trigger() {
    setStatus("pushing");
    const res = await fetch("/api/signage", { method: "POST", body: JSON.stringify({ campaign: "Winter Outerwear Collection" }) });
    const data = (await res.json()) as { pushedAt: string };
    setPushedAt(new Date(data.pushedAt).toLocaleTimeString());
    setStatus("done");
  }

  const tone = { info: "border-sky-200 text-sky-700", action: "border-brand/30 text-brand", critical: "border-amber-300 text-amber-700" };

  return (
    <div id="agent" className="scroll-mt-24 rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <Bot className="h-4 w-4 text-brand" /> AI Merchandising Agent
        <span className="text-xs font-normal text-neutral-500">· W&amp;B managed LLM</span>
      </h3>
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className={`rounded-lg border bg-white p-3 text-xs ${tone[a.severity]}`}>
            <div className="text-neutral-800"><b className="uppercase">Alert:</b> {a.insight}</div>
            <div className="mt-1"><b>Action:</b> {a.action}</div>
          </div>
        ))}
      </div>
      <button
        onClick={trigger}
        disabled={status === "pushing"}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "pushing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        Trigger Dynamic Signage Update
      </button>
      {status === "done" && <p className="mt-2 text-center text-xs text-brand">✓ ENTRANCE-DISPLAY-01 now showing Winter Outerwear Collection ({pushedAt})</p>}
    </div>
  );
}

export default function LiveSection({ samplingRate }: { samplingRate: SamplingRate }) {
  const [tracks, setTracks] = useState<Track[]>([]);
  const [feed, setFeed] = useState<DetectionPayload[]>([]);
  const [clock, setClock] = useState("");
  const feedRef = useRef<HTMLDivElement>(null);

  // move tracked shoppers across the frame
  useEffect(() => {
    const id = setInterval(() => {
      setTracks((ts) =>
        ts
          .map((t) => ({ ...t, bbox: { ...t.bbox, x: t.bbox.x + t.speed } }))
          .filter((t) => t.bbox.x < 105),
      );
      setClock(new Date().toLocaleString());
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  // spawn detections; higher Cosmos sampling rate = faster enrichment
  useEffect(() => {
    const spawn = () => {
      const d = generateDetection();
      setTracks((ts) => [...ts.slice(-5), { ...d, speed: 0.25 + Math.random() * 0.25 }]);
      setFeed((f) => [d, ...f].slice(0, 40));
    };
    spawn();
    const id = setInterval(spawn, { 1: 3600, 5: 2200, 15: 1200 }[samplingRate]);
    return () => clearInterval(id);
  }, [samplingRate]);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [feed]);

  const alerts = useMemo(() => agentAlerts(feed.slice(0, 20)), [feed]);

  return (
    <section id="live" className="scroll-mt-24 space-y-6">
      <div className="grid gap-6 lg:grid-cols-5">
        <div className="space-y-6 lg:col-span-3">
          <VideoFeed tracks={tracks} clock={clock} />
          <SemanticSearch />
        </div>
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
            <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-900">
              Live Demographic &amp; Outfit Extraction Feed
              <span className="font-mono text-xs font-normal text-brand">{samplingRate} FPS</span>
            </h3>
            <div ref={feedRef} className="h-[360px] space-y-2 overflow-y-auto pr-1">
              {feed.map((d) => <DetectionCard key={d.trackingId} d={d} />)}
            </div>
          </div>
          <AgentPanel alerts={alerts} />
        </div>
      </div>
    </section>
  );
}
