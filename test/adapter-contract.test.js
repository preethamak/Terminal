const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { appendEvent, event } = require("../agent/adapters/adapter");

test("adapter events carry stable task and repository context", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-events-"));
  const task = { id: "task-1", cwd: "/repo", eventFile: path.join(root, "task.json") };
  const value = appendEvent(task, event(task, "action_required", { actionId: "safe-1" }));
  assert.equal(value.repository, "/repo"); assert.equal(JSON.parse(fs.readFileSync(`${task.eventFile}.ndjson`, "utf8")).actionId, "safe-1");
  assert.throws(() => event(task, "unknown")); fs.rmSync(root, { recursive: true, force: true });
});
