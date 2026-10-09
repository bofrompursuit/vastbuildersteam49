# Submission form drafts (paste-ready)

Submit at https://tokensand.com/vastnyc ("Submit your project"). Hard deadline 4:30 PM; we aim for 4:00 PM.

## Project name
AURAAFIT

## One-liner
Retail outfit and foot-traffic analytics from street-camera replays: what people wear and carry, with a clip and a W&B Weave trace behind every label.

## Description (about 150 words)
Retailers count heads but not what people wear. AURAAFIT reads outfits from video. It starts from footage indexed in VAST VSS. NVIDIA YOLO11 finds each person, and a W&B Inference vision model labels what they wear and carry: top, bottom, outer layer, bags. A guard filter keeps clothing only, so age, gender, race, face and hair are never output. Every labelling call is traced in W&B Weave. The app replays recorded street cameras, shows the labels on the footage, and turns them into aggregates: colour mix, bag share, heavy outerwear. An AI merchandising agent reads those aggregates and drafts store alerts, calling W&B Inference live with a rule-based fallback. Every number links to its source clip. We iterated the labelling prompt more than ten times against an answer key and report what the model still gets wrong. Demographics are not inferred, by design, and nothing is tracked across cameras.

## Tools used
VAST VSS / VastDB; NVIDIA Cosmos3-Reason, Cosmos Embed1 and YOLO11 (event CoreWeave endpoint); W&B Inference (google/gemma-4-26B-A4B-it); W&B Weave (project vastdata/team-49); Cursor; Next.js, Tailwind.

## How we used VAST / NVIDIA / W&B
- **VAST:** Our team-49 index in VSS / VastDB holds the footage: 612 clips, 3,537 five-second segments, 13 cameras, with Cosmos3-Reason captions, YOLO11 detections and Cosmos Embed1 vectors. We browsed it with Explore, fetched clips through the VSS stream API, and use the original-video reference as the clip receipt for each number. We also tried re-ingest to rewrite captions with our own prompt; it was blocked by a pipeline backlog, which we diagnosed with kubectl and worked around.
- **NVIDIA:** YOLO11 person boxes on the event GPU endpoint, called directly. Cosmos3-Reason (nano reasoner on the event's CoreWeave endpoint) for scene captions and for a 10+ version prompt-iteration loop, scored against an answer key labelled frame-by-frame for one clip (by an AI labeller, spot-checked by eye; not yet a human hand check). Cosmos Embed1 vectors power the semantic footage search in the index.
- **W&B:** W&B Inference vision (google/gemma-4-26B-A4B-it) labels each person crop, about 1.8 seconds per tile. W&B Weave traces every labelling call (prompt version, image, answer) in `vastdata/team-49`, with the published prompt `outfit-prompt-noexample`. The merchandising agent calls W&B Inference live when a key is set.

## Honest limits (optional field / for the judging walk-through)
Footage is a replay of recorded street cameras, not a live store. Counts are person-sightings, not unique people. Accuracy was checked against an answer key labelled frame-by-frame for one clip (by an AI labeller, spot-checked by eye; not yet a human hand check) on one clip, not at scale. Demographics are not inferred.

## Links
- Repo: https://github.com/bofrompursuit/vastbuildersteam49 (branch `alex`; confirm the final branch before submitting)
- Live site: https://auraafit.tech
- Demo video: `<VIDEO LINK: TODO>`
- Weave project: `vastdata/team-49` (add a public trace link if one is available: `<TRACE LINK: TODO>`)

## Team
| Name | Email |
|---|---|
| Tarun Theegela | `<EMAIL: TODO>` |
| Bo Moldenhauer | `<EMAIL: TODO>` |
| Alexander Mong | `<EMAIL: TODO>` |
| Qiman Wang | `<EMAIL: TODO>` |

## Before you hit submit
- [ ] Repo is public and the default branch shows the final README (merge `alex` or point to it)
- [ ] Video link opens without login
- [ ] auraafit.tech loads and shows real data, not the sample file
- [ ] No `.env` or keys in the repo
