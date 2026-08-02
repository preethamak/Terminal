# PRD: Remote Terminal — "Your Laptop, In Your Pocket"

## 1. Summary

A mobile app that gives users a real, low-latency terminal session into their own laptop from anywhere — no laptop required in hand. Users can run any command (`npm install`, `npm run dev`, `git`, `codex`, `claude`, `vim`, etc.), browse files, and interact with fully interactive programs, exactly as if SSH'd in locally. Unlike existing AI-coding mobile apps (Claude Code app, Codex app), this is not a chat-wrapper around an agent — it's direct shell access, with the AI CLIs simply running as processes inside that shell.

**Core value prop:** Zero-friction pairing + a terminal that feels instant on mobile, so developers can leave their laptop at home and still work normally.

---

## 2. Problem Statement

- Existing AI coding assistant mobile apps mediate everything through an agent — you can't drop into a raw shell and type a command yourself.
- Existing remote-terminal tools (SSH clients, Termius, VNC) require manual network setup: static IPs, port forwarding, key management. This friction is the reason people don't use them today, even though the underlying idea ("control my laptop from my phone") is not new.
- Nothing on the market combines: (a) real PTY-level terminal fidelity, (b) zero-config pairing, (c) mobile-first latency/UX, (d) works with AI coding CLIs as first-class citizens.

---

## 3. Goals / Non-Goals

**Goals**
- Real terminal, not simulated command execution — full PTY fidelity (progress bars, `vim`, `htop`, colors, ctrl+c, interactive prompts).
- Pairing laptop↔phone in under 15 seconds, no manual networking.
- Perceived typing/output latency low enough to feel "instant" over LTE/5G.
- Session survives network drops, app backgrounding, laptop sleep/wake.
- File browsing as a convenience layer on top of the same filesystem (no sync/copy).
- Works identically whether the user types commands manually or an AI CLI (Codex/Claude Code) is running inside the session.

**Non-Goals (v1)**
- Not building our own AI agent or chat interface — AI CLIs are just programs running in the terminal.
- Not a full remote-desktop/VNC replacement (no GUI app streaming).
- Not multi-user/team collaboration in v1 (single user, own devices only).
- Not supporting arbitrary cloud VMs in v1 — laptop-only (physical machine the user owns).

---

## 4. Target User

Developers who:
- Already use CLI tools (git, npm, Codex, Claude Code, docker) daily.
- Want to check on / kick off / babysit long-running tasks (builds, dev servers, agent tasks) without being at their desk.
- Are comfortable with a terminal — this is a power-user tool, not a mass-market app.

---

## 5. Core User Stories

1. As a developer, I open the app on my phone, see my laptop listed, tap it, and land in a live shell within seconds.
2. As a developer, I type `npm run dev` and see the real dev server output streaming, including errors, exactly as on my laptop.
3. As a developer, I start `claude` or `codex` in the terminal and interact with its approval prompts normally, using the same session.
4. As a developer, my phone loses signal in a subway tunnel; when it reconnects, my session and scrollback are still there — nothing was lost, nothing needs restarting.
5. As a developer, I get a push notification when a long-running command finishes or an agent needs my approval, even if the app is backgrounded.
6. As a developer, I browse my laptop's project folder visually when I don't want to type `ls`/`cd` repeatedly on a phone keyboard.

---

## 6. Product Requirements

### 6.1 Pairing & Connectivity
- First-time setup: install laptop agent → log into account → agent auto-registers under that account.
- Phone app lists all registered devices under the same account (like iMessage device list) — tap to connect, no repeated QR scans after first pairing.
- QR-code fallback for first-time device trust (e.g., new laptop).
- All connections outbound-only from the laptop (no port forwarding, no inbound firewall rules ever required).
- Transport: embedded mesh networking (e.g., Tailscale `tsnet`) for encrypted, NAT-traversing, P2P-when-possible connections between phone and laptop.

### 6.2 Terminal Experience
- Real PTY-backed shell on the laptop (not command-piping).
- Session backed by `tmux` (or equivalent) on the laptop so it persists independent of phone connection state.
- Full ANSI/escape-code support (colors, cursor movement, full-screen TUIs like `vim`, `htop`, `less`).
- Client-side keystroke echo/prediction to mask network RTT (Mosh-style), reconciled against real laptop output.
- Extra on-screen key row: Ctrl, Esc, Tab, arrows, Pipe, Slash — keys missing from phone keyboards but essential for CLI use.
- Copy/paste, pinch-zoom, and text selection using native mobile gestures without breaking terminal semantics.

### 6.3 Reliability
- Automatic reconnect on network change (wifi↔LTE) or drop, without losing session or scrollback.
- Laptop agent auto-restarts on laptop reboot/wake; session state (tmux) resumes.
- Clear connection-status indicator (connected / reconnecting / laptop offline).

### 6.4 File Access
- File browser view (separate tab from terminal) reflecting the laptop's real filesystem — no upload/sync/duplication.
- Tap a folder to `cd` into it in the terminal; tap a file to preview it.

### 6.5 Notifications
- Push notification when: a foreground command completes, an AI CLI hits an approval prompt, or a long-running process errors out.
- Tapping a notification deep-links straight into the relevant terminal session.

