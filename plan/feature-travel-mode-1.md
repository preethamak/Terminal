---
goal: Travel-ready remote development control plane
version: 1.0
date_created: 2026-08-03
last_updated: 2026-08-03
owner: Vertex
status: 'Completed'
tags: [feature, reliability, mobile, agent]
---

# Introduction

![Status: Completed](https://img.shields.io/badge/status-Completed-brightgreen)

Deliver a phone-first Travel Mode that makes the laptop's live state, sleep protection, active work, recovery information, workspace creation, device access, checkpoints, and safe phone-to-laptop uploads available through the existing encrypted Vertex relay.

## 1. Requirements & Constraints

- **REQ-001**: Expose an honest laptop heartbeat, agent version, relay state, disk capacity, battery state, and recent restart/reconnect information without sending source code to the relay.
- **REQ-002**: Let a paired device enable and disable Travel Mode, which prevents system sleep while enabled and exposes its actual activation state.
- **REQ-003**: Provide an active-work dashboard showing waiting AI tasks, running tasks, Docker health, and one-tap paths to the exact terminal.
- **REQ-004**: Persist user-written task checkpoints locally on the laptop and show them only to paired devices.
- **REQ-005**: Create a folder, optionally initialise Git, then optionally launch a terminal, Codex, Claude, or an explicit command through one guarded flow.
- **REQ-006**: Preserve per-device revocation and add a local-agent lock that rejects all paired-device requests until it is explicitly unlocked on the laptop.
- **REQ-007**: Permit phone file upload only inside approved workspace roots, with explicit type/size limits and no path traversal.
- **SEC-001**: Keep health, checkpoints, uploads, and lock state on the laptop; relay frames remain encrypted and no terminal output is added to relay metadata.
- **SEC-002**: Require an existing non-revoked paired device for every new operation; never expose pairing tokens, relay keys, or uploaded content in health responses.
- **CON-001**: Wake-on-LAN is excluded because a sleeping laptop cannot receive relay commands without separately configured network hardware or a home wake helper.
- **CON-002**: Native push and biometric unlock remain separate Android-wrapper work; in-app activity must continue to work without either.
- **GUD-001**: Mobile UI must state the difference between requested and confirmed sleep protection; it must not claim that a sleeping/offline laptop is reachable.
- **PAT-001**: Add narrowly scoped laptop services with direct Node tests and route each service through both direct HTTP and encrypted relay message handling.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Make laptop health and Travel Mode observable and controllable.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-001 | Add `agent/travel-service.js` to hold a child `systemd-inhibit` process, report its PID/started time, stop it safely, and detect unexpected exit. | ✅ | 2026-08-03 |
| TASK-002 | Extend `agent/settings-store.js` with validated `travelMode` and `agentLocked` booleans while preserving existing `preventSleep`. | ✅ | 2026-08-03 |
| TASK-003 | Add `agent/health-service.js` to report disk, process uptime, process start timestamp, relay reconnect count, and the last successful relay connection. | ✅ | 2026-08-03 |
| TASK-004 | Wire direct and relay APIs for health, settings, and Travel Mode; reject paired-device commands when local-agent lock is enabled. | ✅ | 2026-08-03 |
| TASK-005 | Add tests for settings validation, sleep-inhibitor lifecycle seams, disk/health normalization, and lock authorization. | ✅ | 2026-08-03 |

### Implementation Phase 2

- GOAL-002: Create a mobile travel dashboard and active-work navigation.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-006 | Extend `web/src/main.jsx` data refresh and request map with Travel Mode, health detail, checkpoints, uploads, and the new guarded workspace action. | ✅ | 2026-08-03 |
| TASK-007 | Replace the compact laptop status card with an honest Travel Mode panel containing last-seen age, battery, disk, relay, agent uptime, and recovered/reconnecting state. | ✅ | 2026-08-03 |
| TASK-008 | Add an Active Work section that prioritizes verified approvals, active tasks, and unhealthy Docker containers, with terminal/task deep links. | ✅ | 2026-08-03 |
| TASK-009 | Add responsive CSS in `web/src/travel-mode.css` and import it from `web/src/main.jsx`. | ✅ | 2026-08-03 |

### Implementation Phase 3

- GOAL-003: Make starting, resuming, recording, and moving work seamless.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-010 | Add `agent/checkpoint-store.js` with 200-entry local persistence, strict length limits, and task/session references. | ✅ | 2026-08-03 |
| TASK-011 | Add direct and relay checkpoint list/create/delete operations and show checkpoint notes in task and session detail sheets. | ✅ | 2026-08-03 |
| TASK-012 | Add `createWorkspaceAndLaunch` in `agent/server.js` to create the folder, optionally run Git init, and launch only terminal, Codex, or Claude modes. | ✅ | 2026-08-03 |
| TASK-013 | Add a mobile “create, initialise, and continue” flow with clear launch choice and one-tap open-terminal continuation. | ✅ | 2026-08-03 |
| TASK-014 | Add a safe workspace upload service allowing text/code/image files up to 5 MiB under a selected approved workspace, then add a phone picker UI. | ✅ | 2026-08-03 |

### Implementation Phase 4

- GOAL-004: Strengthen remote access safety and release readiness.

| Task | Description | Completed | Date |
|------|-------------|-----------|------|
| TASK-015 | Add account controls for revoke device, lock remote access, and an explicit laptop-only unlock instruction. | ✅ | 2026-08-03 |
| TASK-016 | Test all new agent services, input validation, workspace boundaries, relay operation handling, and production frontend build. | ✅ | 2026-08-03 |
| TASK-017 | Document travel preflight, limits of wake-on-LAN, and agent recovery in README and commit the completed release. | ✅ | 2026-08-03 |

## 3. Alternatives

- **ALT-001**: Use a Cloudflare Worker timer as a wake service. Rejected because it cannot emit a LAN Wake-on-LAN packet to an offline laptop.
- **ALT-002**: Upload arbitrary binary files through terminal input. Rejected because a bounded, path-validated workspace upload route is safer and observable.
- **ALT-003**: Implement a remote unlock. Rejected because it defeats the local-agent lock's purpose; unlocking must require laptop-local action.

## 4. Dependencies

- **DEP-001**: Existing `tmux`, `systemd-inhibit`, and systemd user service on the Linux laptop.
- **DEP-002**: Existing encrypted Cloudflare Durable Object relay and paired-device credentials.
- **DEP-003**: Browser File API in the Android WebView for workspace upload selection.

## 5. Files

- **FILE-001**: `agent/travel-service.js`, `agent/health-service.js`, `agent/checkpoint-store.js`, and `agent/upload-service.js` provide local, testable capabilities.
- **FILE-002**: `agent/server.js` routes capabilities through direct HTTP and encrypted relay clients.
- **FILE-003**: `agent/settings-store.js` and `agent/workspace-service.js` persist travel settings and safely create/launch workspaces.
- **FILE-004**: `web/src/main.jsx` and `web/src/travel-mode.css` expose the phone-first controls and status.
- **FILE-005**: `test/*.test.js` and `README.md` verify and document the release.

## 6. Testing

- **TEST-001**: Unit-test Travel Mode process lifecycle through injected process runners and settings persistence.
- **TEST-002**: Unit-test disk/uptime health values using fixture roots and no exposed secrets.
- **TEST-003**: Unit-test checkpoint persistence and upload root/path/size validation.
- **TEST-004**: Run `node --test --test-concurrency=1`, `npm run build`, and `git diff --check` after all changes.

## 7. Risks & Assumptions

- **RISK-001**: `systemd-inhibit` can be missing or policy-restricted; Travel Mode must show “unavailable” rather than report false protection.
- **RISK-002**: Phone WebViews may not provide a full upload picker; the upload UI must surface that limitation without affecting terminals.
- **RISK-003**: A laptop can still become unreachable after a power or router failure; Travel Mode reports this but cannot wake a powered-off machine.
- **ASSUMPTION-001**: The existing agent runs under a user systemd service and has permission to execute `systemd-inhibit`.

## 8. Related Specifications / Further Reading

- [Existing laptop-continuation plan](feature-laptop-continuation-1.md)
- [Vertex release-readiness notes](../docs/release-readiness.md)
