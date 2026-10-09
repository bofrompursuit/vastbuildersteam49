# Front-end truth notes (team 49, AURAAFIT)

Status of what the UI shows, after replacing the simulator. Source of data: `public/data/detections.json`,
falling back to `public/data/detections.sample.json` (a visible "SAMPLE DATA" banner appears when the sample is used).

## Now real (read from the data file or the real API routes)
- Hero count: `aggregates.sightings`, unit "person-sightings in the replayed clips". Heavy-outerwear % from `aggregates`.
- Status chips: detector, labeler, tracing, index, measured seconds per label, all from `pipeline`.
- "How this works / limits" panel: `pipeline.notes` plus fixed honest lines (replay, demo catalog, demo signage).
- Replay panel: clips and detections replay over time; a box appears at its real `bbox` (percent of frame) for 3 replay-seconds after its label time `tSec`. No other boxes exist.
- Detection feed cards: real outfit labels, confidence, clip/time, Weave trace link when `traceUrl` exists.
- Outfit search: calls `/api/search` (real outfit-tag match, shows matchType, VSS receipt, trace link); falls back to the same match in the browser if the API fails. Explicitly not vector search.
- Merchandising suggestions: `/api/agent` (W&B Inference when configured, else rule-based on real aggregates); source/model shown. Falls back to client-side rules over the replayed feed only if the API is unreachable (labelled).
- Dashboard side panel: "Replay aggregates" from `aggregates` (sightings, tracks, aesthetics, colors, carry).
- Video upload: for known clips the API returns real labels; otherwise the API's `message` (lab pipeline only) is shown. Fit/physique/height always "not inferred".

## Demographics
Age, gender, height, fit and physique render as "not inferred" everywhere. The "under 30" alert was replaced by a carried-bag fact.

## Demo / not true, labelled as such
- Product recommendations: "demo catalog", deterministic rule aesthetic (+ heavy outerwear) to one of the 7 sample SKUs (`src/lib/realCatalog.ts`). Prices are demo prices. No score is shown.
- Signage button: "Preview Signage Update (demo)"; no display exists.
- Embedded dashboard (`dashboard.alexmong.com`): external page; this page cannot vouch for its contents. Text says so.

## Could not make true
- Clip frames: no video of the replayed clips is bundled. The panel plays `/assets/videos/<clip.filename>` if that file is placed there (untested with a real clip), otherwise boxes are drawn on a blank grid. `store-demo.mp4` is no longer shown because its provenance is unverified.
- Replay speed (1x/5x/15x) replaces the old "Cosmos sampling rate" control; it changes playback only, not inference.
- Replay timing is a loop over `tSec`; real detection times are sparse (labels, not every frame).
- With a single-clip sample file the feed repeats on each pass; with the 3-clip real file it cycles through clips.
- Uploads of unknown videos are not analyzed (only the browser-measured palette is real).

## Build note
`npx tsc --noEmit` passes. `npm run build` fails in the repo as-is because the API routes export `runtime = "nodejs"` / `dynamic = "force-dynamic"`, which are incompatible with `cacheComponents: true` in `next.config.ts`. With those export lines removed (tested in a scratch copy) the whole app builds and the page was smoke-tested. Fix owner: API routes.
