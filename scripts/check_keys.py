"""Smoke test: confirms NVIDIA and CoreWeave/W&B keys work. Prints status only, never keys. Stdlib only."""
import json, os, pathlib, urllib.request, urllib.error

env = pathlib.Path(__file__).resolve().parent.parent / ".env"
if env.exists():
    for line in env.read_text().splitlines():
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1)
            os.environ.setdefault(k.strip(), v.strip())

def get_models(name, url, key, extra=None):
    if not key:
        return print(f"{name}: MISSING key in .env")
    req = urllib.request.Request(url, headers={"Authorization": f"Bearer {key}", **(extra or {})})
    try:
        data = json.load(urllib.request.urlopen(req, timeout=20))
        ids = sorted(m["id"] for m in data.get("data", []))
        print(f"{name}: OK, {len(ids)} models")
        for i in ids:
            if any(t in i.lower() for t in ("cosmos", "vl", "vision", "video", "qwen", "llama")):
                print("   ", i)
    except urllib.error.HTTPError as e:
        print(f"{name}: HTTP {e.code} {e.reason}")
    except Exception as e:
        print(f"{name}: {type(e).__name__}: {e}")

get_models("NVIDIA", "https://integrate.api.nvidia.com/v1/models", os.getenv("NVIDIA_API_KEY"))
get_models("CoreWeave/W&B", "https://api.inference.wandb.ai/v1/models", os.getenv("WANDB_API_KEY"),
           {"OpenAI-Project": os.getenv("WANDB_PROJECT", "")})
