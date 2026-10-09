"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Bot, Clock, ExternalLink, Loader2, MonitorPlay, Search, Sparkles, Video, Zap } from "lucide-react";
import { agentAlerts, fmtClock, searchDetections, toPayload } from "@/lib/engine";
import type { RealClip, RealDataFile, RealDetection } from "@/lib/realTypes";
import VideoIntelligence from "./VideoIntelligence";
import type { AgentAlert, AgentResponse, DetectionPayload, SamplingRate, SearchResult } from "@/lib/types";

/** Boxes without a recorded path stay on screen this many replay-seconds after their label time. */
const BOX_HOLD_SEC = 1.0;
/** Path boxes show from PATH_LEAD_SEC before the first sample to PATH_TAIL_SEC after the last. */
const PATH_LEAD_SEC = 0.1;
const PATH_TAIL_SEC = 0.2;
const FEED_MAX = 40;

interface VisibleBox {
  key: string;
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

interface ReplayState {
  clip: RealClip | null;
  t: number; // seconds into the current clip (the video's clock when a video is playing)
  pass: number; // how many full passes through all clips
  visible: VisibleBox[];
  token: string; // identifies the current playthrough of a clip (remounts the <video>)
}

interface FeedItem {
  key: string;
  d: DetectionPayload;
}

interface PreDet {
  d: RealDetection;
  key: string;
  label: string;
  path: [number, number, number, number, number][] | null;
  t0: number; // first time this box can be visible
  t1: number; // last time (exclusive for hold boxes)
}

const clipDuration = (c: RealClip) => (c.durationSec > 0 ? c.durationSec : 30);

function boxesAt(dets: PreDet[], t: number): VisibleBox[] {
  const out: VisibleBox[] = [];
  for (const p of dets) {
    if (p.path) {
      if (t < p.t0 || t > p.t1) continue;
      const path = p.path;
      let lo = 0;
      let hi = path.length - 1;
      if (t <= path[0][0]) hi = 0;
      else if (t >= path[hi][0]) lo = hi;
      else {
        while (hi - lo > 1) {
          const mid = (lo + hi) >> 1;
          if (path[mid][0] <= t) lo = mid;
          else hi = mid;
        }
      }
      const a = path[lo];
      const b = path[hi];
      const f = hi === lo || b[0] === a[0] ? 0 : Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
      out.push({ key: p.key, label: p.label, x: a[1] + (b[1] - a[1]) * f, y: a[2] + (b[2] - a[2]) * f, w: a[3] + (b[3] - a[3]) * f, h: a[4] + (b[4] - a[4]) * f });
    } else if (t >= p.t0 && t < p.t1) {
      const bb = p.d.bbox;
      out.push({ key: p.key, label: p.label, x: bb.x, y: bb.y, w: bb.w, h: bb.h });
    }
  }
  return out;
}

/**
 * Replays the recorded detections over time. Everything emitted here comes from the data file.
 * When a real video file is playing, the <video> element is the clock (read every animation frame);
 * otherwise a timer advances replay time at `speed`x.
 */
function useReplay(data: RealDataFile | null, speed: SamplingRate) {
  const [state, setState] = useState<ReplayState>({ clip: null, t: 0, pass: 0, visible: [], token: "0-" });
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [haveVideo, setHaveVideo] = useState<Record<string, boolean>>({});
  const videoRef = useRef<HTMLVideoElement>(null);
  const haveVideoRef = useRef(haveVideo);
  haveVideoRef.current = haveVideo;
  const pos = useRef({ i: 0, t: 0, pass: 0, first: true });
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Precomputed per clip: detections sorted by time, with path bounds resolved once.
  const byClip = useMemo(() => {
    const m = new Map<string, PreDet[]>();
    data?.detections.forEach((d) => {
      const path = d.path && d.path.length > 0 ? [...d.path].sort((a, b) => a[0] - b[0]) : null;
      const pd: PreDet = {
        d,
        key: `${d.clipId}-${d.trackingId}-${d.tSec}`,
        label: `${d.trackingId.split("-").pop()} · ${d.outfit.top}`,
        path,
        t0: path ? path[0][0] - PATH_LEAD_SEC : d.tSec,
        t1: path ? path[path.length - 1][0] + PATH_TAIL_SEC : d.tSec + BOX_HOLD_SEC,
      };
      m.set(d.clipId, [...(m.get(d.clipId) ?? []), pd]);
    });
    m.forEach((arr) => arr.sort((a, b) => a.d.tSec - b.d.tSec));
    return m;
  }, [data]);

  // Use a clip file only if it has been placed at /assets/videos/<filename>. Probe every clip up front.
  useEffect(() => {
    if (!data) return;
    let live = true;
    data.clips.forEach((clip) => {
      fetch(`/assets/videos/${encodeURIComponent(clip.filename)}`, { method: "HEAD" })
        .then((r) => live && setHaveVideo((h) => ({ ...h, [clip.clipId]: r.ok && (r.headers.get("content-type") ?? "").startsWith("video") })))
        .catch(() => live && setHaveVideo((h) => ({ ...h, [clip.clipId]: false })));
    });
    return () => {
      live = false;
    };
  }, [data]);

  useEffect(() => {
    if (!data || data.clips.length === 0) return;
    pos.current = { i: 0, t: 0, pass: 0, first: true };
    setFeed([]);
    const clips = data.clips;
    let raf = 0;
    let last = performance.now();
    let shown = { clipId: "", pass: -1, t: -1 };

    const advance = (p: typeof pos.current) => {
      p.i = (p.i + 1) % clips.length;
      if (p.i === 0) p.pass += 1;
      p.t = 0;
      p.first = true;
    };

    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dtSec = Math.min((now - last) / 1000, 0.25);
      last = now;
      const p = pos.current;
      const clip = clips[p.i];
      const token = `${p.pass}-${clip.clipId}`;
      const dets = byClip.get(clip.clipId) ?? [];
      const dur = clipDuration(clip);
      const useVideo = haveVideoRef.current[clip.clipId] === true;
      const v = videoRef.current;
      let nt: number;
      let ended = false;

      if (useVideo) {
        // Wait until the <video> for THIS playthrough is mounted (it remounts per clip/pass).
        if (!v || v.dataset.token !== token) {
          if (shown.clipId !== clip.clipId || shown.pass !== p.pass) {
            shown = { clipId: clip.clipId, pass: p.pass, t: 0 };
            setState({ clip, t: 0, pass: p.pass, visible: boxesAt(dets, 0), token });
          }
          return;
        }
        if (v.playbackRate !== speedRef.current) v.playbackRate = speedRef.current;
        if (v.paused && !v.ended) v.play().catch(() => {});
        nt = v.currentTime;
        ended = v.ended || (v.duration > 0 && Number.isFinite(v.duration) && nt >= v.duration - 0.03);
      } else {
        nt = Math.min(p.t + dtSec * speedRef.current, dur);
        ended = nt >= dur;
      }

      const lo = p.first ? -1 : p.t;
      const fresh = dets.filter((x) => x.d.tSec > lo && x.d.tSec <= nt);
      p.first = false;
      if (fresh.length) {
        const items = fresh.map((x) => ({ key: `${p.pass}-${x.key}`, d: toPayload(x.d, clip) })).reverse();
        setFeed((f) => [...items, ...f].slice(0, FEED_MAX));
      }
      p.t = nt;

      if (shown.clipId !== clip.clipId || shown.pass !== p.pass || Math.abs(shown.t - nt) > 1e-3) {
        shown = { clipId: clip.clipId, pass: p.pass, t: nt };
        setState({ clip, t: nt, pass: p.pass, visible: boxesAt(dets, nt), token });
      }
      if (ended) advance(p);
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [data, byClip]);

  const videoOn = !!state.clip && haveVideo[state.clip.clipId] === true;
  return { ...state, feed, videoRef, videoOn };
}

function ReplayFeed({ replay, speed }: { replay: ReturnType<typeof useReplay>; speed: SamplingRate }) {
  const { clip, t, visible, pass, videoRef, videoOn, token } = replay;

  const seg = clip?.segments?.find((sg) => t >= sg.tStart && t < sg.tEnd) ?? clip?.segments?.[clip.segments.length - 1];

  return (
    <div>
    <div className="relative aspect-video w-full overflow-hidden rounded-3xl border border-slate-800 bg-slate-900">
      {videoOn && clip ? (
        <video key={token} ref={videoRef} data-token={token} src={`/assets/videos/${encodeURIComponent(clip.filename)}`} autoPlay muted playsInline className="absolute inset-0 h-full w-full object-fill" />
      ) : (
        <div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:10%_10%]">
          <p className="absolute inset-x-0 bottom-10 px-6 text-center font-mono text-[10px] text-slate-400">
            Clip frames are not bundled in this build. Boxes are the recorded YOLO11 detections (percent of frame), drawn on a blank frame.
          </p>
        </div>
      )}

      {visible.map((d) => (
        <div
          key={d.key}
          className="absolute rounded-sm border-2 border-emerald-400/90"
          style={{ left: `${d.x}%`, top: `${d.y}%`, width: `${d.w}%`, height: `${d.h}%` }}
        >
          <span className="absolute -top-4 left-0 whitespace-nowrap rounded bg-emerald-500/90 px-1 font-mono text-[9px] text-slate-950">
            {d.label}
          </span>
        </div>
      ))}

      <div className="absolute left-3 top-3 flex max-w-[70%] items-center gap-2 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-200">
        <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" />
        <span className="truncate">REPLAY · {clip ? `${clip.camera} · ${clip.location.replace(/_/g, " ")}` : "loading…"}</span>
      </div>
      <div className="absolute right-3 top-3 rounded bg-slate-950/80 px-2 py-1 font-mono text-xs text-slate-300">
        {clip ? `${fmtClock(t)} / ${fmtClock(clipDuration(clip))}` : "—"}
      </div>
      <div className="absolute bottom-3 left-3 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-emerald-400">
        YOLO11 · {visible.length} recorded {visible.length === 1 ? "box" : "boxes"} in view
      </div>
      <div className="absolute bottom-3 right-3 rounded bg-slate-950/80 px-2 py-1 font-mono text-[10px] text-slate-300">
        {speed}× replay · pass {pass + 1}
      </div>
    </div>
    {seg && (
      <div className="mt-3 rounded-2xl border border-neutral-200 bg-neutral-50 p-3">
        <div className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
          NVIDIA Cosmos3-Reason · piece {seg.n}/6 ({fmtClock(seg.tStart)}–{fmtClock(seg.tEnd)}) · {seg.source}
        </div>
        <p className="text-xs leading-relaxed text-neutral-700">{seg.cosmosCaption}</p>
        {seg.cosmosOutfit && (
          <>
            <div className="mb-1 mt-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">Cosmos3 direct, our fashion prompt (compare with the W&amp;B labels on the boxes)</div>
            <pre className="whitespace-pre-wrap font-mono text-[11px] text-neutral-700">{seg.cosmosOutfit}</pre>
          </>
        )}
      </div>
    )}
    </div>
  );
}

function DetectionCard({ d }: { d: DetectionPayload }) {
  const dm = d.demographics;
  return (
    <div className="animate-[fadeIn_0.4s_ease-out] rounded-lg border border-neutral-200 bg-white p-3 font-mono text-[11px] leading-relaxed">
      <div className="mb-1 flex justify-between gap-2">
        <span className="font-semibold text-brand">#{d.trackingId}</span>
        <span className="text-neutral-500">{d.clipId} @ {fmtClock(d.tSec ?? 0)} · conf {d.confidence.toFixed(2)}</span>
      </div>
      <div className="grid grid-cols-2 gap-x-3 text-neutral-600">
        <span>age: <b className="text-neutral-400">{dm.ageBracket}</b></span>
        <span>gender: <b className="text-neutral-400">{dm.genderPresentation}</b></span>
        <span>height: <b className="text-neutral-400">{dm.heightCm}</b></span>
        <span>fit: <b className="text-neutral-400">{dm.fitSize}</b></span>
      </div>
      <div className="mt-1 text-neutral-600">
        outfit: <b className="text-neutral-900">{d.outfit.top}</b> + <b className="text-neutral-900">{d.outfit.bottom}</b>
        {d.outfit.outer && d.outfit.outer.toLowerCase() !== "none" && <> · outer: <b className="text-neutral-900">{d.outfit.outer}</b></>}
      </div>
      {d.outfit.carry.length > 0 && <div className="text-neutral-600">carry: <b className="text-neutral-900">{d.outfit.carry.join(", ")}</b></div>}
      <div className="flex flex-wrap items-center gap-2 text-neutral-600">
        <span className="inline-block h-3 w-3 rounded-sm border border-slate-600" style={{ background: d.outfit.primaryHex }} />
        {d.outfit.primaryColor}
        <span className="inline-block h-3 w-3 rounded-sm border border-slate-600" style={{ background: d.outfit.secondaryHex }} />
        {d.outfit.secondaryColor}
        <span className="rounded bg-brand/10 px-1.5 text-brand">{d.outfit.aesthetic}</span>
        {d.traceUrl && (
          <a href={d.traceUrl} target="_blank" rel="noreferrer" className="ml-auto flex items-center gap-0.5 text-neutral-500 underline hover:text-brand">
            Weave trace <ExternalLink className="h-3 w-3" />
          </a>
        )}
      </div>
      <div className="mt-1.5 border-t border-neutral-200 pt-1.5 text-sky-700">
        ↳ demo catalog: {d.recommendation.name} ({d.recommendation.sku}, ${d.recommendation.priceUsd})
        <span className="block text-[10px] text-neutral-400">rule: {d.recommendation.rule}</span>
      </div>
    </div>
  );
}

function SemanticSearch({ data }: { data: RealDataFile | null }) {
  const [query, setQuery] = useState("Show people wearing a black jacket and jeans");
  const [results, setResults] = useState<SearchResult[] | null>(null);
  const [matchType, setMatchType] = useState("");
  const [notes, setNotes] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);

