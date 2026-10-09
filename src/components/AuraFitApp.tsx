"use client";

import { useState } from "react";
import { ArrowUpRight, Cpu, Database, Eye, ScanSearch } from "lucide-react";
import LiveSection from "./LiveSection";
import DashboardSection from "./DashboardSection";
import type { SamplingRate } from "@/lib/types";

const STATUS = [
  { icon: Database, label: "VAST Data AI OS: Connected" },
  { icon: Cpu, label: "CoreWeave H100 Node: Active (12ms latency)" },
  { icon: ScanSearch, label: "YOLO v8 Tracking: Live" },
  { icon: Eye, label: "NVIDIA Cosmos Engine: Stream Ingesting" },
];

const NAV = [
  { href: "#live", label: "Live Stream" },
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

function Hero() {
  return (
    <section className="grid grid-cols-1 gap-3 lg:grid-cols-2">
      <div className="flex flex-col justify-center rounded-[2rem] bg-neutral-100 p-6 sm:p-12 lg:min-h-[560px]">
        <Eyebrow>Daily analyzed shoppers · 48,210</Eyebrow>
        <h1 className="text-[2.5rem] font-medium leading-[1.05] break-words tracking-tight text-neutral-900 sm:text-5xl lg:text-6xl">
          The Intelligence Layer for Modern Retail
        </h1>
        <p className="mt-6 max-w-lg text-base leading-relaxed text-neutral-600 sm:text-lg">
          AURAAFIT connects every in-store camera into a unified AI layer — delivering real-time outfit analytics, anonymous
          demographics, and automated merchandising across your stores.
        </p>
        <div className="mt-10 flex flex-wrap gap-2">
          <a href="#live" className="rounded-full bg-brand px-5 py-3 text-sm font-medium text-white hover:bg-brand-dark">Start analyzing</a>
          <a href="#dashboard" className="rounded-full border border-neutral-400 px-5 py-3 text-sm font-medium text-neutral-900 hover:bg-white">View Dashboard</a>
        </div>
      </div>

      {/* sunset visual, echoing the template's photo panel */}
      <div className="relative min-h-[360px] overflow-hidden rounded-[2rem] bg-[linear-gradient(180deg,#c5654f_0%,#e2765a_45%,#f59e7b_62%,#8b7fa8_72%,#5b5675_100%)]">
        <div className="absolute left-1/2 top-[62%] h-48 w-48 -translate-x-1/2 -translate-y-1/2 rounded-full bg-orange-300/60 blur-3xl" />
        <div className="absolute inset-x-0 top-[70%] h-[3px] bg-indigo-100 shadow-[0_0_24px_6px_rgba(199,210,254,0.9)]" />
        <div className="absolute left-6 top-6 rounded-2xl border border-white/30 bg-white/15 p-4 text-white backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/70">Live track</p>
          <p className="mt-1 text-sm font-medium">#TRK-8092 · Navy Puffer Jacket</p>
          <p className="text-xs text-white/80">Est. age 24-30 · Outdoor / Technical</p>
        </div>
        <div className="absolute bottom-6 right-6 rounded-2xl border border-white/30 bg-white/15 p-4 text-right text-white backdrop-blur-md">
          <p className="font-mono text-[10px] uppercase tracking-wider text-white/70">Heavy outerwear · 30 min</p>
          <p className="text-3xl font-medium">68%</p>
        </div>
      </div>
    </section>
  );
}

export default function AuraFitApp() {
  const [samplingRate, setSamplingRate] = useState<SamplingRate>(5);

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
          <a href="#live" className="rounded-full bg-brand px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-dark">Go Live</a>
        </div>
        <nav className="flex gap-5 overflow-x-auto px-4 pb-3 text-sm whitespace-nowrap text-neutral-700 md:hidden">
          {NAV.map((n) => (
            <a key={n.href} href={n.href} className="hover:text-brand">{n.label}</a>
          ))}
        </nav>
      </header>

      <main className="mx-auto max-w-7xl space-y-16 px-4 pb-16 sm:px-6">
        <Hero />

        <div className="flex flex-wrap gap-2">
          {STATUS.map(({ icon: Icon, label }) => (
            <span key={label} className="flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white px-3 py-1.5 font-mono text-[11px] text-neutral-700">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
              <Icon className="h-3 w-3 text-brand" /> {label}
            </span>
          ))}
        </div>

        <div>
          <Eyebrow>Section 01 · Real-time stream</Eyebrow>
          <h2 className="mb-6 text-3xl font-medium tracking-tight sm:text-4xl">Live Foot-Traffic &amp; Outfit Analytics</h2>
          <LiveSection samplingRate={samplingRate} />
        </div>

        <div>
          <Eyebrow>Section 02 · Analytics</Eyebrow>
          <DashboardSection samplingRate={samplingRate} onSamplingRate={setSamplingRate} />
        </div>
      </main>

      <footer className="border-t border-neutral-200 py-6 text-center text-xs text-neutral-500">
        AURAAFIT · VAST Data · CoreWeave · YOLO · NVIDIA Cosmos · Weights &amp; Biases — anonymous tracking, no PII stored
      </footer>
    </div>
  );
}
