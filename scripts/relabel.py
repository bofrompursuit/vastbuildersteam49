"""Relabel replay detections with W&B Gemma using a garment-type vocabulary prompt (v2).
Crops each person from the replay mp4 at tSec (bbox in %), pads + upscales, asks for typed garments.
Usage: python relabel.py <repo> <out.json> [limit]"""
import base64, json, os, re, sys, time, collections
from concurrent.futures import ThreadPoolExecutor
import cv2
from openai import OpenAI

REPO, OUT = sys.argv[1], sys.argv[2]
LIMIT = int(sys.argv[3]) if len(sys.argv) > 3 else 0
MODEL = "google/gemma-4-26B-A4B-it"
PROMPT_VERSION = "single-person-outfit-v2-typed"

env = {"WANDB_API_KEY": os.environ.get("WANDB_API_KEY", "")}
for line in (open(os.path.join(REPO, ".env.local"), encoding="utf-8") if os.path.exists(os.path.join(REPO, ".env.local")) else []):
    if "=" in line:
        k, v = line.strip().split("=", 1)
        if v.strip():
            env[k] = v.strip().strip('"')
if not env.get("WANDB_API_KEY"):
    sys.exit("WANDB_API_KEY is empty in .env.local")
os.environ["WANDB_API_KEY"] = env["WANDB_API_KEY"]
client = OpenAI(base_url="https://api.inference.wandb.ai/v1", api_key=env["WANDB_API_KEY"],
                default_headers={"OpenAI-Project": "vastdata/team-49"})

try:
    import weave
    weave.init("vastdata/team-49")
    op = weave.op
    TRACED = True
except Exception as e:  # tracing is optional
    print("weave off:", e)
    op = lambda f: f
    TRACED = False

SYS = (
    "You label clothing for a retail foot-traffic study. You see ONE pedestrian cropped from a street camera. "
    "Describe only clothing and carried items. Never mention age, gender, race, face, hair, skin or body. "
    "Answer with JSON only: {\"top\": \"<colour> <type>\", \"bottom\": \"<colour> <type>\", "
    "\"outer\": \"<colour> <type>\" or \"none\", \"carry\": [\"<colour> <type>\", ...]}.\n"
    "top type, pick the closest: t-shirt, long-sleeve tee, shirt, button-up shirt, polo, blouse, sweater, hoodie, sweatshirt, tank top, dress.\n"
    "outer type (only if a layer is worn over the top): jacket, puffer jacket, coat, trench coat, blazer, denim jacket, leather jacket, vest, cardigan, rain jacket.\n"
    "bottom type: jeans, trousers, chinos, shorts, skirt, leggings, joggers. Use \"unclear\" only if the legs are not visible.\n"
    "carry type: backpack, tote, handbag, shoulder bag, crossbody bag, shopping bag, phone, umbrella, suitcase, box, coffee cup. [] if nothing.\n"
    "Always give a type word from these lists, never a colour alone. Colours: black, white, grey, navy, blue, light blue, red, green, olive, "
    "brown, beige, cream, yellow, orange, pink, purple, patterned."
)

COLOR_WORDS = ["light blue", "navy blue", "black", "white", "grey", "gray", "navy", "blue", "red", "green", "olive", "brown",
               "beige", "cream", "yellow", "orange", "pink", "purple", "patterned", "tan", "khaki", "maroon"]
CANON = {"gray": "Grey", "navy blue": "Navy", "light blue": "Blue", "tan": "Beige", "khaki": "Beige", "maroon": "Red", "olive": "Green"}
HEX = {"Black": "#111827", "White": "#f9fafb", "Grey": "#9ca3af", "Navy": "#1e3a8a", "Blue": "#3b82f6", "Red": "#dc2626",
       "Green": "#16a34a", "Brown": "#7c4a1e", "Beige": "#d6c3a1", "Cream": "#f3ead3", "Yellow": "#facc15", "Orange": "#f97316",
       "Pink": "#f472b6", "Purple": "#7c3aed", "Patterned": "#a78bfa", "Unclear": "#cbd5e1"}
PROTECTED = re.compile(r"\b(man|woman|men|women|male|female|boy|girl|guy|lady|old|young|elderly|teen|skin|hair|face|beard|race|asian|black man|white woman)\b", re.I)


def colour_of(s):
    s = (s or "").lower()
    for w in COLOR_WORDS:
        if re.search(r"\b" + w + r"\b", s):
            return CANON.get(w, w.title())
    return "Unclear"


def aesthetic(top, bottom, outer):
    t = " ".join([top, bottom, outer]).lower()
    if re.search(r"puffer|rain jacket|vest", t): return "Outdoor / Technical"
    if re.search(r"leggings|tank top|joggers", t): return "Athleisure"
    if re.search(r"hoodie|sweatshirt", t): return "Streetwear"
    if re.search(r"blazer|button-up|trench", t): return "Business Casual"
    if re.search(r"blouse|sweater|cardigan|coat|chinos|polo|shirt\b", t) and "t-shirt" not in t: return "Smart Casual"
    return "Casual"


def crop(cap_cache, path, t, bb):
    cap = cap_cache.setdefault(path, None) or cv2.VideoCapture(path)
    cap_cache[path] = cap
    cap.set(cv2.CAP_PROP_POS_MSEC, t * 1000)
    ok, fr = cap.read()
    if not ok:
        return None
    H, W = fr.shape[:2]
    x, y, w, h = bb["x"] / 100 * W, bb["y"] / 100 * H, bb["w"] / 100 * W, bb["h"] / 100 * H
    px, py = w * 0.25, h * 0.08
    x0, y0 = max(0, int(x - px)), max(0, int(y - py))
    x1, y1 = min(W, int(x + w + px)), min(H, int(y + h + py))
    c = fr[y0:y1, x0:x1]
    s = 512 / max(c.shape[:2])
    if s > 1:
        c = cv2.resize(c, None, fx=s, fy=s, interpolation=cv2.INTER_CUBIC)
    return base64.b64encode(cv2.imencode(".jpg", c, [cv2.IMWRITE_JPEG_QUALITY, 92])[1]).decode()


