# AURAAFIT: 3-minute demo script and scene plan

About 400 words of voice-over (a calm 140 words per minute). Record from **https://auraafit.tech** at 1920×1080, browser zoom 100%, with bookmarks and extensions hidden.

**Wording rules:**
- Footage is always a "replay of recorded street cameras", never "live" or "real-time".
- Counts are "person-sightings", never "shoppers".
- Say a number only while it is on screen.

**Assets (in `demo_assets/` next to the repo):**
- `stills/01…08` are full-HD screenshots, one per scene.
- `broll/auraafit_broll_3min.webm` is a timed screen recording that follows the beats below. You can voice straight over it, or use it as a guide for your own take.
- The Weave beat needs a short screen recording from wandb.ai, because it needs your login.

| # | Time | Scene (what's on screen) | Still | Voice-over |
|---|---|---|---|---|
| 1 | 0:00–0:15 | **Hook.** Hero section; the cursor rests on "214 person-sightings". | 01_hero | "Stores count footfall. They can't see what the street is wearing. AURAAFIT turns street-camera video into outfit analytics a merchandiser can act on, without guessing who anyone is." |
| 2 | 0:15–0:55 | **Replay.** Scroll to the replay. Let the San Francisco clip play with boxes and labels; the outfit feed scrolls on the right. Optional: a slow zoom-in on two labelled people. | 02_replay_boxes, 03_replay_closeup | "This is a replay of recorded street cameras from the event's VAST archive, San Francisco and New York. YOLO11, on the event GPU, finds each person and follows them through the clip. For every person we crop the image, and W&B Inference, Gemma 4 vision, names what they wear: a black jacket over a sweatshirt, grey jeans, a backpack and a phone. Those labels ride on the boxes, and each sighting becomes a structured row on the right. Age, gender, height and fit are not inferred, by design." |
| 3 | 0:55–1:15 | **Cosmos.** Scroll a little to the caption panel under the video. | 04_cosmos_panel | "Under the video is NVIDIA Cosmos3-Reason. The top text is the scene caption from our VAST VSS index; below it is a fresh Cosmos3 pass with our fashion prompt. Cosmos describes the scene, W&B labels each person, and the two agree on the trend: dark layers and backpacks." |
| 4 | 1:15–1:35 | **Weave trace** (insert recording). wandb.ai → `vastdata/team-49` → Traces → one `label_person` call: the crop, the prompt, the answer. | (record live) | "Every label is traced in W&B Weave. Here's one call: the exact crop the model saw, the prompt, and the answer. Our first prompt let the model answer with just a colour, 'black top'. We changed it to name a garment from a fixed list, and typed labels went from 49 to 213 out of 214." |
| 5 | 1:35–1:55 | **Search.** Type "backpack" in Outfit Search and press Search; the result cards show clip and timestamp. | 05_search | "Because the labels are structured, a buyer can search them. 'Backpack' returns the matching tracks, each with its clip and timestamp in VSS: a receipt you can check against the footage." |
| 6 | 1:55–2:20 | **Agent.** The Merchandising Suggestions card; hover each insight. | 06_feed_and_agent | "The merchandising agent reads the aggregates, never the raw video. Thirty-two percent of sightings carry a backpack, so it suggests putting carry accessories near the entrance. Smart Casual leads, so re-set the front table. In this deployment the agent runs on its rule-based fallback; with a key set, it calls W&B Inference." |
| 7 | 2:20–2:45 | **Dashboard.** Scroll to Section 02: the KPI tiles, colour bar, aesthetic and carry bars, the per-clip table, then Export CSV. | 07_dashboard, 08_dashboard_detail | "The dashboard rolls it up: 214 person-sightings across three clips, colour mix, aesthetics, what people carry, and per-clip confidence, with a CSV export. These are sightings, not unique people: each five-second piece is tracked on its own." |
| 8 | 2:45–3:00 | **Close.** Scroll back to the hero. Optional end card: "AURAAFIT · Team 49 · auraafit.tech". | 01_hero | "Who buys this: retailers, landlords and business districts deciding what to stock or lease on a block. Next step: a consenting storefront camera over repeated days. AURAAFIT: what the street is wearing, without knowing who's wearing it." |

## Sponsor tech, as said on screen
- **VAST:** the VSS archive and index the clips come from (clip receipts in the search cards).
- **NVIDIA:** Cosmos3-Reason scene captions, and a direct Cosmos3 pass. YOLO11s on the event GPU.
- **W&B:** Inference (Gemma 4 vision) for every per-person label; Weave traces on every call.

## If a judge asks
- **Why not live?** The YOLO and Cosmos servers are reachable only inside the lab network, so the public site replays precomputed results. W&B is the only part called from the site itself.
- **Why not put Cosmos text on the boxes?** Cosmos describes the whole 5-second piece and numbers its own people, so its lines can't be tied to a specific box. W&B labels are made per box.
- **Accuracy?** Labels are model output. Garment types on small, distant people are the model's closest match and can be wrong. No hand check yet.
- **Privacy:** clothing and carried items only. No age, gender, race or face. No tracking across cameras. Aggregates only.

## Recording checklist
1. Open auraafit.tech and wait for "214" to appear in the hero (data loaded).
2. Set replay speed to 1×.
3. Pre-open the Weave trace in a second tab.
4. Don't show any frame with a large, clearly visible face.
5. Record one full pass; if it runs over 3:00, trim scene 3 or 5 first.
