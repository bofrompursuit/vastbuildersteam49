"use client";

import { useEffect, useState } from "react";
import type { RealDataFile } from "./realTypes";

export type RealDataSource = "detections.json" | "detections.sample.json";

export interface LoadedRealData {
  data: RealDataFile;
  source: RealDataSource;
  isSample: boolean;
}

async function tryFetch(path: string): Promise<RealDataFile | null> {
  try {
    const res = await fetch(path, { cache: "no-store" });
    if (!res.ok) return null;
    const json = (await res.json()) as RealDataFile;
    if (!json?.pipeline || !Array.isArray(json.clips) || !Array.isArray(json.detections) || !json.aggregates) return null;
    return json;
  } catch {
    return null;
  }
}

/** Loads /data/detections.json, falling back to /data/detections.sample.json. */
export async function loadRealData(): Promise<LoadedRealData | null> {
  const real = await tryFetch("/data/detections.json");
  if (real) return { data: real, source: "detections.json", isSample: false };
  const sample = await tryFetch("/data/detections.sample.json");
  if (sample) return { data: sample, source: "detections.sample.json", isSample: true };
  return null;
}

export function useRealData(): { loaded: LoadedRealData | null; error: boolean } {
  const [loaded, setLoaded] = useState<LoadedRealData | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    let live = true;
    loadRealData().then((r) => {
      if (!live) return;
      if (r) setLoaded(r);
      else setError(true);
    });
    return () => {
      live = false;
    };
  }, []);
  return { loaded, error };
}
