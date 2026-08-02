const fs = require("node:fs");

const EVENT_TYPES = new Set(["task_started", "output", "diff_changed", "action_required", "task_completed", "task_failed"]);

function event(task, type, payload = {}) {
  if (!EVENT_TYPES.has(type)) throw new Error(`Unsupported task event: ${type}`);
  return { taskId: task.id, type, timestamp: Date.now(), repository: task.cwd, ...payload };
}

function appendEvent(task, value) {
  fs.appendFileSync(`${task.eventFile}.ndjson`, `${JSON.stringify(value)}\n`, { mode: 0o600 });
  return value;
}

module.exports = { EVENT_TYPES, event, appendEvent };
