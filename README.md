# VAST Builders Team 49

Real-Time Video Agents Hack, NYC, Oct 9 2026 (VAST Data Builders Challenge). Project: **AURAAFIT**, retail outfit and foot-traffic analytics built on the event's video stack. Live site: https://auraafit.tech

## Team
- Tarun Theegela
- Bo Moldenhauer
- Alexander Mong
- Qiman Wang

## Setup
```bash
cp .env.example .env     # fill in your own keys; never commit .env
python3 scripts/check_keys.py
```
- NVIDIA key: https://build.nvidia.com
- CoreWeave / W&B Inference key: https://forge.coreweave.com/settings (API base `https://api.inference.wandb.ai/v1`)
- Official challenge repo: https://github.com/vast-data/vast-builders-challenge

## Submission checklist (deadline 4:30 PM)
- [ ] Public repo (this one)
- [ ] Demo video link
- [ ] Description + tools used
- [ ] Names + emails
- [ ] Optional: live site, screenshot

## App: AURAAFIT

AURAAFIT turns street-camera footage into retail intelligence. Most foot-traffic tools count heads; AURAAFIT also reports what people wear and carry (top, bottom, outer layer, bags) as anonymous aggregates: which colours dominate, how many people carry backpacks or shopping bags, how many wear heavy outerwear. Every number links back to a clip in the VAST VSS index, and every label was made by a model call that is recorded in W&B Weave. An AI merchandising agent reads those aggregates and drafts store-level alerts (for example, what to stock or put in the window). The footage is a **replay of recorded street cameras** from the event archive, not a live store feed. Age, gender and other demographics are **not inferred**, by design.

