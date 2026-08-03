const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { CheckpointStore, MAX_NOTE_LENGTH } = require("../agent/checkpoint-store");

test("checkpoints persist locally and filter by task", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-checkpoint-")); const store = new CheckpointStore(root);
  const first = store.add({ taskId:"task-a", session:"codex-a", cwd:"/tmp", note:"Tests are passing; review the auth diff next." }); store.add({ taskId:"task-b", note:"Other task" });
  assert.equal(store.list({ taskId:"task-a" })[0].id, first.id); store.remove(first.id); assert.equal(store.list({ taskId:"task-a" }).length, 0); assert.throws(() => store.add({ note:"x".repeat(MAX_NOTE_LENGTH + 1) }), /characters/);
  fs.rmSync(root, { recursive:true, force:true });
});
