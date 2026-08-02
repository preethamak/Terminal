#!/usr/bin/env bash
set -euo pipefail

vertex_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

if ! command -v node >/dev/null; then
  echo "Node.js 20+ is required. Install Node.js, then run this script again." >&2
  exit 1
fi
if ! command -v tmux >/dev/null; then
  echo "tmux is required. On Debian/Ubuntu: sudo apt install tmux" >&2
  exit 1
fi

cd "$vertex_root"
npm install --omit=dev

mkdir -p "$HOME/.config/systemd/user"
service_file="$HOME/.config/systemd/user/vertex-agent.service"
cat > "$service_file" <<EOF
[Unit]
Description=Vertex remote terminal agent
After=network-online.target

[Service]
Type=simple
WorkingDirectory=$vertex_root
ExecStart=$(command -v node) $vertex_root/agent/server.js
Restart=on-failure
RestartSec=3

[Install]
WantedBy=default.target
EOF

systemctl --user daemon-reload
systemctl --user enable --now vertex-agent.service
echo "Vertex agent installed. Retrieve the pairing token with:"
echo "  journalctl --user -u vertex-agent.service -n 20 --no-pager"