### Sponsor tools used
| Tool | What we used it for |
|---|---|
| **VAST VSS / VastDB** | Our team's index of event footage: 612 clips, 3,537 five-second segments, 13 cameras. Stores Cosmos3-Reason captions, YOLO11 detections and Cosmos Embed1 vectors. Clips are fetched through the VSS stream API; VSS Explore gives the "clip receipt" for each number. |
| **NVIDIA Cosmos3-Reason** (nano reasoner on the event's CoreWeave endpoint) | Scene captions in the index, and direct calls for our prompt-iteration loop (10+ prompt versions). |
| **NVIDIA Cosmos Embed1** | The video vectors in the VSS index that power semantic footage search. |
| **NVIDIA YOLO11** | Person detection on the event GPU endpoint, called directly. Gives the boxes that become per-person crops. |
| **W&B Inference** (CoreWeave) | Vision model `google/gemma-4-26B-A4B-it` labels each person crop (about 1.8 s per tile in our measurement). Also powers the live merchandising agent when a key is set. |
| **W&B Weave** | Every labelling call is traced in project `vastdata/team-49`, with the published prompt `outfit-prompt-noexample`. Trace = prompt version, image, answer. |
| **Cursor** | The IDE the team built in, with the organizer's skills for working against VSS. |

### How the data is produced
1. **Index.** Event footage is already indexed in VAST VSS (VastDB). We pick clips from our team-49 archive with a local catalogue of captions and detections.
2. **Fetch.** Clips are pulled through the VSS stream API onto the lab VM.
3. **Detect.** YOLO11 finds person boxes in sampled frames (we call the event's detector endpoint directly).
4. **Crop and tile.** Each person box becomes a crop; far scenes are also cut into quadrant tiles so small people stay readable.
5. **Label.** W&B Inference vision (`google/gemma-4-26B-A4B-it`) returns an outfit line per person: top, bottom, outer layer, what they carry. The call is traced in W&B Weave.
6. **Guard.** A filter keeps clothing and carried items only. It drops protected words (age, gender, race, face, hair) and repeated duplicate lines.
7. **Write.** One row per person-sighting goes to `public/data/detections.json` (shape in `src/lib/realTypes.ts`), together with clip metadata and aggregates. The app reads that file. The merchandising agent reads the aggregates.

### What's real vs demo
| Part | Status |
|---|---|
| Footage and the VSS index (612 clips, 13 cameras) | **Real.** Event-provided footage, indexed in our team's VSS. |
| Playback in the app | **Replay** of recorded street cameras. Not a live feed, not a store. |
| Person boxes (YOLO11) | **Real.** Run on the event GPU endpoint. |
| Outfit labels per person | **Real.** Model output from W&B Inference vision, traced in Weave. Not hand-corrected. |
| Counts | **Person-sightings per sampled frame, not unique people.** The same person can appear in several frames. |
| Aggregates (colours, carry share, heavy outerwear) | **Real**, computed from the labels in `detections.json`. Small samples; they describe these clips, not "the city". |
| Style category (e.g. Streetwear, Business Casual) | **Rule-derived** from the garment words, not a separate model judgement. |
| Merchandising agent | Calls **W&B Inference live** when a key is set; otherwise a **rule-based fallback** writes the alert. |
| Demographics | **Not inferred.** Fields are `null` by design. |
| Accuracy check | We scored prompt versions against an answer key for **one clip** (labelled from frames by an AI labeller and spot-checked by eye, not yet a human hand check) (sf2 chunk 17). We have not measured accuracy across the whole dataset. |
| Re-ingest (rewriting VSS captions with our prompt) | **Not done.** Blocked by a pipeline backlog (see below). Our labels live in our own file, not in VSS captions. |
| Cross-camera tracking, store entry, dwell time | **Not built, on purpose or for time.** |

### Privacy by design
- **Clothing and carried items only.** The label prompt and the guard filter never output age, gender, race, face or hair. In our tests, stock captions used gender/age words in about 22 to 48 percent of segments on the cameras we checked, so the guard is needed, not decorative.
- **No demographics.** The `demographics` field is always `null`.
- **No cross-camera re-identification.** A track ID exists within one clip only. Following a person between cameras by outfit would be surveillance, so we do not build it.
- **Aggregates, not individuals.** The agent and the dashboard work from counts and shares. Crops are working material for labelling, not a product.

### What we learned
**Prompting the vision model (10+ versions, direct Cosmos3 calls, scored against an answer key for one clip):**
- Cap the list at 4 to 6 people per call. At 8 the model repeated identical lines; it fills whatever quota it is given.
- A concrete example line helps on close, bright scenes but gets copied verbatim on far or hard scenes. A prompt with no example never leaked but missed more objects.
- Moving the rules into a system message did not help.
- Distance is the real limit, not wording. Far people turn into "black top, black trousers". Quadrant tiles (16:9) gave much finer detail and honest "no people" answers on empty tiles; half-width crops broke colours.
- W&B Inference vision (Gemma) matched or beat Cosmos on our one-clip check, and bound carried items to the right person more often. So Cosmos handles scene captions and search; W&B vision does the per-person labels.
- A guard filter is needed after any prompt (duplicates, protected words that still slip through).

**Re-ingest:** we tried to rewrite VSS captions with our prompt. A teammate accidentally re-ingested whole videos, and the backlog saturated the pipeline's detector pods (1 of 2 ready, readiness timeouts). We diagnosed this with kubectl and worked around it by calling the YOLO and Cosmos endpoints directly.

**Honest limits:** the vision model prefers "trousers" over "jeans", sometimes repeats the top in the outer-layer field, and over-assigns backpacks. Accuracy was checked by eye on a small sample, not at scale.

### Run it
```bash
npm install
npm run dev        # http://localhost:3000
```
The app reads `public/data/detections.json` (shape: `src/lib/realTypes.ts`; `public/data/detections.sample.json` is a sample of the format). Set the W&B key in `.env` to let the merchandising agent call W&B Inference live; without it the rule-based fallback runs.

See also: [`docs/DEMO_SCRIPT.md`](docs/DEMO_SCRIPT.md) (3-minute demo) and [`docs/SUBMISSION.md`](docs/SUBMISSION.md) (submission form text).
