"use client";

import { AlertTriangle, Download, FileText, Gauge } from "lucide-react";
import type { SamplingRate } from "@/lib/types";
import type { RealAggregates, RealDataFile } from "@/lib/realTypes";

const RATES: SamplingRate[] = [1, 5, 15];

interface Props {
  samplingRate: SamplingRate;
  onSamplingRate: (r: SamplingRate) => void;
  data: RealDataFile | null;
}

function top(rec: Record<string, number>, n = 5): [string, number][] {
  return Object.entries(rec).sort((a, b) => b[1] - a[1]).slice(0, n);
}

function AggBars({ title, rows, unit }: { title: string; rows: [string, number][]; unit: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <div className="mb-3">
      <h4 className="mb-1 font-mono text-[10px] uppercase tracking-wider text-neutral-500">{title}</h4>
      {rows.length === 0 && <p className="text-xs text-neutral-400">none</p>}
      {rows.map(([k, v]) => (
        <div key={k} className="mb-1 text-xs">
          <div className="flex justify-between text-neutral-700"><span>{k}</span><span className="font-mono text-neutral-500">{v}{unit}</span></div>
          <div className="h-1 rounded-full bg-white"><div className="h-1 rounded-full bg-brand" style={{ width: `${Math.max(3, (v / max) * 100)}%` }} /></div>
        </div>
      ))}
    </div>
  );
}

/** Real aggregates from the data file, with the unit spelled out. */
function ReplayAggregates({ agg }: { agg: RealAggregates }) {
  const carry = top(agg.carryPct).filter(([k, v]) => k !== "none" && v > 0);
  return (
    <div className="rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
      <h3 className="mb-1 text-sm font-semibold text-neutral-900">Replay aggregates</h3>
      <p className="mb-3 text-xs text-neutral-500">
        {agg.sightings} person-sightings (not unique people) · {agg.tracks} YOLO tracks across the replayed clips.
      </p>
      <p className="mb-3 text-xs text-neutral-700">Heavy outerwear: <b>{agg.heavyOuterwearPct}%</b> of sightings</p>
      <AggBars title="Aesthetic (sightings)" rows={top(agg.aesthetics)} unit="" />
      <AggBars title="Top colors (sightings)" rows={top(agg.topColors)} unit="" />
      <AggBars title="Carrying (% of sightings)" rows={carry} unit="%" />
    </div>
  );
}

export default function DashboardSection({ samplingRate, onSamplingRate, data }: Props) {
  const btn = "flex w-full items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 hover:border-brand hover:text-brand";

  return (
    <section id="dashboard" className="scroll-mt-20">
      <div className="mb-4">
        <h2 className="text-3xl font-medium tracking-tight text-neutral-900 sm:text-4xl">Executive Foot-Traffic &amp; Inventory Performance Dashboard</h2>
        <p className="text-sm text-neutral-500">Aggregates from the replayed street-camera clips (YOLO11 + W&B vision). Demographics are not inferred.</p>
      </div>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_260px]">
        <div className="relative min-w-0 overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
          {/* The team's private work board used to be embedded here (with its join key) in a
              public site. Removed: the board is the team's workspace, not product analytics. */}
          <div className="flex h-[320px] flex-col items-center justify-center gap-3 p-6 text-center text-neutral-500">
            <AlertTriangle className="h-8 w-8 text-amber-600" />
            <p className="max-w-md text-sm">
              Analytics for this demo come from the replayed clips: see the Replay aggregates card and the
              Export detections CSV button. The team&apos;s internal work board is private and is not embedded here.
            </p>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="space-y-2 rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Quick Actions</h3>
            <a href="/api/export" className={btn}><Download className="h-4 w-4" /> Export detections CSV</a>
            <button onClick={() => window.print()} className={btn}><FileText className="h-4 w-4" /> Print / save as PDF</button>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Gauge className="h-4 w-4 text-brand" /> Replay Speed
            </h3>
            <p className="mb-3 text-xs text-neutral-500">How fast the recorded detections replay. Does not change inference.</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-white p-1">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => onSamplingRate(r)}
                  className={`rounded-md py-1.5 text-xs font-semibold ${r === samplingRate ? "bg-brand text-white" : "text-neutral-500 hover:text-neutral-900"}`}
                >
                  {r}×
                </button>
              ))}
            </div>
          </div>
          {data && <ReplayAggregates agg={data.aggregates} />}
        </aside>
      </div>
    </section>
  );
}