@op
def label_person(tracking_id: str, image_jpeg_b64: str) -> dict:
    r = client.chat.completions.create(
        model=MODEL, temperature=0, max_tokens=200,
        messages=[{"role": "system", "content": SYS},
                  {"role": "user", "content": [{"type": "text", "text": "Label this pedestrian's clothing."},
                                               {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64," + image_jpeg_b64}}]}])
    txt = r.choices[0].message.content or ""
    m = re.search(r"\{.*\}", txt, re.S)
    return json.loads(m.group(0)) if m else {"raw": txt}


def clean(v):
    v = re.sub(r"\s+", " ", str(v or "")).strip().lower()
    return "" if PROTECTED.search(v) else v


data = json.load(open(os.path.join(REPO, "public/data/detections.json"), encoding="utf-8"))
clips = {c["clipId"]: os.path.join(REPO, "public/assets/videos", c["filename"]) for c in data["clips"]}
dets = data["detections"][:LIMIT] if LIMIT else data["detections"]

import threading
local = threading.local()


def work(d):
    cache = getattr(local, "cache", None)
    if cache is None:
        cache = local.cache = {}
    img = crop(cache, clips[d["clipId"]], d["tSec"], d["bbox"])
    if not img:
        return d["trackingId"], None, 0
    t0 = time.time()
    for attempt in range(3):
        try:
            return d["trackingId"], label_person(d["trackingId"], img), time.time() - t0
        except Exception as e:
            err = e
            time.sleep(1 + attempt)
    print("fail", d["trackingId"], err)
    return d["trackingId"], None, 0


t_start = time.time()
with ThreadPoolExecutor(8) as ex:
    res = {tid: (o, s) for tid, o, s in ex.map(work, dets)}
print(f"labelled {len(res)} in {time.time() - t_start:.0f}s")

TYPE_WORDS = re.compile(r"t-shirt|tee|shirt|polo|blouse|sweater|hoodie|sweatshirt|tank|dress|jacket|coat|blazer|vest|cardigan|"
                        r"jeans|trousers|chinos|shorts|skirt|leggings|joggers|backpack|tote|handbag|bag|phone|umbrella|suitcase|box|cup")
changed = typed_before = typed_after = 0
for d in data["detections"]:
    if d["trackingId"] not in res or not res[d["trackingId"]][0] or "raw" in res[d["trackingId"]][0]:
        continue
    o, secs = res[d["trackingId"]]
    old = d["outfit"]
    typed_before += bool(TYPE_WORDS.search(old["top"]))
    top, bottom = clean(o.get("top")) or old["top"], clean(o.get("bottom")) or "unclear"
    outer = clean(o.get("outer")) or "none"
    carry = [c for c in (clean(x) for x in (o.get("carry") or []) if isinstance(o.get("carry"), list)) if c and c != "none"]
    typed_after += bool(TYPE_WORDS.search(top))
    pc = colour_of(outer if outer != "none" else top)
    sc = colour_of(bottom)
    d["outfit"] = {"top": top, "bottom": bottom, "outer": outer, "carry": carry,
                   "primaryColor": pc, "secondaryColor": sc, "primaryHex": HEX.get(pc, "#cbd5e1"), "secondaryHex": HEX.get(sc, "#cbd5e1"),
                   "heavyOuterwear": bool(re.search(r"coat|puffer|parka", outer)), "aesthetic": aesthetic(top, bottom, outer)}
    d["model"] = MODEL
    changed += 1

print(f"changed {changed}; tops naming a garment type: before {typed_before}, after {typed_after} (of {changed})")
if LIMIT:
    for d in dets:
        print(d["trackingId"], "|", d["outfit"]["top"], "|", d["outfit"]["bottom"], "|", d["outfit"]["outer"], "|", d["outfit"]["carry"])
    sys.exit(0)

ds = data["detections"]
n = len(ds)
agg = data["aggregates"]
agg["heavyOuterwearPct"] = round(100 * sum(d["outfit"]["heavyOuterwear"] for d in ds) / n, 1)
buckets = collections.Counter()
for d in ds:
    cs = " ".join(d["outfit"]["carry"]).lower()
    if not cs: buckets["none"] += 1
    for b in ["backpack", "tote", "handbag", "phone", "box"]:
        if b in cs: buckets[b] += 1
    if re.search(r"\bbag\b|shoulder bag|crossbody|shopping bag", cs): buckets["bag"] += 1
agg["carryPct"] = {b: round(100 * buckets[b] / n, 1) for b in ["backpack", "tote", "handbag", "bag", "box", "phone", "none"]}
agg["topColors"] = dict(collections.Counter(d["outfit"]["primaryColor"] for d in ds).most_common())
agg["aesthetics"] = dict(collections.Counter(d["outfit"]["aesthetic"] for d in ds).most_common())
p = data["pipeline"]
p["promptVersion"] = PROMPT_VERSION
p["generatedAt"] = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
p["notes"] = [x for x in p["notes"] if "generic noun" not in x] + [
    "Labels v2: each person is cropped from the replay frame (padded, upscaled) and W&B Gemma must name a garment type from a fixed list; "
    "types on small, distant people are the model's closest match and can be wrong."]
json.dump(data, open(OUT, "w", encoding="utf-8"), ensure_ascii=False, indent=1)
print("wrote", OUT, "traced" if TRACED else "untraced")
