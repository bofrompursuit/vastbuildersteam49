# Integrating the `alex` branch into AURAAFIT (for Bo and Tarun)

**What this branch is:** Bo's `domain` app (commit `16a8c14`) plus real data and honest wiring. It builds cleanly (`npm run build`) and was tested locally.

## What changed
- **Real data:** `public/data/detections.json` contains 214 person-sightings from 3 event clips in our VAST VSS archive:
  - sf_streets_cam-2 chunks 17 and 19;
  - nyc_streets_cam-1 chunk 13.

  Boxes come from YOLO11 (the event GPU endpoint, called directly). Per-person outfit labels come from W&B Inference `google/gemma-4-26B-A4B-it`, and every call is traced in W&B Weave (`vastdata/team-49`). The shape is in `src/lib/realTypes.ts`.
- **Cosmos in the app:** each clip in `detections.json` has `segments[]` with the original **NVIDIA Cosmos3-Reason** caption for every 5 s piece, taken from our VAST VSS index (gender words neutralised). The replay panel shows the caption for the piece that's playing. Optional `cosmosOutfit` holds a fresh direct Cosmos3 pass with our fashion prompt, when present.
- **Replay videos:** `public/assets/videos/<VSS filename>.mp4`, 720p, about 2.7 MB each, stored via Git LFS (Bo's existing `.gitattributes`). The replay panel plays them, with the real boxes synced.
- **UI (`src/components/*`, `src/lib/engine.ts`, `types.ts`, `analysis.ts`):** reads the real data, falling back to `detections.sample.json`.
  - Demographics show **"not inferred"** (team decision).
  - Wording is **"replay of recorded street cameras"**, not live.
  - The status panel comes from the real pipeline.
  - Product suggestions are labelled **demo catalog**.
- **API (`src/app/api/*`, `src/lib/server/*`):** shapes are in `docs/API_NOTES.md`.
  - `POST /api/agent`: merchandising alerts. Calls **W&B Inference live** when `WANDB_API_KEY` is set, and falls back to rules otherwise. The UI shows which.
  - `/api/search`: outfit-tag search over the real labels, with VSS clip receipts.
  - `/api/analyze`: real results for our clips; honest message for any other upload.
  - `/api/export`: CSV of the real detections.
  - Removed `export const runtime/dynamic` from the routes. They conflict with `cacheComponents: true` and broke `npm run build`.
- **Security fix:** removed the embedded team board iframe. It had the board's **join key** in the URL (`DashboardSection.tsx`). **That key is still on `domain` and live on auraafit.tech.** Merging this branch removes it from the site; the key will be rotated.
- **Docs:** `README.md` (sponsor tools, pipeline, real vs demo, privacy), `docs/DEMO_SCRIPT.md` (3 min), `docs/SUBMISSION.md` (form drafts), `docs/FRONTEND_TRUTH_NOTES.md`.

## To ship it (Bo / Tarun)
1. **Merge:** `git fetch origin && git checkout domain && git merge origin/alex`. It's a fast-forward from `16a8c14` if `domain` hasn't moved; otherwise resolve conflicts, mostly in `src/components/*`. Push `domain` and Vercel deploys auraafit.tech (Tarun's CI).
2. **Git LFS:** make sure Vercel pulls LFS files (Project settings → Git → "Git LFS" enabled), otherwise the 3 replay videos deploy as pointer files.
3. **Vercel env vars,** for the live W&B agent (optional; without them the agent uses rules and says so):
   - `WANDB_API_KEY`: the event W&B key. It's in `$WANDB_API_KEY` on the lab VM. Never commit it.
   - `WANDB_PROJECT_PATH=vastdata/team-49`
   - `WANDB_AGENT_MODEL=openai/gpt-oss-120b` (the default; any W&B Inference chat model works)
4. **Check after deploy:** the hero says "214 person-sightings", the replay shows SF/NYC video with boxes, the agent panel shows "Source: W&B Inference" (if the key is set), and no `?key=` appears anywhere in the page source.

## Regenerating the data (Alex's lab VM, `~/loop/`)
- `build_data.py`: YOLO11 → per-frame IoU tracker → best crop per track → W&B vision (Weave-traced) → `detections.json`. The list of clips is at the top of the file.
- To add Bo's store clip, add its VSS filename to `CLIPS`. It must be in our VSS archive.
- Known limits:
  - Each 5 s piece is tracked separately, so numbers are **sightings**, not unique people.
  - About half the labels came back colour-only; a generic noun (top / bottoms / item) was added, and no garment type was invented.
  - Labels are model output and are not hand-checked yet.

## Open team items
- Re-ingest (rewriting VSS captions) is blocked by the accidental whole-archive re-ingest backlog: the detector pods are busy. An organizer has to clear it. Nothing in this branch depends on it.
- Hand check: about 24 crops labelled by a person, scored in Weave. Not done yet; whoever has 10 minutes.

## Live camera mode
A webcam mode, separate from the recorded-clip replay. Boxes come from an on-device person detector (TensorFlow.js COCO-SSD `lite_mobilenet_v2`, lazy-loaded when the camera starts) with a simple IoU tracker (ids L01, L02, ...). About once per second, up to 2 requests in flight, the largest unlabelled or stale (>2 s) tracks are cropped (+8% pad, max side 512) and POSTed as JPEG data URLs to `/api/live` with `single:true`. The route calls a W&B Inference vision model and returns clothing and carried items (`top`, `bottom`, `outer`, `carry`, `motion`). `/api/live` without `single` still describes a whole frame (up to 6 people). The UI shows detector fps, labels/s, running totals since start (share of labelled sightings with an outer layer, bag, backpack) and a Record button that saves the boxed video as `auraafit-live-<timestamp>.webm`. Without `WANDB_API_KEY`, boxes, tracking and recording still work and labels read "needs W&B key".

**Env vars** (server-side only; Vercel project env or `.env.local`):
- `WANDB_API_KEY` (required). Without it `/api/live` returns `{enabled:false, message}` and the UI shows the message.
- `WANDB_PROJECT_PATH` (optional): sent as the `OpenAI-Project` header, e.g. `vastdata/team-49`.
- `WANDB_VISION_MODEL` (optional): defaults to `google/gemma-4-26B-A4B-it`.

**Where it works:** it runs on Vercel, because W&B Inference is a public API. The YOLO and Cosmos servers are reachable only inside the lab network, so this mode uses COCO-SSD boxes instead of YOLO11, and has no Cosmos captions. The camera needs https or localhost.

**Privacy:**
- Use it only on people who agreed to be filmed.
- Frames are sent to W&B Inference and are not stored by us. The route never logs or returns the image.
- Only clothing and carried items are described. The prompt forbids age, gender, race, face, hair and body.
- The server drops any line that still contains such a word (`dropped.protected`) and any duplicate line (`dropped.duplicate`).
- Identity is not inferred. Counts are sightings, not unique people.
