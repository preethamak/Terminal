# Vertex feasibility spike

Vertex proves one thing first: an Android phone can attach to a persistent `tmux` session on a Linux laptop and use it as a real terminal. Commands run only on the laptop.

## What exists now

- Node.js Linux agent with a token-protected HTTP/WebSocket protocol.
- Persistent named sessions backed by `tmux`.
- Switch directly between persistent terminals from the live terminal view; the work continues untouched on the laptop.
- First-class real terminal launcher: choose a project, open a persistent shell, then run any command or developer CLI yourself from the phone.
- Continuation-first home: existing tmux terminals and regular laptop folders appear alongside Git projects; create a new folder and optional Git repository from the phone, then open its persistent terminal.
- Mobile-first PWA served by the laptop agent, with an **AI tasks first** home screen, xterm.js terminal, mobile Ctrl/Esc/Tab/pipe/slash/arrow key row, and terminal pinch/text-size zoom.
- Codex and Claude Code task launchers: pick a project, enter a task, and Vertex starts the CLI in a persistent tmux session.
- Task lifecycle tracking: task cards move from running to completed/failed while the terminal remains available for inspection or follow-up.
- Local AI attention detection: Vertex watches managed tmux tasks on the laptop for approval-like prompts and surfaces an encrypted **needs input** card on the phone. The terminal remains the source of truth.
- In-app activity inbox: task starts, completions, failures, and attention requests remain stored privately on the laptop and are shown on the phone after reconnecting.
- Project search, Git diff review, task pin/archive, session rename/stop, terminal search/copy/paste, laptop health, and paired-device revocation.
- Project file browser with mobile text previews. It is constrained to discovered Git project roots, hides hidden/dependency folders, and refuses binary or oversized files.
- Read-only Git workspace view: branch, changed-file list, and diff summary. Commits and pushes remain deliberate terminal actions.
- Read-only Docker view: container state and bounded recent logs. Container changes remain deliberate terminal actions.
- Optional sleep inhibition: by default, a Vertex-managed task keeps the laptop awake only while its command is executing. Change it from the Account screen; remote wake remains intentionally out of scope.
- Android reconnects to the same session after the app is closed; the agent never kills the underlying `tmux` session.
- Ten-minute QR pairing creates a revocable per-device token.
- Git diff review for each managed task, with an approve/needs-changes review record.
- In-app activity notifications when a watched task changes from running to completed, failed, or needs attention.
- A visible Account → Setup & test screen that shows ready/needs-setup status and can send a safe encrypted in-app activity test.
- **Travel Mode**: a confirmed laptop heartbeat, battery, disk-free space, agent uptime/version, relay reconnect count, and locally persisted agent restart history. It can hold a Linux sleep inhibitor while you are away, and reports an unavailable inhibitor rather than pretending the laptop is protected.
- Active Work cards put AI approvals, running Codex/Claude tasks, and stopped Docker containers before generic terminal lists.
- Checkpoints are short handoff notes saved privately on the laptop against a task or terminal, so an interrupted trip does not lose context.
- New Workspace can create a folder, initialise Git, and immediately launch a real terminal, Codex, or Claude session.
- Phone uploads are limited to a selected Vertex workspace, supported text/code/image/PDF files, and 5 MiB. Vertex refuses path traversal and never uploads a file to its relay.
- Account includes paired-device revocation and an emergency remote lock. The lock can only be removed locally on the laptop with `npm run unlock`.

The repository contains an outbound laptop relay client, an encrypted browser relay client, and a Cloudflare Durable Object relay source. The relay carries AES-GCM encrypted frames only; it does not receive terminal text. Vercel, Cloudflare, and Nativine conversion are ready for personal beta. Reliable operating-system push and biometric unlock need native Firebase/Nativine configuration; see [notifications setup](docs/notifications.md).

## Run the Linux agent

Install `tmux`, `qrencode`, and Node.js on the Linux laptop. On Arch Linux:

```bash
sudo pacman -Syu tmux qrencode
```

The current direct-agent mode is a development-only prototype. The product path replaces it with a Vertex relay, hosted web app, and branded Nativine mobile app. Do not treat Tailscale or direct laptop URLs as the intended customer setup.

```bash
npm install
npm start
```

