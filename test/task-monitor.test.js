const test = require("node:test");
const assert = require("node:assert/strict");
const { TaskMonitor, attentionFromOutput, plain } = require("../agent/task-monitor");

test("task monitor identifies an approval-like terminal prompt", () => {
  const attention = attentionFromOutput("\u001b[32mCodex changed 2 files\u001b[0m\nAllow this command? [y/n]");
  assert.equal(attention.kind, "approval"); assert.equal(attention.canApprove, true); assert.match(attention.message, /Allow this command/);
  assert.equal(attentionFromOutput("Continue with this deployment?").canApprove, false);
  assert.equal(attentionFromOutput("Compiling project…\nFinished in 2s"), null);
  assert.equal(plain("\u001b[31mfailed\u001b[0m"), "failed");
});

test("task monitor stores a local attention event for a waiting task", async () => {
  const tasks = { values:[{ id:"task-1", name:"codex-1", status:"running", createdAt:1 }], sync() { return this.values; }, update(id, patch) { Object.assign(this.values.find((task) => task.id === id), patch); }, list() { return this.values; } };
  const records = []; const monitor = new TaskMonitor({ tasks, manager:{ snapshot:async () => "Approve the proposed changes? (yes/no)" }, activities:{ add:(value) => records.push(value) } });
  await monitor.poll();
  assert.equal(tasks.values[0].status, "waiting"); assert.equal(records[0].type, "attention");
});
