# AURAAFIT voice-over for ElevenLabs (matches `auraafit_broll_3min.webm`)

The text is written for text-to-speech:
- Numbers and acronyms are spelled the way they should sound ("Aura-fit", "YOLO eleven", "V-S-S").
- `<break time="…"/>` tags add pauses. ElevenLabs supports them, up to 3 seconds each.

**Settings that sound professional:**
- Voice: a calm narrator, for example "Brian", "Adam" or "Rachel", or any "Narration" voice.
- Model: Multilingual v2.
- Stability about 50%, Similarity about 75%, Style 0 to 10%, Speaker boost on, Speed 1.0.

**Best way to line it up:** generate the 8 segments separately, then drop each one into your editor at its **Start** time over the video. Every segment is shorter than its scene, so nothing overlaps. If a segment runs long, raise the speed to 1.05–1.1 for that segment only.

---

### 1. Hook: start 0:00 (scene is 15 s)
Stores count foot traffic. But they can't see what the street is wearing. <break time="0.4s"/> Aura-fit turns street-camera video into outfit analytics a merchandiser can act on, <break time="0.2s"/> without guessing who anyone is.

### 2. Replay: start 0:15 (40 s)
This is a replay of recorded street cameras from the event's VAST archive, in San Francisco and New York. <break time="0.4s"/> YOLO eleven, running on the event GPU, finds each person and follows them through the clip. <break time="0.3s"/> For every person, we crop the image, and Weights and Biases Inference, using Gemma four vision, names what they're wearing: <break time="0.2s"/> a black jacket over a sweatshirt, grey jeans, a backpack and a phone. <break time="0.4s"/> Each sighting becomes a structured row on the right. <break time="0.3s"/> Age, gender, height and fit are not inferred, by design.

### 3. Cosmos: start 0:55 (20 s)
Under the video is NVIDIA Cosmos three Reason. <break time="0.3s"/> On top, its scene caption from our VAST V-S-S index. Below, a Cosmos pass with our fashion prompt. <break time="0.3s"/> Cosmos describes the scene. Weights and Biases labels each person.

### 4. Weave trace: start 1:15 (20 s)
Every label is traced in Weights and Biases Weave: <break time="0.2s"/> the exact crop the model saw, the prompt, and the answer. <break time="0.3s"/> Our first prompt allowed colour-only answers. Requiring a real garment took typed labels from forty-nine to two hundred thirteen, out of two hundred fourteen.

### 5. Search: start 1:35 (20 s)
Because the labels are structured, a buyer can search them. <break time="0.3s"/> Searching "backpack" returns every matching track, each with its clip and timestamp in VAST: <break time="0.2s"/> a receipt you can check against the footage.

### 6. Merchandising agent: start 1:55 (25 s)
The merchandising agent reads the totals, never the raw video. <break time="0.3s"/> Thirty-two percent of sightings carry a backpack, so it suggests putting carry accessories near the entrance. <break time="0.3s"/> Smart casual leads, so it says to re-set the front table. <break time="0.3s"/> In this deployment, the agent runs on its rule-based fallback.

### 7. Dashboard: start 2:20 (25 s)
The dashboard rolls it all up: <break time="0.2s"/> two hundred fourteen person-sightings across three clips, the colour mix, aesthetics, what people carry, and confidence for each clip, <break time="0.2s"/> with a one-click CSV export. <break time="0.3s"/> These are sightings, not unique people.

### 8. Close: start 2:45 (15 s)
Who buys this? Retailers, landlords, and business districts deciding what to stock or lease on a block. <break time="0.4s"/> Next step: a consenting storefront camera, over repeated days. <break time="0.5s"/> Aura-fit. <break time="0.3s"/> What the street is wearing, without knowing who's wearing it.

---

## One-take version (paste as a single generation)
Use this if you'd rather not edit 8 clips together. The long breaks pad each scene to its time. Natural speaking speed varies a little, so check the alignment at the Cosmos, Weave and Dashboard cuts, and nudge the audio there if needed.

Stores count foot traffic. But they can't see what the street is wearing. <break time="0.4s"/> Aura-fit turns street-camera video into outfit analytics a merchandiser can act on, <break time="0.2s"/> without guessing who anyone is. <break time="3s"/>

This is a replay of recorded street cameras from the event's VAST archive, in San Francisco and New York. <break time="0.4s"/> YOLO eleven, running on the event GPU, finds each person and follows them through the clip. <break time="0.3s"/> For every person, we crop the image, and Weights and Biases Inference, using Gemma four vision, names what they're wearing: <break time="0.2s"/> a black jacket over a sweatshirt, grey jeans, a backpack and a phone. <break time="0.4s"/> Each sighting becomes a structured row on the right. <break time="0.3s"/> Age, gender, height and fit are not inferred, by design. <break time="2s"/>

Under the video is NVIDIA Cosmos three Reason. <break time="0.3s"/> On top, its scene caption from our VAST V-S-S index. Below, a Cosmos pass with our fashion prompt. <break time="0.3s"/> Cosmos describes the scene. Weights and Biases labels each person. <break time="3s"/>

Every label is traced in Weights and Biases Weave: <break time="0.2s"/> the exact crop the model saw, the prompt, and the answer. <break time="0.3s"/> Our first prompt allowed colour-only answers. Requiring a real garment took typed labels from forty-nine to two hundred thirteen, out of two hundred fourteen. <break time="2.5s"/>

Because the labels are structured, a buyer can search them. <break time="0.3s"/> Searching "backpack" returns every matching track, each with its clip and timestamp in VAST: <break time="0.2s"/> a receipt you can check against the footage. <break time="3s"/>

The merchandising agent reads the totals, never the raw video. <break time="0.3s"/> Thirty-two percent of sightings carry a backpack, so it suggests putting carry accessories near the entrance. <break time="0.3s"/> Smart casual leads, so it says to re-set the front table. <break time="0.3s"/> In this deployment, the agent runs on its rule-based fallback. <break time="2s"/>

The dashboard rolls it all up: <break time="0.2s"/> two hundred fourteen person-sightings across three clips, the colour mix, aesthetics, what people carry, and confidence for each clip, <break time="0.2s"/> with a one-click CSV export. <break time="0.3s"/> These are sightings, not unique people. <break time="2.5s"/>

Who buys this? Retailers, landlords, and business districts deciding what to stock or lease on a block. <break time="0.4s"/> Next step: a consenting storefront camera, over repeated days. <break time="0.5s"/> Aura-fit. <break time="0.3s"/> What the street is wearing, without knowing who's wearing it.
