---
goal: Complete Vertex personal-beta mobile workflow improvements
version: 1.0
date_created: 2026-08-02
last_updated: 2026-08-02
owner: Vertex
status: In progress
tags: [feature, mobile, terminal, ai-workflow, security]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-in%20progress-yellow)

Deliver the full personal-beta checklist: project discovery, task attention, mobile terminal controls, session and device controls, Git review, laptop health, and notification readiness. Firebase delivery and Nativine biometric access require external account or wrapper configuration and are isolated as configuration tasks.

## 1. Requirements & Constraints

- **REQ-001**: Display Git projects discovered from the laptop without requiring a path on the phone.
- **REQ-002**: Display task state, last activity, attention state, and task diffs in the mobile dashboard.
- **REQ-003**: Provide session pin, rename, stop, and archive controls through the encrypted relay and direct transport.
- **REQ-004**: Provide mobile-safe terminal copy, paste, search, scrolling, and a jump-to-live control.
- **REQ-005**: Display laptop connectivity and lightweight health metadata.
- **REQ-006**: Provide paired-device listing and revocation from the phone.
- **REQ-007**: Persist in-app notifications for completed, failed, and attention-required tasks.
- **REQ-008**: Browse and preview files only within discovered Git project roots from the mobile app.
- **REQ-009**: Display read-only Git branch and change information for a discovered project before opening its terminal.
- **REQ-010**: Display read-only Docker container state and bounded container logs from the mobile app.
- **REQ-011**: Install the laptop agent as a user service that preserves the configured encrypted relay URL across reboot and login.
- **REQ-012**: Allow the user to keep the laptop awake only while Vertex-managed tasks execute, without implementing remote wake.
- **REQ-013**: Let the user create and immediately open a persistent raw terminal in a selected laptop project without launching an AI task.
- **REQ-014**: Make the real terminal practical on a phone with a Ctrl modifier, common shell symbols, and readable zoom controls.
- **REQ-015**: Let the user switch between their persistent laptop terminals without leaving the live terminal view.
- **REQ-016**: Show setup status and self-service checks in the app so personal-beta users can test their own connection and activity delivery.
- **REQ-017**: Make first-time pairing self-explanatory from the welcome screen and provide one laptop command that renews and displays the production QR.
- **SEC-001**: Do not expose source files, terminal output, or project paths to the relay in plaintext.
- **SEC-002**: Device revocation must prevent future relay-frame decryption for the revoked device.
- **CON-001**: Firebase push delivery cannot be enabled without Firebase project credentials supplied by the account owner.
- **CON-002**: Biometric app lock requires a Nativine native bridge capability and cannot be guaranteed by browser JavaScript alone.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Implement laptop task monitoring, activity persistence, and secure control APIs.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-001 | Add `agent/activity-store.js` with bounded, mode-0600 activity persistence and unread state. | ✅ | 2026-08-02 |
| TASK-002 | Add task attention heuristics and task metadata updates in `agent/task-store.js`; only inspect laptop-side terminal snapshots. | ✅ | 2026-08-02 |
| TASK-003 | Add `SessionManager.rename`, `SessionManager.kill`, and `SessionManager.capture` methods in `agent/session-manager.js`. | ✅ | 2026-08-02 |
| TASK-004 | Add encrypted/direct message handlers for task activity, session controls, health, device listing, and revocation in `agent/server.js`. | ✅ | 2026-08-02 |
| TASK-005 | Add Node tests for activity persistence, attention detection, session controls, and revocation routes. | ✅ | 2026-08-02 |

### Implementation Phase 2

- GOAL-002: Build the mobile dashboard, workspace picker, task review, and device controls.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-006 | Extend `web/src/main.jsx` request layer with task activity, system health, session action, and device action requests. | ✅ | 2026-08-02 |
| TASK-007 | Render active-task attention cards, activity inbox, health state, project search/favourites, and session controls in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-008 | Render visual changed-file summaries and reviewed diff actions in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-009 | Render paired-device list and revoke confirmation in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-010 | Add responsive styles for the new dashboard surfaces in `web/src/accessibility.css`. | ✅ | 2026-08-02 |

### Implementation Phase 3

- GOAL-003: Complete high-frequency terminal interactions and notification readiness.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-011 | Add terminal search, copy, paste, quick actions, and clear connection state in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-012 | Add `agent/notification-service.js` with in-app activity generation and optional Firebase configuration validation. | ✅ | 2026-08-02 |
| TASK-013 | Add documented Firebase and Nativine configuration instructions without embedding credentials in the repository. | ✅ | 2026-08-02 |
| TASK-014 | Run tests, production build, relay smoke checks, and commit the completed implementation. | ✅ | 2026-08-02 |

