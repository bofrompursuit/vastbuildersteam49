"use client";

import { Download, FileText, Film, Gauge, Loader2, ScanSearch, Shirt, Users } from "lucide-react";
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

/** Main dashboard panel: KPIs, color mix, style/carry breakdowns and per-clip stats — all from the real data file. */
function ReplayAnalytics({ data }: { data: RealDataFile | null }) {
  if (!data) {
    return (
      <div className="flex h-[320px] items-center justify-center gap-2 text-sm text-neutral-500">
        <Loader2 className="h-5 w-5 animate-spin text-brand" /> Loading replay analytics…
      </div>
    );
  }
  const { aggregates: agg, detections, clips, pipeline } = data;
  const hexOf = new Map(detections.map((d) => [d.outfit.primaryColor, d.outfit.primaryHex]));
  const colors = top(agg.topColors, 8);
  const colorTotal = colors.reduce((s, [, v]) => s + v, 0) || 1;
  const perClip = clips.map((c) => {
    const ds = detections.filter((d) => d.clipId === c.clipId);
    const conf = ds.reduce((s, d) => s + d.confidence, 0) / Math.max(ds.length, 1);
    const style = top(ds.reduce<Record<string, number>>((m, d) => ((m[d.outfit.aesthetic] = (m[d.outfit.aesthetic] ?? 0) + 1), m), {}), 1)[0]?.[0] ?? "—";
    return { c, n: ds.length, conf, style };
  });
  const kpis = [
    { label: "Person-sightings", value: agg.sightings, icon: Users },
    { label: "YOLO tracks", value: agg.tracks, icon: ScanSearch },
    { label: "Clips replayed", value: clips.length, icon: Film },
    { label: "Heavy outerwear", value: `${agg.heavyOuterwearPct}%`, icon: Shirt },
  ];

  return (
    <div className="space-y-5 p-5 sm:p-6">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl bg-neutral-100 p-4">
            <Icon className="mb-2 h-4 w-4 text-brand" />
            <div className="text-2xl font-medium tracking-tight text-neutral-900">{value}</div>
            <div className="font-mono text-[10px] uppercase tracking-wider text-neutral-500">{label}</div>
          </div>
        ))}
      </div>

      <div>
        <h4 className="mb-2 font-mono text-[10px] uppercase tracking-wider text-neutral-500">Primary color mix (sightings)</h4>
        <div className="flex h-7 overflow-hidden rounded-full border border-neutral-200">
          {colors.map(([k, v]) => (
            <div key={k} title={`${k}: ${v}`} style={{ flex: v, background: hexOf.get(k) ?? "#a3a3a3" }} />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-neutral-600">
          {colors.map(([k, v]) => (
            <span key={k} className="flex items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-sm border border-neutral-300" style={{ background: hexOf.get(k) ?? "#a3a3a3" }} />
              {k} {Math.round((v / colorTotal) * 100)}%
            </span>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl bg-neutral-100 p-4"><AggBars title="Aesthetic (sightings)" rows={top(agg.aesthetics, 6)} unit="" /></div>
        <div className="rounded-2xl bg-neutral-100 p-4"><AggBars title="Carrying (% of sightings)" rows={top(agg.carryPct, 6).filter(([, v]) => v > 0)} unit="%" /></div>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-neutral-200">
        <table className="w-full min-w-[520px] text-left text-xs">
          <thead className="bg-neutral-50 font-mono text-[10px] uppercase tracking-wider text-neutral-500">
            <tr>{["Clip", "Camera · location", "Length", "Sightings", "Avg conf.", "Top style"].map((h) => <th key={h} className="px-3 py-2 font-normal">{h}</th>)}</tr>
          </thead>
          <tbody className="text-neutral-700">
            {perClip.map(({ c, n, conf, style }) => (
              <tr key={c.clipId} className="border-t border-neutral-100">
                <td className="px-3 py-2 font-mono text-brand">{c.clipId}</td>
                <td className="px-3 py-2">{c.camera} · {c.location.replace(/_/g, " ")}</td>
                <td className="px-3 py-2">{Math.round(c.durationSec)}s</td>
                <td className="px-3 py-2">{n}</td>
                <td className="px-3 py-2">{(conf * 100).toFixed(0)}%</td>
                <td className="px-3 py-2">{style}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="font-mono text-[10px] text-neutral-400">{pipeline.detector} · {pipeline.labeler} · {pipeline.index}</p>
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
        <div className="relative min-w-0 self-start overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
          {/* The team's private work board used to be embedded here (with its join key) in a
              public site. Removed: the board is the team's workspace, not product analytics. */}
          <ReplayAnalytics data={data} />
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
