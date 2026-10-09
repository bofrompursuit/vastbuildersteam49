"use client";

import { useState } from "react";
import { ArrowUpRight, Cpu, Database, Eye, ScanSearch, Timer } from "lucide-react";
import LiveSection from "./LiveSection";
import DashboardSection from "./DashboardSection";
import type { SamplingRate } from "@/lib/types";
import type { RealDataFile } from "@/lib/realTypes";
import { useRealData } from "@/lib/realData";

/** Status chips are built from `pipeline` in the data file. Nothing here is hard-coded as "live". */
function statusFor(data: RealDataFile) {
  const p = data.pipeline;
  return [
    { icon: ScanSearch, label: `Detector: ${p.detector}` },
    { icon: Eye, label: `Labeler: ${p.labeler}` },
    { icon: Cpu, label: `Tracing: ${p.tracing}` },
    { icon: Database, label: `Index: ${p.index}` },
    { icon: Timer, label: `Measured: ${p.secondsPerLabel}s per label` },
  ];
}

const COSMOS_DASHBOARD_URL = "https://team-49-app.thecosmoslabs.com/app/";

const NAV = [
  { href: "#live", label: "Replay" },
  { href: "#search", label: "Search" },
  { href: "#agent", label: "Agent" },
  { href: "#dashboard", label: "Dashboard" },
];

function Eyebrow({ children }: { children: React.ReactNode }) {
  return (
    <p className="mb-3 flex items-center gap-1 font-mono text-xs uppercase tracking-wider text-neutral-500">
      {children} <ArrowUpRight className="h-3 w-3" />
    </p>
  );
}

function Hero({ data }: { data: RealDataFile | null }) {
  const spotlight = data ? [...data.detections].sort((a, b) => b.confidence - a.confidence)[0] : undefined;
  const garment = spotlight ? (spotlight.outfit.outer && spotlight.outfit.outer.toLowerCase() !== "none" ? spotlight.outfit.outer : spotlight.outfit.top) : "";
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="flex flex-col justify-center rounded-[2rem] bg-neutral-100 p-6 sm:p-12 lg:min-h-[560px]">
        <Eyebrow>{data ? `${data.aggregates.sightings.toLocaleString()} person-sightings in the replayed clips` : "Loading replay data…"}</Eyebrow>
        <h1 className="text-[2.5rem] font-medium leading-[1.05] break-words tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          The Intelligence Layer for Modern Retail
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
          AURAAFIT turns camera footage into outfit analytics: YOLO11 finds people, a W&amp;B Inference vision model labels what they
          wear, and a demo catalog maps outfits to products. Age, gender, height and fit are not inferred.
        </p>
        <div className="mt-10 flex flex-wrap gap-2">
          <a href="#live" className="rounded-full bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-dark">Open the replay</a>
          <a href="#dashboard" className="rounded-full border border-neutral-400 px-5 py-3 text-sm font-medium text-neutral-900 hover:bg-white">View Dashboard</a>
        </div>
      </div>

      {/* sunset visual, echoing the template's photo panel */}
      <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#c5654f_0%,#e2765a_45%,#f59e7b_62%,#8b7fa8_72%,#5b5675_100%)]">
        <div className="absolute left-1/2 top-[62%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-300/60 blur-3xl" />
        <div className="absolute inset-x-0 top-[70%] h-[3px] bg-indigo-100 shadow-[0_0_24px_6px_rgba(199,210,254,0.9)]" />
        <div className="absolute left-6 top-6 rounded-2xl border border-white/30 bg-white/15 p-4 text-white backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/70">Sample detection · recorded clip</p>
          <p className="mt-1 text-sm font-medium">{spotlight ? `#${spotlight.trackingId} · ${garment}` : "—"}</p>
          <p className="text-xs text-white/80">Age, gender: not inferred{spotlight ? ` · ${spotlight.outfit.aesthetic}` : ""}</p>
        </div>
        <div className="absolute bottom-6 right-6 rounded-2xl border border-white/30 bg-white/15 p-4 text-right text-white backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/70">Heavy outerwear · all replayed sightings</p>
          <p className="text-3xl font-medium">{data ? `${data.aggregates.heavyOuterwearPct}%` : "—"}</p>
        </div>
      </div>
    </section>
  );
}

const BUILDERS = [
  { name: "Bo Moldenhauer", url: "https://www.linkedin.com/in/bomoldenhauer", color: "#0A66C2" },
  { name: "Tarun Theegela", url: "https://www.linkedin.com/in/taruntheegela/", color: "#0A66C2" },
  { name: "Qiman Wang", url: "https://www.linkedin.com/in/qimanwang/", color: "#0A66C2" },
  { name: "Alexander Mong", url: "https://www.linkedin.com/in/alexander-mong/", color: "#0A66C2" },
];

