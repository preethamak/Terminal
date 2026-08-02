#!/usr/bin/env bash
set -euo pipefail

pair_file="${HOME}/.vertex/pairing.json"
started_at="$(date +%s)"

if ! command -v systemctl >/dev/null; then
  echo "Vertex pairing needs the systemd user service. Run the Vertex Linux installer first." >&2
  exit 1
fi

systemctl --user restart vertex-agent.service

pair_url=""
for _attempt in $(seq 1 40); do
  pair_url="$(node -e 'const fs=require("fs"); try { const value=JSON.parse(fs.readFileSync(process.argv[1], "utf8")); if (value.createdAt >= Number(process.argv[2]) * 1000 && value.expiresAt > Date.now()) process.stdout.write(value.url); } catch {}' "$pair_file" "$started_at")"
  [[ -n "$pair_url" ]] && break
  sleep 0.25
done

if [[ -z "$pair_url" ]]; then
  echo "Vertex did not create a pairing QR. Check: systemctl --user status vertex-agent.service" >&2
  exit 1
fi

echo "Scan this QR in Vertex on your phone. It expires in 10 minutes."
echo "Or open this pairing link on your phone:"
echo "$pair_url"
if command -v qrencode >/dev/null; then
  qrencode -t ANSIUTF8 "$pair_url"
else
  echo "$pair_url"
fi
