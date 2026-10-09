"use client";

import { useState } from "react";
import { AlertTriangle, Download, ExternalLink, FileText, Gauge, Loader2, RefreshCw } from "lucide-react";
import type { SamplingRate } from "@/lib/types";

export const DASHBOARD_URL = "https://dashboard.alexmong.com/video-agents-1009/?key=k-acf0a9b91dc6";
const RATES: SamplingRate[] = [1, 5, 15];

interface Props {
  samplingRate: SamplingRate;
  onSamplingRate: (r: SamplingRate) => void;
}

export default function DashboardSection({ samplingRate, onSamplingRate }: Props) {
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [frameKey, setFrameKey] = useState(0);

  function refresh() {
    setLoading(true);
    setFailed(false);
    setFrameKey((k) => k + 1);
  }

  const btn = "flex w-full items-center gap-2 rounded-full border border-neutral-300 bg-white px-4 py-2 text-sm text-neutral-800 hover:border-brand hover:text-brand";

  return (
    <section id="dashboard" className="scroll-mt-20">
      <div className="mb-4">
        <h2 className="text-3xl font-medium tracking-tight text-neutral-900 sm:text-4xl">Executive Foot-Traffic &amp; Inventory Performance Dashboard</h2>
        <p className="text-sm text-neutral-500">Live streaming metric telemetry and aggregated foot-traffic demographics.</p>
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_260px]">
        <div className="relative overflow-hidden rounded-[2rem] border border-neutral-200 bg-white">
          {loading && !failed && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-3 bg-white/90 text-neutral-500">
              <Loader2 className="h-8 w-8 animate-spin text-brand" /> Loading live telemetry…
            </div>
          )}
          {failed ? (
            <div className="flex h-[800px] flex-col items-center justify-center gap-3 text-neutral-500">
              <AlertTriangle className="h-8 w-8 text-amber-600" />
              Dashboard couldn&apos;t be embedded.
              <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-brand underline">
                Open in a new tab <ExternalLink className="h-4 w-4" />
              </a>
            </div>
          ) : (
            <iframe
              key={frameKey}
              src={DASHBOARD_URL}
              title="Executive Foot-Traffic Dashboard"
              width="100%"
              height="800px"
              frameBorder="0"
              className="block bg-white"
              onLoad={() => setLoading(false)}
              onError={() => setFailed(true)}
            />
          )}
        </div>

        <aside className="space-y-4">
          <div className="space-y-2 rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
            <h3 className="mb-2 text-sm font-semibold text-neutral-900">Quick Actions</h3>
            <button onClick={refresh} className={btn}><RefreshCw className="h-4 w-4" /> Refresh data feed</button>
            <a href="/api/export" className={btn}><Download className="h-4 w-4" /> Export compliance CSV</a>
            <button onClick={() => window.print()} className={btn}><FileText className="h-4 w-4" /> Export compliance PDF</button>
            <a href={DASHBOARD_URL} target="_blank" rel="noreferrer" className={btn}><ExternalLink className="h-4 w-4" /> Open full dashboard</a>
          </div>
          <div className="rounded-3xl border border-neutral-200 bg-neutral-100 p-4">
            <h3 className="mb-1 flex items-center gap-2 text-sm font-semibold text-neutral-900">
              <Gauge className="h-4 w-4 text-brand" /> Cosmos Sampling Rate
            </h3>
            <p className="mb-3 text-xs text-neutral-500">Inference frames per second on CoreWeave H100.</p>
            <div className="grid grid-cols-3 gap-1 rounded-lg bg-white p-1">
              {RATES.map((r) => (
                <button
                  key={r}
                  onClick={() => onSamplingRate(r)}
                  className={`rounded-md py-1.5 text-xs font-semibold ${r === samplingRate ? "bg-brand text-white" : "text-neutral-500 hover:text-neutral-900"}`}
                >
                  {r} FPS
                </button>
              ))}
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