  async function run(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/search", { method: "POST", body: JSON.stringify({ query }) });
      if (!res.ok) throw new Error("search failed");
      const body = (await res.json()) as { results: SearchResult[]; matchType?: string; notes?: string[] };
      setResults(body.results ?? []);
      setMatchType(body.matchType ?? body.results?.[0]?.matchType ?? "outfit-tag search over W&B vision labels");
      setNotes(body.notes ?? []);
    } catch {
      // API unavailable: same text match, run locally on the loaded data
      setResults(data ? searchDetections(data, query) : []);
      setMatchType("outfit-tag search over W&B vision labels (computed in the browser; API unavailable)");
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div id="search" className="scroll-mt-24 rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <Search className="h-4 w-4 text-brand" /> Outfit Search
        <span className="text-xs font-normal text-neutral-500">· text match over the labelled detections (colors, garments, carried items). Age, gender and height are not searchable.</span>
      </h3>
      <form onSubmit={run} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-900 outline-none focus:border-brand"
          placeholder="Describe the outfit you're looking for…"
        />
        <button className="flex items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60" disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />} Search
        </button>
      </form>
      {results && matchType && <p className="mt-2 font-mono text-[10px] text-neutral-500">Match type: {matchType}. Not vector or semantic search.</p>}
      {notes.map((n) => <p key={n} className="mt-1 text-[11px] text-amber-700">{n}</p>)}
      {results && results.length === 0 && <p className="mt-3 text-xs text-neutral-500">No labelled detection in the replayed clips matched those terms.</p>}
      {results && results.length > 0 && (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          {results.map((r, i) => (
            <div key={`${r.clipId}-${r.description}-${i}`} className="group overflow-hidden rounded-lg border border-neutral-200 bg-white text-left">
              <div
                className="relative flex aspect-video items-center justify-center"
                style={{ background: `linear-gradient(135deg, hsl(${r.thumbHue} 40% 18%), hsl(${r.thumbHue} 30% 8%))` }}
              >
                <MonitorPlay className="h-8 w-8 text-neutral-500" />
                <span className="absolute right-2 top-2 rounded bg-brand px-1.5 py-0.5 font-mono text-[10px] font-bold text-white">
                  {r.matchConfidence}% terms matched
                </span>
              </div>
              <div className="p-2 text-xs">
                <div className="font-medium text-neutral-800">{r.description}</div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1 text-neutral-500">
                  <Video className="h-3 w-3" /> {r.camera} <Clock className="ml-1 h-3 w-3" /> {r.timeRange}
                </div>
                {r.vssOriginalVideo && <div className="mt-0.5 break-all font-mono text-[9px] text-neutral-400">VSS: {r.vssOriginalVideo}{r.tSec !== undefined ? ` @ ${r.tSec}s` : ""}</div>}
                {r.traceUrl && (
                  <a href={r.traceUrl} target="_blank" rel="noreferrer" className="mt-0.5 inline-flex items-center gap-0.5 text-[10px] text-neutral-500 underline hover:text-brand">
                    Weave trace <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function AgentPanel({ fallbackAlerts }: { fallbackAlerts: AgentAlert[] }) {
  const [status, setStatus] = useState<"idle" | "pushing" | "done">("idle");
  const [pushedAt, setPushedAt] = useState("");
  const [campaign, setCampaign] = useState("");
  const [agent, setAgent] = useState<AgentResponse | null>(null);
  const [agentState, setAgentState] = useState<"loading" | "ok" | "failed">("loading");

  // Real agent: POST /api/agent (W&B Inference when configured, else server-side rules over the real aggregates)
  useEffect(() => {
    let live = true;
    fetch("/api/agent", { method: "POST", body: JSON.stringify({}) })
      .then((r) => (r.ok ? (r.json() as Promise<AgentResponse>) : Promise.reject(new Error("agent"))))
      .then((a) => live && (setAgent(a), setAgentState("ok")))
      .catch(() => live && setAgentState("failed"));
    return () => {
      live = false;
    };
  }, []);

  const alerts: AgentAlert[] =
    agentState === "ok" && agent
      ? agent.alerts.map((a) => ({ ...a, metricPct: a.metricPct ?? 0 }))
      : agentState === "failed"
        ? fallbackAlerts
        : [];
  const sourceLabel =
    agentState === "loading"
      ? "contacting /api/agent…"
      : agentState === "failed"
        ? "agent API unavailable: client-side rules over the replayed feed"
        : agent?.source === "wandb"
          ? `W&B Inference: ${agent.model ?? "model"} over the real aggregates`
          : `rule-based fallback${agent?.fallbackReason ? ` (${agent.fallbackReason})` : ""}`;
  const heavy = agent?.aggregates.heavyOuterwearPct ?? 0;
  const topStyle = agent ? Object.entries(agent.aggregates.aesthetics).sort((a, b) => b[1] - a[1])[0]?.[0] : undefined;
  const wanted = agentState === "ok" ? (heavy >= 40 ? "Winter Outerwear Collection" : `${topStyle ?? "Featured"} Edit`) : (fallbackAlerts.find((a) => a.campaign)?.campaign ?? "Winter Outerwear Collection");

  async function trigger() {
    setStatus("pushing");
    const res = await fetch("/api/signage", { method: "POST", body: JSON.stringify({ campaign: wanted }) });
    const data = (await res.json()) as { pushedAt: string; campaign?: string; note?: string };
    setCampaign(data.campaign ?? wanted);
    setPushedAt(new Date(data.pushedAt).toLocaleTimeString());
    setStatus("done");
  }

  const tone = { info: "border-sky-200 text-sky-700", action: "border-brand/30 text-brand", critical: "border-amber-300 text-amber-700" };

  return (
    <div id="agent" className="scroll-mt-24 rounded-3xl border border-orange-200 bg-gradient-to-br from-orange-50 via-amber-50 to-white p-4">
      <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold text-neutral-900">
        <Bot className="h-4 w-4 text-brand" /> Merchandising Suggestions
      </h3>
      <p className="mb-2 font-mono text-[10px] text-neutral-500">Source: {sourceLabel}. Percentages are of person-sightings, no demographics.</p>
      {agentState === "loading" && <p className="mb-2 flex items-center gap-1 text-xs text-neutral-500"><Loader2 className="h-3 w-3 animate-spin" /> Waiting for the agent…</p>}
      <div className="space-y-2">
        {alerts.map((a) => (
          <div key={a.id} className={`rounded-lg border bg-white p-3 text-xs ${tone[a.severity]}`}>
            <div className="text-neutral-800"><b className="uppercase">Insight:</b> {a.insight}</div>
            <div className="mt-1">{a.action}</div>
          </div>
        ))}
      </div>
      <button
        onClick={trigger}
        disabled={status === "pushing"}
        className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-brand px-4 py-2 text-sm font-semibold text-white hover:bg-brand-dark disabled:opacity-60"
      >
        {status === "pushing" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
        Preview Signage Update (demo)
      </button>
      {status === "done" && <p className="mt-2 text-center text-xs text-brand">Demo only: no display is connected. It would show &ldquo;{campaign}&rdquo; ({pushedAt}).</p>}
    </div>
  );
}

export default function LiveSection({ samplingRate, data }: { samplingRate: SamplingRate; data: RealDataFile | null }) {
  const replay = useReplay(data, samplingRate);
  const feedRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    feedRef.current?.scrollTo({ top: 0, behavior: "smooth" });
  }, [replay.feed]);

  const alerts = useMemo(() => agentAlerts(replay.feed.slice(0, 20).map((f) => f.d)), [replay.feed]);

  return (
    <section id="live" className="scroll-mt-24 space-y-6">
      <p className="rounded-2xl bg-neutral-100 px-4 py-2 text-xs text-neutral-600">
        Replay of recorded street cameras (San Francisco / New York) from the event archive, processed by YOLO11 + W&amp;B vision. Not a live store feed.
      </p>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <div className="min-w-0 space-y-6 lg:col-span-3">
          <ReplayFeed replay={replay} speed={samplingRate} />
          <SemanticSearch data={data} />
          <VideoIntelligence />
        </div>
        <div className="min-w-0 space-y-6 lg:col-span-2">
          <div className="rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
            <h3 className="mb-3 flex items-center justify-between text-sm font-semibold text-neutral-900">
              Replayed Outfit Extraction Feed
              <span className="font-mono text-xs font-normal text-brand">{samplingRate}× replay</span>
            </h3>
            <div ref={feedRef} className="h-[360px] space-y-2 overflow-y-auto pr-1">
              {replay.feed.length === 0 && <p className="text-xs text-neutral-500">{data ? "Replay is starting; labelled sightings appear as the clip reaches them." : "Waiting for data…"}</p>}
              {replay.feed.map(({ key, d }) => <DetectionCard key={key} d={d} />)}
            </div>
          </div>
          <AgentPanel fallbackAlerts={alerts} />
        </div>
      </div>
    </section>
  );
}