The agent finds your laptop’s local Wi-Fi address and prints a QR valid for ten minutes. Scan it with the Android camera to pair without pasting an SSH key or password. If required, override the URL with `VERTEX_PAIR_URL=http://your-address:8787 npm start`.

## What is ready for later deployment

Build the hosted app with:

```bash
npm run build
```

This creates `dist/`, which Vercel can deploy as a static web app. The production relay source is in `relay/worker.js`; it is designed for Cloudflare Workers + Durable Objects. For local engineering only, `npm run relay:dev` starts an equivalent relay on your laptop. When you later have a Cloudflare URL, start the agent with:

```bash
VERTEX_RELAY_URL=wss://your-relay.example/v1/connect VERTEX_APP_URL=https://your-vercel-app.vercel.app npm start
```

The printed QR then pairs your phone through Vertex’s encrypted relay. No Tailscale, shared Wi-Fi, SSH port, or direct laptop address is involved.

For a user service, run:

```bash
VERTEX_RELAY_URL=wss://vertex-relay.arc-terminal.workers.dev/v1/connect \
VERTEX_APP_URL=https://vertex-cyan-phi.vercel.app \
bash scripts/install-linux.sh
```

This installs a `systemd --user` service and keeps the two public URLs in `~/.config/vertex/agent.env` with owner-only permissions. Vertex starts automatically when you log in, restarts if it fails, and preserves the existing device pairing and tmux sessions. Check it with `systemctl --user status vertex-agent.service`, follow its logs with `journalctl --user -u vertex-agent.service -f`, and stop it with `systemctl --user disable --now vertex-agent.service`.

## Travel Mode and travel preflight

Travel Mode is a sleep-prevention layer, not remote wake. Turn it on in the Vertex home dashboard before leaving; it runs `systemd-inhibit` on the laptop and Vertex shows whether that process is actually active. It protects a laptop that is already running, but cannot wake a machine after power loss, hibernation, a BIOS reboot, or a disconnected router.

Before travelling, keep the laptop on AC power, configure its desktop power settings to **not suspend on AC**, and either leave its lid open or set lid-close to **Do nothing**. Run a mobile-data test from the phone before leaving. For work launched outside Vertex, start it inside tmux so it remains resumable:

```bash
tmux new -s work -c ~/Projects/your-project
```

If you use **Lock Vertex** from the phone, all paired devices are immediately rejected. On the laptop, run this exact local command to restore them:

```bash
cd ~/vertex && npm run unlock
```

To pair a phone after installing the service, run this one command on the laptop. It restarts the agent and prints a fresh QR and a clickable pairing link, both valid for ten minutes:

```bash
cd ~/vertex && npm run pair
```

To keep the service available after you log out, run `loginctl enable-linger $USER` once. This is optional; it only controls the user service lifecycle and does not wake a sleeping laptop.

## Open it on Android

On the Android phone, scan the QR or open the URL shown in the terminal. Use the browser’s **Install app** action to place Vertex on the home screen, then enable task notifications from the home screen. The terminal renderer loads xterm.js from jsDelivr during this spike, so the phone needs ordinary internet access.

The `android/` folder is retained as an optional future native wrapper, but it is no longer needed for the prototype.

## Notifications and biometric lock

Vertex already delivers task events in the in-app activity inbox. To show notifications while Android has closed the app, the Nativine wrapper must be rebuilt with Firebase Cloud Messaging and Android notification permission. This needs your Firebase project; do not place Firebase service-account credentials in this repository, Vercel environment, or the phone app. Follow [docs/notifications.md](docs/notifications.md) when you are ready.

Biometric unlock is also a native-wrapper feature. Keep Vertex’s pairing and revocation controls enabled regardless; a biometric screen lock protects only the phone UI and does not replace device revocation.

# Terminal

## Protocol

All WebSocket messages are JSON. Client messages: `list`, `listTasks`, `create`/`createSession` (`name`, `cwd`), `createTask` (`name`, `cwd`, `cli`, `prompt`), `attach` (`name`), `input` (`data`), and `resize` (`cols`, `rows`). Server messages: `ready`, `sessions`, `tasks`, `created`, `taskCreated`, `attached`, `output`, `closed`, and `error`.
