# Integrating the `alex` branch into AURAAFIT (for Bo and Tarun)

**What this branch is:** Bo's `domain` app (commit `16a8c14`) plus real data and honest wiring. It builds cleanly (`npm run build`) and was tested locally.

## What changed
- **Real data:** `public/data/detections.json` contains 214 person-sightings from 3 event clips in our VAST VSS archive:
  - sf_streets_cam-2 chunks 17 and 19;
  - nyc_streets_cam-1 chunk 13.

  Boxes come from YOLO11 (the event GPU endpoint, called directly). Per-person outfit labels come from W&B Inference `google/gemma-4-26B-A4B-it`, and every call is traced in W&B Weave (`vastdata/team-49`). The shape is in `src/lib/realTypes.ts`.
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
