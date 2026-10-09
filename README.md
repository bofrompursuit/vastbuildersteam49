# AURAAFIT

**What the street is wearing, without knowing who's wearing it.**

AURAAFIT turns street-camera video into outfit analytics a merchandiser can act on. Built by Team 49 at the VAST Data Builders Challenge: Real-Time Video Agents Hack, NYC, October 9, 2026.

**Live site: [auraafit.tech](https://auraafit.tech)** · Demo video: `<VIDEO LINK: TODO>` · App code: [`domain` branch](https://github.com/bofrompursuit/vastbuildersteam49/tree/domain)

![AURAAFIT home page](docs/screenshots/hero.jpg)

Stores count foot traffic, but they can't see what the street is wearing. AURAAFIT reports what people wear and carry (top, bottom, outer layer, bags) as anonymous totals: which colours dominate, how many people carry a backpack, how many wear heavy outerwear. A merchandising agent turns those totals into store actions. Every number links back to a clip in the VAST VSS index, and every label comes from a model call traced in W&B Weave.

The footage is a **replay of recorded street cameras** from the event archive (San Francisco and New York), not a live store feed. Age, gender, height and fit are **not inferred**, by design.

**Who it's for:** retailers, landlords and business districts deciding what to stock or lease on a block.

## Try it

Open **[auraafit.tech](https://auraafit.tech)**. It works in any modern browser and needs no login.

1. **Replay:** click **Open the replay**. YOLO11 finds each person and follows them through the clip, and each box carries the outfit label from W&B Inference vision, for example "black jacket over black sweatshirt". The feed on the right turns every sighting into a structured row.
2. **Cosmos captions:** under the video is the NVIDIA Cosmos3-Reason scene caption for the 5-second piece that is playing, from our VAST VSS index. Below it is a direct Cosmos3 pass with our fashion prompt. Cosmos describes the scene; W&B labels each person.
3. **Outfit Search:** because the labels are structured, you can search them. Try "backpack" or "black jacket and jeans". Each match comes with its clip and timestamp in VAST: a receipt you can check against the footage.
4. **Merchandising Suggestions:** the agent reads the totals, never the raw video. For example, 32% of sightings carry a backpack, so it suggests putting carry accessories near the entrance.
5. **Dashboard:** 214 person-sightings across 3 clips, with colour mix, style mix, carried items and confidence for each clip. **Export detections CSV** downloads the raw rows.

![Replay with YOLO11 boxes, outfit labels and Cosmos3 captions](docs/screenshots/replay.jpg)

![Analytics dashboard](docs/screenshots/dashboard.jpg)

## How it works

1. **Index:** the event footage is already indexed in VAST VSS (VastDB): 612 clips, 3,537 five-second segments, 13 cameras.
2. **Fetch:** clips come through the VSS stream API.
3. **Detect:** NVIDIA YOLO11 on the event GPU endpoint finds a box for each person.
4. **Label:** each person is cropped, and W&B Inference vision (Gemma 4, `google/gemma-4-26B-A4B-it`) names the garments and carried items.
5. **Trace:** every labelling call is traced in W&B Weave (`vastdata/team-49`): the exact crop the model saw, the prompt, and the answer. Our first prompt allowed colour-only answers like "black top". Requiring a real garment type took typed labels from 49 to 213 out of 214.
6. **Guard:** a filter keeps clothing and carried items only, and drops any age, gender, race, face or hair words.
7. **Serve:** the results feed the Next.js app, its charts, the search and the merchandising agent.

## Sponsor tools used

| Tool | What we used it for |
|---|---|
| **VAST VSS / VastDB** | Index of the event footage: captions, detections and vectors. Every number links to its source clip. |
| **NVIDIA Cosmos3-Reason** | Scene captions in the index, plus direct calls while iterating on our prompt (10+ versions). |
| **NVIDIA Cosmos Embed1** | Video vectors behind the index's semantic footage search. |
| **NVIDIA YOLO11** | Person detection on the event GPU endpoint. |
| **W&B Inference** (CoreWeave) | Gemma 4 vision model that labels each person crop; can also power the merchandising agent. |
| **W&B Weave** | Traces every labelling call: prompt version, image and answer. |

Also: Next.js, Tailwind CSS, Vercel, Cursor.

## Privacy and honest limits

- **Clothing and carried items only.** No demographics, no faces, and no tracking across cameras.
- **Counts are person-sightings, not unique people.** The same person can appear in several frames.
- **Labels are model output, not hand-checked.** We scored prompt versions against an answer key for one clip only, not at scale.
- **The merchandising agent runs on its rule-based fallback in this deployment.** With `WANDB_API_KEY` set on the server it calls W&B Inference live; the panel always says which.

**Next step:** a consenting storefront camera, over repeated days.

## Run it locally

```bash
git clone https://github.com/bofrompursuit/vastbuildersteam49.git
cd vastbuildersteam49
git checkout domain
git lfs pull          # replay videos are stored with Git LFS
npm install
npm run dev           # http://localhost:3000
```

Optional: put `WANDB_API_KEY` in `.env.local` so the merchandising agent calls W&B Inference live. Never commit it.

## Deployment

Every push to `domain` runs lint and build in GitHub Actions, deploys to Vercel, and smoke-tests [auraafit.tech](https://auraafit.tech). UptimeRobot checks the site every 5 minutes.

## More detail

On the [`domain` branch](https://github.com/bofrompursuit/vastbuildersteam49/tree/domain):
- [README](https://github.com/bofrompursuit/vastbuildersteam49/blob/domain/README.md): full pipeline, what's real vs demo, and what we learned
- [Demo script](https://github.com/bofrompursuit/vastbuildersteam49/blob/domain/docs/DEMO_SCRIPT.md)
- [API notes](https://github.com/bofrompursuit/vastbuildersteam49/blob/domain/docs/API_NOTES.md)

## Team 49

- Tarun Theegela
- Bo Moldenhauer
- Alexander Mong
- Qiman Wang
