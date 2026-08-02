#!/usr/bin/env bash
set -euo pipefail

vertex_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd -P)"
relay_url="${VERTEX_RELAY_URL:-}"
app_url="${VERTEX_APP_URL:-}"

if [[ -z "$relay_url" || -z "$app_url" ]]; then
  echo "Set VERTEX_RELAY_URL and VERTEX_APP_URL, then run this installer again." >&2
  echo "Example: VERTEX_RELAY_URL=wss://relay.example/v1/connect VERTEX_APP_URL=https://app.example bash scripts/install-linux.sh" >&2
  exit 1
fi
if [[ ! "$relay_url" =~ ^wss://.+/v1/connect$ ]]; then
  echo "VERTEX_RELAY_URL must be a wss:// URL ending in /v1/connect." >&2
  exit 1
fi
if [[ ! "$app_url" =~ ^https://.+ ]]; then
  echo "VERTEX_APP_URL must be an https:// URL." >&2
  exit 1
fi
if ! command -v node >/dev/null; then
  echo "Node.js 20+ is required. Install Node.js, then run this script again." >&2
  exit 1
fi
if ! command -v tmux >/dev/null; then
  echo "tmux is required. On Arch: sudo pacman -S tmux. Then run this script again." >&2
  exit 1
fi
if ! command -v systemctl >/dev/null; then
  echo "This installer requires systemd user services." >&2
  exit 1
fi

node_path="$(command -v node)"
cd "$vertex_root"
npm install --omit=dev

config_root="${XDG_CONFIG_HOME:-$HOME/.config}/vertex"
service_root="${XDG_CONFIG_HOME:-$HOME/.config}/systemd/user"
env_file="$config_root/agent.env"
service_file="$service_root/vertex-agent.service"
umask 077
mkdir -p "$config_root" "$service_root"
printf 'VERTEX_RELAY_URL=%s\nVERTEX_APP_URL=%s\nNODE_ENV=production\n' "$relay_url" "${app_url%/}" > "$env_file"
chmod 600 "$env_file"

printf '%s\n' \
  '[Unit]' \
  'Description=Vertex remote terminal agent' \
  'Wants=network-online.target' \
  'After=network-online.target' \
  '' \
  '[Service]' \
  'Type=simple' \
  "WorkingDirectory=$vertex_root" \
  "EnvironmentFile=$env_file" \
  "ExecStart=$node_path $vertex_root/agent/server.js" \
  'Restart=always' \
  'RestartSec=3' \
  '' \
  '[Install]' \
  'WantedBy=default.target' > "$service_file"

systemctl --user daemon-reload
systemctl --user enable --now vertex-agent.service
echo "Vertex agent is installed and running."
echo "Status: systemctl --user status vertex-agent.service"
echo "Logs:   journalctl --user -u vertex-agent.service -f"
echo "Update: cd $vertex_root && git pull && VERTEX_RELAY_URL=$relay_url VERTEX_APP_URL=${app_url%/} bash scripts/install-linux.sh"
echo "To keep the agent available after logging out, run once: loginctl enable-linger $USER"
