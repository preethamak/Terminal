const crypto = require("node:crypto");

function plain(value) { return String(value || "").replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "").replace(/\r/g, ""); }

function attentionFromOutput(output) {
  const lines = plain(output).split("\n").map((line) => line.trim()).filter(Boolean).slice(-12);
  const relevant = lines.reverse().find((line) => /(?:\[\s*[yn]\s*(?:\/|\\)\s*[yn]\s*\]|\(\s*y(?:es)?\s*\/\s*n(?:o)?\s*\)|\b(?:approve|allow|permission|proceed|continue)\b)/i.test(line));
  if (!relevant) return null;
  const canApprove = /(?:\[\s*y\s*(?:\/|\\)\s*n\s*\]|\(\s*y(?:es)?\s*\/\s*n(?:o)?\s*\))/i.test(relevant);
  return { kind:"approval", canApprove, message:relevant.slice(0, 280), signature:crypto.createHash("sha256").update(relevant).digest("hex") };
}

class TaskMonitor {
  constructor({ tasks, manager, activities }) { this.tasks = tasks; this.manager = manager; this.activities = activities; this.polling = null; }

  async poll() {
    if (this.polling) return this.polling;
    this.polling = this.check();
    try { return await this.polling; } finally { this.polling = null; }
  }

  async check() {
    const current = this.tasks.sync({ includeArchived:true });
    for (const task of current) {
      if (task.status !== "running" && task.status !== "waiting") continue;
      let output; try { output = await this.manager.snapshot(task.sessionName || task.name); } catch { continue; }
      const snapshot = plain(output).slice(-6000); const digest = crypto.createHash("sha256").update(snapshot).digest("hex");
      if (task.outputDigest === digest) continue;
      const attention = attentionFromOutput(snapshot);
      const patch = { outputDigest:digest, lastActivityAt:Date.now(), lastOutput:snapshot.slice(-700) };
      if (attention) {
        patch.status = "waiting"; patch.attention = attention;
        this.activities.add({ type:"attention", taskId:task.id, session:task.sessionName || task.name, title:"AI task needs your input", detail:attention.message, fingerprint:`attention:${task.id}:${attention.signature}` });
      } else if (task.status === "waiting") { patch.status = "running"; patch.attention = null; }
      this.tasks.update(task.id, patch);
    }
    for (const task of this.tasks.sync({ includeArchived:true })) {
      if (!task.finishedAt || task.completionNotifiedAt) continue;
      const failed = task.status === "failed";
      this.activities.add({ type:failed ? "failed" : "completed", taskId:task.id, session:task.sessionName || task.name, title:failed ? "Task failed" : "Task completed", detail:task.name, fingerprint:`completion:${task.id}:${task.status}` });
      this.tasks.update(task.id, { completionNotifiedAt:Date.now() });
    }
    return this.tasks.list();
  }
}

module.exports = { TaskMonitor, attentionFromOutput, plain };
