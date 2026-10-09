#!/usr/bin/env bash
# Creates the UptimeRobot monitors for auraafit.tech (safe to re-run: existing monitors are kept).
#   ops/uptime.sh        hidden prompt for the UptimeRobot account API key (dashboard -> Integrations -> API)
# The key stays in a shell variable and is sent on stdin to curl, never on a command line or the screen.
# API: https://uptimerobot.com/api/v3/
set -euo pipefail
set +x

API=https://api.uptimerobot.com/v3
SITE=https://auraafit.tech
INTERVAL_S=300
KEYWORD=AURAAFIT

ur_key=""
trap 'stty echo 2>/dev/null || true; unset ur_key' EXIT

ur() { # METHOD PATH [JSON]: sets CODE and BODY
  local resp data=()
  [ -z "${3:-}" ] || data=(--data-binary "$3")
  resp=$(printf 'Authorization: Bearer %s\n' "$ur_key" | curl -sS -m 60 -X "$1" -H @- -H 'Content-Type: application/json' \
    ${data[@]+"${data[@]}"} -w '\n%{http_code}' "$API$2")
  CODE=${resp##*$'\n'}
  BODY=${resp%$'\n'*}
}

stty -echo
printf 'UptimeRobot API key: ' >&2
IFS= read -r ur_key || true
stty echo
printf '\n' >&2
[ -n "$ur_key" ] || { echo "no key entered"; exit 1; }

ur GET /user/me
[ "$CODE" = 200 ] || { echo "FAIL  key rejected (HTTP $CODE)"; exit 1; }
echo "OK    key accepted"

ur GET /user/alert-contacts
contacts=$(printf '%s' "$BODY" | python3 -c 'import json,sys; print(",".join(str(c["id"]) for c in json.load(sys.stdin) if isinstance(c, dict) and "id" in c))')
[ -n "$contacts" ] || echo "WARN  no alert contacts on the account: add your email in the dashboard"

ur GET "/monitors?limit=200"
existing=$BODY

ensure() { # KIND NAME URL [KEYWORD]
  local id body
  id=$(printf '%s' "$existing" | python3 -c '
import json, sys
for m in json.load(sys.stdin).get("data", []):
    if (m.get("url") or "").rstrip("/") == sys.argv[1].rstrip("/") and (m.get("keywordValue") or "") == sys.argv[2]:
        print(m["id"]); break' "$3" "${4:-}")
  if [ -n "$id" ]; then echo "OK    exists: $2 (id $id)"; return; fi
  body=$(python3 -c '
import json, sys
kind, name, url, interval, contacts, kw = sys.argv[1:7]
b = {"friendlyName": name, "url": url, "interval": int(interval), "timeout": 30, "httpMethodType": "GET", "type": "HTTP"}
if kind == "keyword":
    b.update(type="KEYWORD", keywordType="ALERT_NOT_EXISTS", keywordCaseType="CaseSensitive", keywordValue=kw)
ids = [int(x) for x in contacts.split(",") if x]
if ids:
    b["assignedAlertContacts"] = [{"alertContactId": i, "threshold": 0, "recurrence": 0} for i in ids]
print(json.dumps(b))' "$1" "$2" "$3" "$INTERVAL_S" "$contacts" "${4:-}")
  ur POST /monitors "$body"
  case $CODE in
    200 | 201) echo "OK    created: $2" ;;
    *) echo "FAIL  UptimeRobot refused '$2' (HTTP $CODE)"; exit 1 ;;
  esac
}

ensure keyword "AURAAFIT site" "$SITE/" "$KEYWORD"
ensure http "AURAAFIT demo video" "$SITE/assets/videos/store-demo.mp4"
echo "OK    monitors every $((INTERVAL_S / 60)) min: page must contain '$KEYWORD', demo video must load"
