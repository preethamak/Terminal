---
goal: Make Vertex a continuation of existing laptop work
version: 1.0
date_created: 2026-08-03
last_updated: 2026-08-03
owner: Vertex
status: In progress
tags: [feature, workspace, sessions, terminal, mobile, notifications]
---

# Introduction

![Status: In progress](https://img.shields.io/badge/status-in%20progress-yellow)

Transform Vertex from a Git-project launcher into a mobile continuation of the laptop: show existing persistent terminals first, support ordinary folders as workspaces, create a new folder and optional Git repository from the phone, and repair terminal scrolling before adding background notification delivery.

## 1. Requirements & Constraints

- **REQ-001**: List every existing `tmux` session on the laptop, including its active-pane working directory and active program, immediately after phone pairing.
- **REQ-002**: Open an existing `tmux` session from the phone without creating, replacing, or restarting its process.
- **REQ-003**: Present workspaces from existing terminal/task directories and configured workspace roots, whether or not the directory is a Git repository.
- **REQ-004**: Allow the phone user to create a new folder only below an approved workspace root, optionally initialise Git, and open a persistent terminal in that exact folder.
- **REQ-005**: Retain Git discovery and Git status as enhancements; do not use `.git` as the definition of a workspace.
- **REQ-006**: Make terminal scrollback reliably usable with one-finger touch scrolling while preserving two-finger text zoom and terminal input.
- **REQ-007**: Show a clear distinction between an existing live laptop session, a resumable persistent session, and a new terminal.
- **REQ-008**: Provide a foundation for background completion/approval notifications without claiming native push delivery until Firebase and the Android wrapper are configured.
- **SEC-001**: Folder creation and Git initialisation must reject traversal, symlink escapes, hidden system directories, and paths outside approved workspace roots.
- **SEC-002**: Existing terminal output, folder names, and paths must remain encrypted between device and laptop; the relay must continue to receive opaque frames only.
- **CON-001**: Vertex can attach exactly to processes already inside `tmux`; it cannot safely re-parent Codex, Claude, or a shell already running in an unrelated terminal PTY.
- **CON-002**: Native background push requires an Android wrapper build that registers an FCM token plus Firebase sender credentials supplied by the app owner.
- **GUD-001**: Put “Continue working” before “Create new” in the mobile home flow.
- **GUD-002**: Preserve terminal-first control for arbitrary commands; structured workspace actions are convenience controls, not replacements for the shell.

## 2. Implementation Steps

### Implementation Phase 1

- GOAL-001: Discover existing laptop work safely and expose it through the encrypted protocol.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-001 | Extend `agent/session-manager.js` `list()` to return `cwd` from the active tmux pane and `program` from `#{pane_current_command}` for each validated session name. Do not capture terminal text. | ✅ | 2026-08-03 |
| TASK-002 | Add `agent/workspace-index.js` with mode-0600 persistence. Merge configured roots, current tmux session directories, task `cwd` values, and existing Git projects into deduplicated workspace records `{ path, name, kind, source, lastOpenedAt }`. | ✅ | 2026-08-03 |
| TASK-003 | Add `agent/workspace-service.js` functions `listRoots`, `addRoot`, `createWorkspace`, and `initialiseGit`. Require canonical resolved paths beneath configured roots and reject invalid folder names. | ✅ | 2026-08-03 |
| TASK-004 | Add direct HTTP and encrypted relay handlers in `agent/server.js` for workspace roots, workspace refresh, workspace creation, and Git initialisation. Reuse the existing request/response envelope pattern. | ✅ | 2026-08-03 |
| TASK-005 | Add Node tests covering tmux metadata parsing, non-Git workspace discovery, root-bound creation, duplicate workspaces, traversal rejection, and Git initialisation argument allowlisting. | ✅ | 2026-08-03 |

### Implementation Phase 2

- GOAL-002: Make existing sessions and ordinary folders the primary mobile workflow.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-006 | Extend `web/src/main.jsx` `useVertex` request map and refresh payload for workspace roots and workspace records while preserving the current Git-project request for compatibility. | ✅ | 2026-08-03 |
| TASK-007 | Replace the home “Workspaces” rail with a “Continue from laptop” surface: existing tmux sessions first, then recent workspaces, then a clear “New workspace” action. Display `cwd` and active program in a compact mobile-safe form. | ✅ | 2026-08-03 |
| TASK-008 | Add a Workspace screen that lists both folder and Git workspace records, supports search, lets the user open a terminal in a selected folder, and keeps read-only Git/file panels available when the workspace is Git-backed. |  |  |
| TASK-009 | Add a New workspace sheet: choose approved parent root, enter a single folder name, choose plain folder or “Initialise Git,” create it through `workspace-service`, then attach immediately to the created persistent terminal. | ✅ | 2026-08-03 |
| TASK-010 | Add responsive styles in `web/src/accessibility.css` for live-session badges, workspace kinds, truncated paths, root selection, empty states, and a high-contrast new-workspace flow. | ✅ | 2026-08-03 |

### Implementation Phase 3

- GOAL-003: Repair mobile terminal interaction and verify that live output is stable under normal use.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-011 | Refactor `web/src/main.jsx` `TerminalView` touch handling so one touch scrolls xterm scrollback, two touches only change text size, and neither path drops terminal input or forces jump-to-live. |  |  |
| TASK-012 | Add terminal UI controls for “jump to live,” selected-session state, connection/reconnect state, and a concise scrolling hint that disappears after first successful scroll. |  |  |
| TASK-013 | Add pure tests for touch gesture classification and output sequencing, then perform a manual Android acceptance script using long Codex output, `less`, `vim`, and a network reconnection. |  |  |
| TASK-014 | Record latency, reconnect result, and scrolling outcome locally in `agent/activity-store.js` as bounded diagnostic events; never send this telemetry to the relay or an analytics service. |  |  |

### Implementation Phase 4

- GOAL-004: Make completed and attention-needed work visible without pretending that unconfigured native push is complete.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-015 | Extend `agent/task-monitor.js` to create bounded activity for managed Codex/Claude task completion, failure, and approval hints, including a deep-linkable session identifier. |  |  |
| TASK-016 | Add `web/src/main.jsx` deep-link parsing for `?session=<name>` and `?task=<id>` so a notification tap or shared link opens the relevant persistent terminal after pairing. |  |  |
| TASK-017 | Extend the existing Setup & test screen with explicit states for in-app activity, native push token registration, Firebase sender configuration, and Android wrapper capability. Keep unavailable native states disabled with actionable setup text. |  |  |
| TASK-018 | Define the `agent/notification-service.js` provider interface and Firebase payload contract, but do not enable network push until DEP-003 credentials and the native app registration token exist. |  |  |

### Implementation Phase 5

- GOAL-005: Validate a full phone-first workflow and publish only after the actual acceptance path passes.

| Task | Description | Completed | Date |
|---|---|---:|---|
| TASK-019 | Add integration tests for encrypted workspace/session request routing and run `npm test`, `npm run build`, `node --check agent/server.js`, `bash -n scripts/pair-linux.sh`, and `git diff --check`. |  |  |
| TASK-020 | Execute and document the personal acceptance path: pair Android app; view an existing tmux Codex session; create a non-Git folder; initialise Git; open Codex; background the phone; reconnect; scroll back through output; and resume the same session. |  |  |
| TASK-021 | Commit, push, wait for the Vercel deployment, restart the laptop user service, and verify the Android wrapper loads the latest hosted app. |  |  |

## 3. Alternatives

- **ALT-001**: Scan only Git repositories. Rejected because new and non-Git work is a first-class developer workflow.
- **ALT-002**: Attempt to move an already-running non-tmux Codex process into Vertex. Rejected because Linux cannot safely transfer an existing arbitrary PTY to tmux without process interruption or unreliable terminal state.
- **ALT-003**: Permit folder creation anywhere under the user home directory. Rejected because approved workspace roots give a clear phone-safe scope and prevent accidental creation in configuration or system directories.
- **ALT-004**: Implement Firebase push before phone-first workspace flow. Deferred because pairing, session continuation, scrolling, and folder creation are necessary to make notifications actionable.

## 4. Dependencies

- **DEP-001**: Linux laptop has `tmux`, Node.js, and the Vertex user service running.
- **DEP-002**: Existing encrypted Cloudflare relay and Vercel-hosted web application remain available.
- **DEP-003**: Firebase project credentials and a rebuilt Android wrapper with native token registration are required before true background push can be enabled.
- **DEP-004**: Android phone has the current Vertex wrapper installed and can complete the existing pairing-link fallback.

## 5. Files

- **FILE-001**: `agent/session-manager.js` provides tmux session metadata and attachment.
- **FILE-002**: `agent/workspace-index.js` persists and merges Git and non-Git workspace records.
- **FILE-003**: `agent/workspace-service.js` enforces safe workspace-root operations.
- **FILE-004**: `agent/server.js` exposes direct and encrypted workspace/session routes.
- **FILE-005**: `web/src/main.jsx` renders continuation-first home, workspace creation, terminal gestures, and deep links.
- **FILE-006**: `web/src/accessibility.css` contains mobile continuation and terminal interaction styles.
- **FILE-007**: `agent/task-monitor.js` and `agent/notification-service.js` provide activity and notification-provider boundaries.
- **FILE-008**: `test/workspace-index.test.js`, `test/workspace-service.test.js`, and terminal interaction tests validate the new protocol and safe filesystem rules.
- **FILE-009**: `docs/phone-first-acceptance.md` records the personal Android acceptance procedure and known limitation for pre-existing non-tmux processes.

## 6. Testing

- **TEST-001**: Verify a manually created tmux session appears with its current working directory and active program without terminal output capture.
- **TEST-002**: Verify an ordinary non-Git folder is discoverable once it is under a configured workspace root.
- **TEST-003**: Verify folder creation rejects `..`, separators in names, symlink escapes, hidden system paths, and roots not approved by the user.
- **TEST-004**: Verify optional Git initialisation runs only `git init` in the newly created canonical folder.
- **TEST-005**: Verify an existing tmux Codex session attaches from Android without creating a new session or changing its process.
- **TEST-006**: Verify one-finger terminal scrolling, two-finger zoom, copy/paste, Ctrl, and jump-to-live on an Android device with long output.
- **TEST-007**: Verify reconnect resumes the same session and preserves tmux scrollback.
- **TEST-008**: Verify deep links do not expose a session name, path, or terminal output to the relay in plaintext.
- **TEST-009**: Run complete unit, build, shell, and Android acceptance checks from TASK-019 and TASK-020.

## 7. Risks & Assumptions

- **RISK-001**: Some laptop work may be running outside tmux. Vertex will label it as not attachable rather than misleading the user that it can resume the exact process.
- **RISK-002**: Recursive folder discovery can be slow in large home directories. The implementation uses configured roots, bounded depth, skip rules, caching, and explicit refresh.
- **RISK-003**: Mobile WebViews differ in touch event delivery. Android-device acceptance testing is a release gate for terminal scrolling.
- **RISK-004**: Background push cannot be validated without the app owner’s Firebase and Android wrapper setup.
- **ASSUMPTION-001**: New work folders will be created beneath a small number of user-approved roots such as `~/Projects`, `~/code`, or `~/workspace`.
- **ASSUMPTION-002**: Future Codex/Claude tasks intended for phone continuation will be launched in a Vertex or user-created tmux session.

## 8. Related Specifications / Further Reading

- [Vertex PRD](../../prd.md)
- [Existing mobile workflow plan](feature-mobile-workspace-1.md)
- [Phone-first acceptance checklist](../docs/release-readiness.md)
- [Firebase Cloud Messaging documentation](https://firebase.google.com/docs/cloud-messaging)
