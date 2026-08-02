---
goal: Stabilize Vertex and evolve it from a browser terminal spike into a branded AI-agent mobile workflow product
version: 1.0
date_created: 2026-08-01
last_updated: 2026-08-01
owner: akprajwal
status: Planned
tags: [feature, mobile, terminal, ai-workflow, ux]
---

# Introduction

![Status: Planned](https://img.shields.io/badge/status-Planned-blue)

This plan converts the validated remote-terminal spike into Vertex’s intended product: a stable, branded Android experience for resuming AI coding work on the user’s own laptop from anywhere.

## 1. Requirements & Constraints

- **REQ-001**: Render a stable ANSI terminal without visible flicker while Codex, Claude Code, Vim, and long-running commands emit high-frequency output.
- **REQ-002**: Make the default screen a dashboard of active AI tasks and repositories, not a generic session list.
- **REQ-003**: Remove manual project-path entry from the normal task-start flow by showing recent and discovered Git repositories.
- **REQ-004**: Deliver Vertex as a branded Android app with Vertex icon, name, biometric lock, and notification permissions; Chrome must not be the primary user-facing surface.
- **REQ-005**: Keep a raw persistent terminal available for every task and project.
- **REQ-006**: Keep all commands, repository files, and AI CLIs on the laptop; the mobile client must never copy a repository to a Vertex server.
- **REQ-008**: Require users to install only the Vertex laptop agent and the Vertex mobile app. Do not require a Tailscale, SSH, VPN, or third-party terminal app account in the product flow.
- **REQ-007**: Notify the user when an AI task completes, fails, or has a verified action required.
- **SEC-001**: Pair phones using expiring QR challenges and revocable per-device credentials; do not use pasted permanent tokens in the normal flow.
- **SEC-002**: Use application-layer end-to-end encryption between the paired Vertex phone and laptop agent. The Vertex relay must route opaque encrypted frames and must not receive terminal plaintext.
- **CON-001**: The current supported prototype target is Linux laptop plus Android phone.
- **CON-002**: Reliable background push requires a user-owned Firebase project, HTTPS origin, and notification credentials; it cannot be implemented before those credentials exist.
- **CON-003**: Vercel hosts the Vertex web application. A separate long-lived Vertex relay service is required for remote WebSocket routing and cannot be replaced by the Vercel static deployment.
- **GUD-001**: Treat terminal text as a fallback transport. Do not infer irreversible AI approvals from terminal text patterns.
- **PAT-001**: Introduce explicit agent adapters that emit structured events for task lifecycle, diffs, and approval requests.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Stabilize the remote terminal data path and prove it under Codex output.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Update `agent/server.js` to attach a monotonically increasing `sequence` field to every `output` WebSocket message and emit a `terminalSnapshot` message immediately after attach. Preserve the byte order received from `node-pty`. | | |
| TASK-002 | Update `web/app.js` to buffer output by `sequence`, flush it once per `requestAnimationFrame`, discard duplicate sequences, and never destroy/recreate the `Terminal` instance while an attached socket remains open. | | |
| TASK-003 | Add `@xterm/addon-fit`, bundle xterm.js, xterm.css, and the fit addon under `web/vendor/`, and remove all jsDelivr references from `web/index.html`. Call `fit()` after terminal mount, orientation changes, and a 150 ms resize debounce. | | |
| TASK-004 | Add a `resize` message from `web/app.js` containing calculated terminal columns and rows after each successful fit; update `agent/server.js` to validate ranges before forwarding resize to `node-pty`. | | |
| TASK-005 | Add `test/terminal-protocol.test.js` covering output sequence ordering, duplicate suppression, resize-range validation, and reconnect attach behavior. | | |

### Implementation Phase 2

- GOAL-002: Replace manually typed project paths with laptop-owned repository discovery and a useful task dashboard.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Add `agent/project-index.js` to scan configurable roots (`$HOME` by default) to a maximum depth of four directories, detect Git roots by `.git`, skip hidden/cache/build directories, and persist repository name, absolute path, last-opened time, and Git branch in `~/.vertex/projects.json`. | | |
| TASK-007 | Add authenticated `GET /projects` and `POST /projects/refresh` routes in `agent/server.js`. Return recent projects first, then remaining discovered projects alphabetically. | | |
| TASK-008 | Update `agent/task-store.js` and `createTask()` in `agent/server.js` to persist `projectPath`, `projectName`, `branch`, current task status, latest summary, changed-file count, and last activity timestamp. | | |
| TASK-009 | Replace the free-text project-folder field in `web/index.html` and `web/app.js` with a searchable repository picker fed by `GET /projects`; retain an explicit “Choose another folder” fallback only for paths outside the index. | | |
| TASK-010 | Replace the current `#sessions` screen in `web/index.html` with task cards showing agent type, repository, branch, status, duration, changed-file count, and a single Resume button. Show plain terminal sessions in a separate secondary section. | | |
| TASK-011 | Add `test/project-index.test.js` using a temporary directory tree to verify Git-root discovery, skip rules, max-depth behavior, recent-project ordering, and path validation. | | |

### Implementation Phase 3

- GOAL-003: Implement trustworthy AI-specific task events, diffs, and actions.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-012 | Define `agent/adapters/adapter.js` with the event contract `task_started`, `output`, `diff_changed`, `action_required`, `task_completed`, and `task_failed`. Include `taskId`, timestamp, repository path, and stable action ID in every event. | | |
| TASK-013 | Implement `agent/adapters/claude.js` using Claude Code’s documented structured/non-interactive output and permission-prompt integration where supported. Store raw adapter events in `~/.vertex/task-events/<task-id>.ndjson`. | | |
| TASK-014 | Implement `agent/adapters/codex.js` only against verified Codex CLI hooks or structured modes. If no verified hook exposes an approval, mark the task as `terminal_action_required` and open the exact terminal instead of guessing an approval command. | | |
| TASK-015 | Add `agent/diff-service.js` to compare the task’s saved Git base ref with its current working tree, return changed-file metadata plus bounded file diffs, and reject binary, oversized, and path-traversal requests. | | |
| TASK-016 | Replace the review-only buttons in `web/index.html` with actions backed by a stable adapter action ID. Display “Open terminal to decide” whenever the adapter does not provide a verified action. | | |
| TASK-017 | Add `test/diff-service.test.js` and `test/adapter-contract.test.js` covering text diff limits, binary exclusion, base-ref failure, event persistence, action-ID validation, and fallback-to-terminal behavior. | | |

### Implementation Phase 4

- GOAL-004: Ship an owned Android app shell and real notifications.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-018 | Replace the prototype browser-only launch path with the branded Android wrapper in `android/`. Configure application ID, Vertex icon, splash screen, secure local token storage, biometric gate, QR camera permission, and a WebView that loads the bundled `web/` assets. | | |
| TASK-019 | Evaluate Nativine against the requirements in TASK-018. Select it only if its generated project permits bundled offline assets, secure token storage, biometric authentication, QR camera use, FCM, and source-code export. Otherwise retain the Kotlin wrapper. Record the result in `docs/mobile-shell-decision.md`. | | |
| TASK-020 | Add Firebase Cloud Messaging to the selected Android shell. Store push-registration tokens in the account/relay service and deep-link every notification to `/task/<task-id>`. Do not add secrets to this repository. | | |
| TASK-021 | Add a stateful relay/account service under `relay/` with device registration, public-key records, encrypted push-token storage, device revocation, and event delivery authorization. Keep terminal bytes out of the relay data model. | Partial — `relay/worker.js` is a deployable opaque-frame relay and `relay/dev-server.js` supports local testing. Account records and push are deferred. | 2026-08-02 |
| TASK-022 | Add `agent/relay-client.js` and `web/relay-client.js`. Establish persistent outbound WSS connections to the Vertex relay, perform paired-device key agreement, and send only authenticated encrypted envelopes through the relay. | Complete — paired device keys encrypt AES-GCM frames end to end and the laptop initiates relay connections. | 2026-08-02 |
| TASK-027 | Replace the current direct Tailscale URL and QR flow with `https://app.vertex.example/pair?challenge=...`. The phone exchanges the short-lived challenge for a device key; the laptop agent receives the paired device’s public key through the relay. | Partial — relay QR pairing is implemented using an app URL and expiring key-bearing challenge. Deployment URL is deferred. | 2026-08-02 |
| TASK-028 | Deploy the static `web/` application to Vercel and configure Nativine to build the Vertex-branded Android package from that Vercel URL. Include the Nativine bridge only for biometric unlock, notification registration, and deep links. | Partial — `npm run build` produces Vercel-ready `dist/`; Vercel/Nativine actions are deliberately user-owned and deferred. | 2026-08-02 |
| TASK-023 | Add Android instrumentation tests for biometric lock, QR pairing deep link, offline launch, task notification deep link, and terminal-resume navigation. | | |

### Implementation Phase 5

- GOAL-005: Validate the product under the real remote conditions that matter.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-024 | Add local metrics in `agent/metrics.js` for terminal output frame rate, dropped/duplicate sequence count, reconnect duration, task duration, and notification delivery attempt. Do not collect terminal content. | | |
| TASK-025 | Create `docs/dogfood-script.md` with deterministic tests: phone on mobile data, laptop on home Wi-Fi, Codex task with high-output command, phone background/foreground transition, network switch, task completion, diff review, and device revocation. | | |
| TASK-026 | Define acceptance thresholds: no terminal frame gap longer than 500 ms during a 60-second high-output test, reconnect under 5 seconds after mobile network restoration, repository picker opens in under 1 second for 200 indexed repositories, and task-resume from notification opens the correct task. | | |

## 3. Alternatives

- **ALT-001**: Continue as a general mobile SSH client. Rejected because Termius already provides a mature terminal, workspace, credential, and session product.
- **ALT-002**: Parse arbitrary terminal text to decide whether an AI agent needs approval. Rejected because false positives can authorize destructive commands.
- **ALT-003**: Keep Chrome/PWA as the final app. Rejected because it does not meet the owned-app, biometric, reliable notification, and polished mobile UX requirements.
- **ALT-004**: Require Tailscale in the shipped product. Rejected because it violates REQ-008 and makes Vertex dependent on a separate user-visible networking app.

## 4. Dependencies

- **DEP-001**: `tmux`, `node-pty`, and `ws` remain required for the Linux prototype agent.
- **DEP-002**: Bundled xterm.js and the xterm fit addon are required for stable offline terminal rendering.
- **DEP-003**: Codex and Claude Code installations on the laptop are required to exercise their respective adapters.
- **DEP-004**: Firebase project configuration, HTTPS origin, and Android signing credentials are required before TASK-020 can produce real background push.
- **DEP-005**: A stateful WebSocket-capable hosting provider, Vertex relay domain, and TLS certificates are required for TASK-021 through TASK-027.

## 5. Files

- **FILE-001**: `agent/server.js` — transport sequencing, validated resize, project/task routes, and transport abstraction.
- **FILE-002**: `agent/project-index.js` — repository discovery and persistence.
- **FILE-003**: `agent/task-store.js` — expanded task dashboard state.
- **FILE-004**: `agent/adapters/adapter.js`, `agent/adapters/claude.js`, and `agent/adapters/codex.js` — structured AI task integrations.
- **FILE-005**: `agent/diff-service.js` — bounded safe Git diff API.
- **FILE-006**: `web/index.html`, `web/app.js`, `web/app.css`, and `web/vendor/` — stable terminal, dashboard, picker, diffs, and branded mobile UI.
- **FILE-007**: `android/` — owned Android shell, secure storage, biometric gate, camera pairing, and FCM integration.
- **FILE-008**: `relay/` — account, device, encrypted-frame relay, and push-token service.
- **FILE-009**: `docs/mobile-shell-decision.md` and `docs/dogfood-script.md` — decision and validation artifacts.

## 6. Testing

- **TEST-001**: Run `npm test` and require the terminal protocol, project index, adapter contract, and diff service test suites to pass.
- **TEST-002**: Run a scripted high-output task through a real tmux PTY and assert ordered, duplicate-free terminal frame delivery.
- **TEST-003**: Run the dogfood script with phone mobile data and laptop home Wi-Fi; record every acceptance threshold in TASK-026.
- **TEST-004**: Run Android instrumentation tests after every shell, notification, and QR pairing change.

## 7. Risks & Assumptions

- **RISK-001**: Codex approval hooks may not expose a stable external action API. Mitigate by using terminal-only decisions until a verified interface exists.
- **RISK-002**: A WebView terminal can still flicker under high output. Mitigate through TASK-001 through TASK-004 before changing renderer technology.
- **RISK-003**: Repository scanning can expose sensitive paths. Mitigate with configurable roots, visible scanned-path settings, and default skip rules.
- **RISK-004**: Firebase and account/relay work add operational complexity. Mitigate by deferring real push until the local task UX succeeds.
- **ASSUMPTION-001**: The user’s laptop can make an outbound HTTPS/WebSocket connection to the Vertex relay even when it is behind NAT.
- **ASSUMPTION-002**: Vertex remains single-user and laptop-only until the core dogfood flow meets TASK-026 thresholds.

## 8. Related Specifications / Further Reading

- [Product requirements document](../prd.md)
- [Current feasibility spike setup](../README.md)
- [Nativine SDK installation](https://nativine.com/docs/installation)
- [Firebase Cloud Messaging web setup](https://firebase.google.com/docs/cloud-messaging/web/get-started)
- [Claude Code CLI reference](https://docs.anthropic.com/en/docs/claude-code/cli-usage)
