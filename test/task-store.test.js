const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { TaskStore } = require("../agent/task-store");

test("task store records a terminal task completing", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-task-store-"));
  const store = new TaskStore(root);
  const task = store.add({ id: "abc", status: "running", createdAt: 1, eventFile: store.eventFile("abc") });
  fs.writeFileSync(task.eventFile, JSON.stringify({ status: "completed", exitCode: 0 }));
  const [updated] = store.sync();
  assert.equal(updated.status, "completed");
  assert.equal(updated.exitCode, 0);
  fs.rmSync(root, { recursive: true, force: true });
});