const SPONSORS = [
  { name: "VAST Data", url: "https://www.vastdata.com/", color: "#00A3E0" },
  { name: "CoreWeave", url: "https://coreweave.com/", color: "#4C5FD5" },
  { name: "xAI", url: "https://x.ai/company", color: "#111111" },
  { name: "NVIDIA", url: "https://www.nvidia.com/en-us/", color: "#76B900" },
  { name: "Weights & Biases", url: "https://wandb.ai/", color: "#FFBE00" },
  { name: "Hugging Face", url: "https://huggingface.co/", color: "#FFD21E" },
];

function Credits() {
  const link = "brand-pill inline-flex items-center gap-1.5 rounded-full border border-neutral-300 bg-white px-3 py-1.5 text-sm text-neutral-800 transition-colors";
  const dot = (c: string) => <span className="h-2 w-2 rounded-full ring-1 ring-black/10" style={{ background: c }} />;
  return (
    <section className="mx-auto grid max-w-7xl grid-cols-1 gap-6 px-4 pb-12 sm:px-6 md:grid-cols-2">
      <div>
        <p className="mb-3 font-mono text-xs uppercase tracking-wider text-neutral-500">Connect with the builders</p>
        <div className="flex flex-wrap gap-2">
          {BUILDERS.map((b) => (
            <a key={b.url} href={b.url} target="_blank" rel="noopener noreferrer" className={link} style={{ "--c": b.color } as React.CSSProperties}>
              {dot(b.color)}{b.name} <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
      </div>
      <div>
        <p className="mb-3 font-mono text-xs uppercase tracking-wider text-neutral-500">Sponsors</p>
        <div className="flex flex-wrap gap-2">
          {SPONSORS.map((s) => (
            <a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer" className={link} style={{ "--c": s.color } as React.CSSProperties}>
              {dot(s.color)}{s.name} <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

export default function AuraFitApp() {
  const [samplingRate, setSamplingRate] = useState<SamplingRate>(1);
  const { loaded, error } = useRealData();
  const data = loaded?.data ?? null;

  return (
    <div className="min-h-screen bg-white text-neutral-900">
      <header className="sticky top-0 z-20 bg-white/85 backdrop-blur">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <a href="#" className="text-xl font-semibold tracking-tight">AURAAFIT</a>
          <nav className="hidden gap-8 text-sm text-neutral-800 md:flex">
            {NAV.map((n) => (
              <a key={n.href} href={n.href} className="hover:text-brand">{n.label}</a>
            ))}
          </nav>
          <a href="#live" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">Open Replay</a>
        </div>
        <nav className="flex gap-5 overflow-x-auto px-4 pb-3 text-sm whitespace-nowrap text-neutral-700 md:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-brand">{n.label}</a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-4 pb-16 sm:px-6">
        <Hero data={data} />

        {loaded?.isSample && (
          <div className="rounded-2xl border border-amber-300 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            SAMPLE DATA: showing detections.sample.json (shape only). The real run in detections.json has not been loaded.
          </div>
        )}
        {error && (
          <div className="rounded-2xl border border-red-300 bg-red-50 px-4 py-2 text-xs text-red-700">
            Could not load /data/detections.json or /data/detections.sample.json. No data is shown (nothing is simulated).
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {data && statusFor(data).map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-mono text-[11px] text-neutral-700">
              <Icon className="h-3 w-3 text-brand" /> {label}
            </span>
          ))}
        </div>

        <div>
          <Eyebrow>Section 01 · Recorded-camera replay</Eyebrow>
          <h2 className="mb-6 text-3xl font-medium tracking-tight sm:text-4xl">Replayed Foot-Traffic &amp; Outfit Analytics</h2>
          <LiveSection samplingRate={samplingRate} data={data} />
        </div>

        <div>
          <Eyebrow>Live dashboard · Cosmos Labs</Eyebrow>
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <h2 className="text-3xl font-medium tracking-tight sm:text-4xl">Outfit Boxes Dashboard</h2>
            <a href={COSMOS_DASHBOARD_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-sm font-medium text-brand hover:text-brand-dark">
              Open in new tab <ArrowUpRight className="h-4 w-4" />
            </a>
          </div>
          <div className="overflow-hidden rounded-[2rem] border border-neutral-200 bg-neutral-950">
            <iframe src={COSMOS_DASHBOARD_URL} title="Outfit Boxes dashboard" loading="lazy" className="block h-[70vh] min-h-[480px] w-full" />
          </div>
        </div>

        <div>
          <Eyebrow>Section 02 · Analytics</Eyebrow>
          <DashboardSection samplingRate={samplingRate} onSamplingRate={setSamplingRate} data={data} />
        </div>
      </main>

      <Credits />

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        AURAAFIT · VAST VSS · YOLO11 · W&amp;B Inference + Weave — replay of recorded event footage; age, gender, height and fit are not inferred
      </footer>
    </div>
  );
}