### 6.6 Security
- Per-device key-based trust (not shared passwords); first pairing requires explicit approval on the laptop side.
- Remote session revocation (kill a paired device's access from the laptop or account settings) — critical for lost-phone scenarios.
- All traffic end-to-end encrypted (inherent to the mesh transport).
- Optional: biometric/app-lock on the phone app itself before it can access any session.

---

## 7. Architecture Overview

```
Phone App (native, xterm.js-based terminal renderer)
        │  WebSocket over encrypted mesh (tsnet)
        ▼
Laptop Agent (background service)
        │  spawns / attaches to
        ▼
tmux session
        │  runs
        ▼
Shell (bash/zsh) → npm, git, codex, claude, vim, etc.
```

- **Laptop Agent**: Node.js or Go background service. Responsibilities: PTY spawning via `node-pty` (or equivalent), tmux session management, embedded `tsnet` client, WebSocket server, auth/device-trust handling, push-notification trigger logic (e.g., watching for idle-after-busy shell state).
- **Phone App**: React Native or Flutter shell, with a terminal view using `xterm.js` (WebView) or a native terminal renderer for performance, plus a file-browser screen and device-list/pairing screen.
- **Account/Relay layer**: minimal backend for account auth, device registration list, and push notification delivery. Connectivity itself is peer-to-peer via the mesh network, not routed through our servers (keeps latency low and our infra thin).

---

## 8. Implementation Plan (Phased)

### Phase 0 — Feasibility Spike (few days)
**Goal:** Prove the core feel — real terminal, low latency, over an actual mobile network — before any product investment.
- Laptop agent: `node-pty` + `tmux` + raw WebSocket server (no auth, no mesh yet — local network only).
- Client: a plain browser page running `xterm.js`, opened from a phone's mobile browser on the same wifi.
- Test: run `npm install`, `vim`, `htop` from phone browser against laptop. Validate: does this feel real and fast?
- **Decision gate:** if latency/feel isn't convincing here, revisit before building further.

### Phase 1 — Real Connectivity (1–2 weeks)
- Integrate `tsnet` (or chosen mesh library) into the laptop agent — outbound-only, encrypted, NAT-traversing.
- Add device pairing flow: laptop agent registers under an account; QR-based first-trust handshake.
- Client still browser-based at this point, but now testable over real LTE from anywhere, not just local wifi.
- Implement session persistence: laptop agent always keeps `tmux` alive; reconnect logic on the client re-attaches instead of restarting.

### Phase 2 — Native App Shell (2–3 weeks)
- Build React Native / Flutter app: device list screen, terminal screen (xterm.js in WebView, or evaluate native terminal renderer), basic file-browser screen.
- Add mobile terminal chrome: extra key row (Ctrl/Esc/Tab/arrows), gesture support (copy/paste/pinch-zoom).
- Implement client-side input prediction/echo to mask RTT.
- Reconnection handling across app backgrounding, network switches, laptop sleep/wake.

### Phase 3 — Notifications & Polish (1–2 weeks)
- Push notification service: laptop agent detects shell-idle-after-busy or explicit prompt patterns (e.g., AI CLI approval prompts) and triggers a push via backend.
- Deep-link from notification into the correct session.
- Security hardening: device revocation UI, biometric app-lock, session audit view ("your active devices").
- File browser polish: file preview, basic navigation without needing to type paths.

### Phase 4 — Beta & Iteration
- Dogfood personally (as you noted — you're the first real user) across real-world conditions: subway, flaky wifi, laptop sleep overnight.
- Instrument latency and reconnect-failure metrics.
- Expand to a small beta group of developers already using Codex/Claude Code CLI daily; prioritize their friction points over new features.

---

## 9. Key Technical Risks

| Risk | Mitigation |
|---|---|
| Perceived latency over cellular still feels laggy | Client-side input prediction (Mosh-style echo/reconciliation); measure early in Phase 0 before deeper investment |
| Laptop sleep breaks always-on connectivity | Agent auto-reconnects on wake; consider OS-level "prevent sleep while session active" toggle as opt-in |
| Security concerns block developer trust/adoption | Explicit per-device approval, visible revocation, no inbound ports ever opened — lead with this in messaging |
| Native terminal rendering performance on low-end phones | Start with xterm.js/WebView (proven, good enough); revisit native renderer only if profiling shows it's a bottleneck |
| Mesh networking dependency (e.g., Tailscale) has outages or licensing constraints | Abstract the transport layer so it can be swapped later; validate `tsnet` licensing for embedding in a commercial product before Phase 1 |

---

## 10. Success Metrics (post-launch)

- Time-to-first-connected-session for a new user (target: under 60 seconds including app install and laptop agent setup).
- Median keystroke-to-echo latency (target: under 100ms perceived).
- Reconnection success rate after network drop (target: >99%, no session loss).
- Daily active usage relative to laptop CLI usage (are people actually substituting phone sessions for laptop time, or just using it as an occasional check-in tool?).

---

## 11. Open Questions

- Do we embed Tailscale's `tsnet` directly, or build a thinner custom relay to avoid third-party dependency/licensing risk at scale?
- How much do we lean into AI-CLI-specific affordances (e.g., a structured diff-approval UI) vs. staying pure-terminal for v1? (Recommendation: stay pure-terminal for v1 — simpler, and Codex/Claude Code's own TUI already renders fine in a real terminal.)
- iOS background execution limits may affect how "always connected" the laptop agent's push-trigger detection can be — needs a spike alongside Phase 0.