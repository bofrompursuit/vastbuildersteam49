# API notes (server routes are real, not simulated)

Data source for every route: `public/data/detections.json` (lab VM output), falling back to
`public/data/detections.sample.json`. Loader/aggregates: `src/lib/server/realData.ts`. Every response that
reads data says which file it used (`dataSource` / `data`: `{ file, isSample, ... }`).
Demographics are never inferred: age, gender, height and fit are `"not inferred"` (`null` for numeric fields).

## Env vars (server only, never in code)

| Var | Use |
|---|---|
| `WANDB_API_KEY` | If set, `/api/agent` calls W&B Inference. If unset, rule-based alerts. |
| `WANDB_PROJECT_PATH` | Sent as `OpenAI-Project` header, e.g. `vastdata/team-49`. Skipped if unset. |
| `WANDB_AGENT_MODEL` | Model id, default `openai/gpt-oss-120b`. |

## POST /api/agent (new) — AI Merchandising Agent

Body (optional): `{ clipId?: string }` (scope to one clip; default all). `GET` also works.

Response:
```json
{
  "source": "wandb" | "rules",
  "model": "openai/gpt-oss-120b",          // only when source = "wandb"
  "fallbackReason": "WANDB_API_KEY not set | W&B Inference HTTP 500 | ...",  // only when source = "rules"
  "alerts": [{ "id": "agent-1", "severity": "action|info|critical", "insight": "...", "alert": "...", "action": "...", "metricPct": 50 }],
  "aggregates": { "sightings", "tracks", "heavyOuterwearPct", "carryPct", "topColors", "aesthetics", "topColorsCount", "aestheticsCount" },
  "data": { "file", "isSample", "generatedAt", "clips": ["..."], "labeler": "..." }
}
```
`alerts[]` is the existing `AgentAlert` shape (`id, severity, insight, action, metricPct`) plus `alert` (= `insight`).
Difference: `metricPct` may be `null` (no % quoted). Alerts are 2-3 items. W&B call: plain `fetch`, temperature 0.2,
20 s timeout. Model output is parsed defensively and rejected (falls back to rules) if it mentions age/gender/body
terms or quotes a number not present in the aggregates. Percentages are of person-sightings, not unique people.

## POST /api/search

Body: `{ query: string }`. Tokenised match over outfit fields (top, bottom, outer, carry, colours, aesthetic).
Response keeps `{ query, results: SearchResult[] }` — **one result per matching clip** (unique `clipId`), best
track as representative. `SearchResult` fields kept: `clipId, camera, timeRange, matchConfidence, description, thumbHue`.
Honest semantics: `matchConfidence` = % of query terms matched (not a model confidence); `timeRange` is
`"m:ss of m:ss · filename"` (position inside the clip, not wall-clock); `thumbHue` is derived from the label colour.
Added fields per result: `score` (0-1), `matchType` (`"outfit-tag search over W&B vision labels"`), `matchedTerms`,
`matchedFields`, `location`, `vssOriginalVideo`, `filename`, `tSec`, `trackingId`, `traceUrl`, `tracks[]` (all matching tracks, max 10).
Top level adds: `matchType`, `terms`, `notes[]` (e.g. ignored demographic / time-of-day terms), `dataSource`.
Age, gender, body and time-of-day terms are ignored (and reported in `notes`). Empty query -> 400.

## POST /api/analyze

Body unchanged (`{ kind, name, sizeBytes?, durationSec?, sampledPalette? }`), plus optional `clipId`.
Always returns a full `AnalysisResult`-shaped body so the existing UI does not crash.
- **Our clip** (filename / URL basename / `clipId` matches a clip): `mode: "precomputed-real"`, `realData: true`,
  real per-track features: `tracks[]` (ExtractedTrack fields + `clipId, top, bottom, outer, carry, aesthetic, heavyOuterwear, model, traceUrl`),
  `accessories` = real carried-item labels, `heightCm`/`heightIn`/`avgHeightCm` = `null`, `physique` = `"not inferred"`,
  `attributeConfidence` = `null` (not produced), `aggregates.physiques` = single "Not inferred" bucket, recommendations
  computed from the real clip aggregates. Also `clip`, `dataSource`, `notes[]`.
- **Anything else**: HTTP 200, `mode: "lab-pipeline-only"`, `realData: false`, `message` (uploaded-video analysis runs in the
  lab pipeline: YOLO11 + W&B vision, not on this demo), empty `tracks`, empty aggregates/recommendations, and
  `realDataAvailableFor: [{ clipId, filename, vssOriginalVideo, camera, location, durationSec, sightings }]`.
- Still 400 for malformed bodies / non-http(s) URLs. Fake 700 ms latency removed.

## POST /api/analyze/csv

Body unchanged (`{ tracks, source }`). Output columns are now the real outfit columns
(`source, clip_id, track_id, timestamp_sec, top, bottom, outer, carry, primary_*, secondary_*, aesthetic, heavy_outerwear, detection_confidence, model, trace_url`)
plus `age_bracket, gender_presentation, height_cm, fit_size` = `"not inferred"`. (Old height/physique columns removed.) Cells are quoted and formula-injection-safe.

## GET /api/export

CSV of all real detections, one row per sighting: ids, clip receipt (`filename`, `vss_original_video`, `camera`, `location`),
`t_sec`, `confidence`, outfit fields, colours, `aesthetic`, `heavy_outerwear`, `age_bracket/gender_presentation/height_cm/fit_size` =
`"not inferred"`, `model`, `trace_url`, `data_file`. Header `X-Data-File` names the source file. The old random 50-row export is gone.

## POST /api/signage

Shape unchanged; adds `simulated: true` and `note`. No physical display exists, so the push is still a simulation (fake 800 ms delay removed).

## Still simulated / out of scope for `api/`

- `src/lib/engine.ts` (`generateDetection`, `agentAlerts`, `semanticSearch`) and the live feed in `LiveSection` are client-side simulators; UI owner must switch to `detections.json` and call `/api/agent`.
- `src/lib/analysis.ts` simulator is no longer used by `/api/analyze` (only `nameColor` is imported); the client palette sampling is real but unused server-side.
- Signage push.
