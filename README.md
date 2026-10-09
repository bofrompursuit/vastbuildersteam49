# VAST Builders Team 49

Real-Time Video Agents Hack, NYC, Oct 9 2026. Project idea: TBD (see Slack #all-team-49).

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
Next.js (App Router) + Tailwind + Lucide. Live CCTV detection overlay, demographic/outfit extraction feed,
semantic footage search, W&B merchandising agent alerts, and the embedded team dashboard.
Detection data is currently simulated in `src/lib/engine.ts` — swap in real ingestion there.

```bash
npm install
npm run dev        # http://localhost:3000
```
