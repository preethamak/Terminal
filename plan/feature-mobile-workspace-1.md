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

## 6. Testing

- **TEST-001**: Verify activity store persistence, unread handling, and bounded event retention.
- **TEST-002**: Verify attention classification does not transmit plaintext to the relay.
- **TEST-003**: Verify session rename and stop validation.
- **TEST-004**: Verify revoked relay device keys are rejected.
- **TEST-005**: Run `npm test`, `npm run build`, and browser/mobile regression checks.
- **TEST-006**: Verify project-root traversal rejection and binary/oversized preview handling.

## 7. Risks & Assumptions

- **RISK-001**: CLI approval text varies by Codex, Claude Code, and terminal theme; classify it as a hint and always retain the real terminal as the source of truth.
- **RISK-002**: Android WebViews may not support Web Push or platform biometrics; retain in-app activity and a wrapper-configured fallback.
- **ASSUMPTION-001**: The laptop agent runs under the same user account that owns the selected projects and tmux sessions.

## 8. Related Specifications / Further Reading

- [Vertex PRD](../../prd.md)
- [Vertex release readiness](../../docs/release-readiness.md)
- [Firebase Cloud Messaging documentation](https://firebase.google.com/docs/cloud-messaging)
- [Nativine installation documentation](https://nativine.com/docs/installation)