### Implementation Phase 4

- GOAL-004: Add a mobile project file browser without granting unrestricted laptop filesystem access.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-015 | Add a project-root-constrained file listing and UTF-8 preview service in `agent/file-service.js`. | ✅ | 2026-08-02 |
| TASK-016 | Add encrypted/direct file-list and preview handlers in `agent/server.js`. | ✅ | 2026-08-02 |
| TASK-017 | Add a project browser and code preview to `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-018 | Add compact mobile styles for file navigation and previews in `web/src/accessibility.css`. | ✅ | 2026-08-02 |
| TASK-019 | Add traversal and preview-limit tests, then run the complete release check. | ✅ | 2026-08-02 |

### Implementation Phase 5

- GOAL-005: Add a mobile Git status view that preserves terminal-first control for writes.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-020 | Add project-constrained Git status and diff-summary reads in `agent/git-service.js`. | ✅ | 2026-08-02 |
| TASK-021 | Add encrypted/direct Git status handlers in `agent/server.js`. | ✅ | 2026-08-02 |
| TASK-022 | Add a branch, changed-file, and diff-summary view in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-023 | Add Git workspace styles and service tests, then run the release check. | ✅ | 2026-08-02 |

### Implementation Phase 6

- GOAL-006: Add read-only Docker observability for a laptop running Docker.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-024 | Add a Docker availability, container-list, and bounded-log service in `agent/docker-service.js`. | ✅ | 2026-08-02 |
| TASK-025 | Add encrypted/direct Docker handlers in `agent/server.js`. | ✅ | 2026-08-02 |
| TASK-026 | Add Docker summary and log preview views in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-027 | Add Docker styles and service tests, then run the release check. | ✅ | 2026-08-02 |

### Implementation Phase 7

- GOAL-007: Make the personal laptop agent persist without manually running `npm start`.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-028 | Update `scripts/install-linux.sh` to validate relay configuration, write a mode-0600 environment file, and create a systemd user service that reads it. | ✅ | 2026-08-02 |
| TASK-029 | Document one-command Arch/Linux installation, status, logs, update, and uninstall steps in `README.md`. | ✅ | 2026-08-02 |
| TASK-030 | Validate shell syntax and run the application release check. | ✅ | 2026-08-02 |

### Implementation Phase 8

- GOAL-008: Provide opt-in sleep inhibition for managed terminal tasks.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-031 | Add a mode-0600 settings store with a `preventSleep` default in `agent/settings-store.js`. | ✅ | 2026-08-02 |
| TASK-032 | Wrap managed task commands with `systemd-inhibit` only when enabled and available in `agent/session-manager.js`. | ✅ | 2026-08-02 |
| TASK-033 | Add encrypted/direct settings handlers and health metadata in `agent/server.js`. | ✅ | 2026-08-02 |
| TASK-034 | Add the app toggle and setting state in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-035 | Add tests for settings persistence and command wrapping, then run the release check. | ✅ | 2026-08-02 |

### Implementation Phase 9

- GOAL-009: Add a first-class raw terminal launcher for arbitrary developer commands.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-036 | Add a direct authenticated raw-session creation route in `agent/server.js` using the existing tmux session manager. | ✅ | 2026-08-02 |
| TASK-037 | Add encrypted/direct client request support for raw-session creation in `web/src/main.jsx`. | ✅ | 2026-08-02 |
| TASK-038 | Add a visible Open terminal action and a Terminal option in the new-session sheet, then attach immediately after creation. | ✅ | 2026-08-02 |
| TASK-039 | Verify the existing terminal-safe session-name contract and run the full release check. | ✅ | 2026-08-02 |

### Implementation Phase 10

- GOAL-010: Complete the mobile terminal keyboard and readability essentials.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-040 | Add a one-shot Ctrl modifier and pipe/slash key affordances that work for hardware and mobile keyboards. | ✅ | 2026-08-02 |
| TASK-041 | Add in-terminal text size controls and two-finger pinch zoom without disrupting terminal scroll gestures. | ✅ | 2026-08-02 |
| TASK-042 | Add mobile terminal interaction styles, run the full release check, and publish the change. | ✅ | 2026-08-02 |

### Implementation Phase 11

- GOAL-011: Make multiple terminal sessions fast to use from the phone.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-043 | Add a live-terminal session switcher backed by the existing encrypted session list. | ✅ | 2026-08-02 |
| TASK-044 | Add compact mobile styles and run the full release check before publishing. | ✅ | 2026-08-02 |

### Implementation Phase 12

- GOAL-012: Make readiness and safe self-testing visible in the mobile app.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-045 | Add authenticated encrypted/direct test-activity creation on the laptop agent. | ✅ | 2026-08-02 |
| TASK-046 | Add a Setup & test screen with connection, terminal, project, activity, push, and biometric readiness states. | ✅ | 2026-08-02 |
| TASK-047 | Add a self-service in-app activity test, document its scope, and run the full release check. | ✅ | 2026-08-02 |

### Implementation Phase 13

- GOAL-013: Remove pairing ambiguity for a background laptop agent.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-048 | Persist the short-lived, owner-only pairing URL from the running laptop agent. | ✅ | 2026-08-02 |
| TASK-049 | Add `npm run pair` to restart the user agent and render a new QR in the laptop terminal. | ✅ | 2026-08-02 |
| TASK-050 | Replace ambiguous welcome copy with a visible two-step pairing guide and copy action. | ✅ | 2026-08-02 |
| TASK-051 | Add shell/documentation checks and run the full release check. | ✅ | 2026-08-02 |
| TASK-052 | Add a no-camera pairing-link fallback and clear wrapper-permission guidance. | ✅ | 2026-08-02 |

## 3. Alternatives

- **ALT-001**: Build a separate proprietary AI agent. Rejected because Vertex must run existing CLI agents unchanged.
- **ALT-002**: Send terminal output to a cloud service for prompt detection. Rejected because attention detection stays laptop-local under SEC-001.
- **ALT-003**: Hard-code Firebase keys. Rejected because credentials belong to the account owner and violate CON-001.

## 4. Dependencies

- **DEP-001**: Existing Node.js laptop agent, tmux, and Cloudflare encrypted relay.
- **DEP-002**: Existing React/Vite web app and Nativine wrapper.
- **DEP-003**: A Firebase project and service credentials supplied later for remote push delivery.

## 5. Files

- **FILE-001**: `agent/activity-store.js` persists task and device activity.
- **FILE-002**: `agent/task-store.js` stores attention metadata and reviewed task state.
- **FILE-003**: `agent/session-manager.js` owns session lifecycle controls.
- **FILE-004**: `agent/server.js` exposes encrypted/direct control messages and health.
- **FILE-005**: `web/src/main.jsx` implements all mobile interactions.
- **FILE-006**: `web/src/accessibility.css` styles the mobile interface.
- **FILE-007**: `README.md` documents Firebase and Nativine setup.
- **FILE-008**: `agent/file-service.js` constrains project file access.
- **FILE-009**: `agent/git-service.js` provides project-constrained Git metadata.
- **FILE-010**: `agent/docker-service.js` provides allowlisted Docker observations.
- **FILE-011**: `scripts/install-linux.sh` creates the persistent user service.
- **FILE-012**: `agent/settings-store.js` persists laptop sleep preferences.
- **FILE-013**: `agent/server.js` exposes raw terminal session creation.

## 6. Testing

- **TEST-001**: Verify activity store persistence, unread handling, and bounded event retention.
- **TEST-002**: Verify attention classification does not transmit plaintext to the relay.
- **TEST-003**: Verify session rename and stop validation.
- **TEST-004**: Verify revoked relay device keys are rejected.
- **TEST-005**: Run `npm test`, `npm run build`, and browser/mobile regression checks.
- **TEST-006**: Verify project-root traversal rejection and binary/oversized preview handling.
- **TEST-007**: Verify Git metadata is available only to approved projects and contains no write operation.
- **TEST-008**: Verify Docker command arguments are allowlisted and log output is bounded.
- **TEST-009**: Verify installer shell syntax and required environment validation.
- **TEST-010**: Verify sleep-prevention setting and inhibitor command construction.
- **TEST-011**: Verify raw-session request routing and terminal-safe session name validation.

## 7. Risks & Assumptions

- **RISK-001**: CLI approval text varies by Codex, Claude Code, and terminal theme; classify it as a hint and always retain the real terminal as the source of truth.
- **RISK-002**: Android WebViews may not support Web Push or platform biometrics; retain in-app activity and a wrapper-configured fallback.
- **ASSUMPTION-001**: The laptop agent runs under the same user account that owns the selected projects and tmux sessions.

## 8. Related Specifications / Further Reading

- [Vertex PRD](../../prd.md)
- [Vertex release readiness](../../docs/release-readiness.md)
- [Firebase Cloud Messaging documentation](https://firebase.google.com/docs/cloud-messaging)
- [Nativine installation documentation](https://nativine.com/docs/installation)
