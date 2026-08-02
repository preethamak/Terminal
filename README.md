# Vertex feasibility spike

Vertex proves one thing first: an Android phone can attach to a persistent `tmux` session on a Linux laptop and use it as a real terminal. Commands run only on the laptop.

## What exists now

- Node.js Linux agent with a token-protected HTTP/WebSocket protocol.
- Persistent named sessions backed by `tmux`.
- Mobile-first PWA served by the laptop agent, with an **AI tasks first** home screen, xterm.js terminal, and mobile Ctrl/Esc/Tab/arrow key row.
- Codex and Claude Code task launchers: pick a project, enter a task, and Vertex starts the CLI in a persistent tmux session.
- Task lifecycle tracking: task cards move from running to completed/failed while the terminal remains available for inspection or follow-up.
- Local AI attention detection: Vertex watches managed tmux tasks on the laptop for approval-like prompts and surfaces an encrypted **needs input** card on the phone. The terminal remains the source of truth.
- In-app activity inbox: task starts, completions, failures, and attention requests remain stored privately on the laptop and are shown on the phone after reconnecting.
- Project search, Git diff review, task pin/archive, session rename/stop, terminal search/copy/paste, laptop health, and paired-device revocation.
- Android reconnects to the same session after the app is closed; the agent never kills the underlying `tmux` session.
- Ten-minute QR pairing creates a revocable per-device token.
- Git diff review for each managed task, with an approve/needs-changes review record.
- In-app activity notifications when a watched task changes from running to completed, failed, or needs attention.

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
bash scripts/install-linux.sh
```

## Open it on Android

On the Android phone, scan the QR or open the URL shown in the terminal. Use the browser’s **Install app** action to place Vertex on the home screen, then enable task notifications from the home screen. The terminal renderer loads xterm.js from jsDelivr during this spike, so the phone needs ordinary internet access.

The `android/` folder is retained as an optional future native wrapper, but it is no longer needed for the prototype.

## Notifications and biometric lock

Vertex already delivers task events in the in-app activity inbox. To show notifications while Android has closed the app, the Nativine wrapper must be rebuilt with Firebase Cloud Messaging and Android notification permission. This needs your Firebase project; do not place Firebase service-account credentials in this repository, Vercel environment, or the phone app. Follow [docs/notifications.md](docs/notifications.md) when you are ready.

Biometric unlock is also a native-wrapper feature. Keep Vertex’s pairing and revocation controls enabled regardless; a biometric screen lock protects only the phone UI and does not replace device revocation.

# Terminal

## Protocol

All WebSocket messages are JSON. Client messages: `list`, `listTasks`, `create` (`name`, `cwd`), `createTask` (`name`, `cwd`, `cli`, `prompt`), `attach` (`name`), `input` (`data`), and `resize` (`cols`, `rows`). Server messages: `ready`, `sessions`, `tasks`, `created`, `taskCreated`, `attached`, `output`, `closed`, and `error`.
