const fs = require("node:fs");
const path = require("node:path");

class TaskStore {
  constructor(root = path.join(process.env.HOME || ".", ".vertex")) {
    this.root = root;
    this.file = path.join(root, "tasks.json");
    this.events = path.join(root, "task-events");
    fs.mkdirSync(this.events, { recursive: true, mode: 0o700 });
  }

  read() {
    try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; }
  }

  write(tasks) {
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.file, `${JSON.stringify(tasks, null, 2)}\n`, { mode: 0o600 });
  }

  add(task) { const tasks = this.read(); tasks.push(task); this.write(tasks); return task; }

  update(id, patch) {
    const tasks = this.read(); const task = tasks.find((entry) => entry.id === id);
    if (!task) throw new Error("Task not found.");
    Object.assign(task, patch); this.write(tasks); return task;
  }

  archive(id, archived = true) { return this.update(id, { archived:Boolean(archived), archivedAt:archived ? Date.now() : null }); }
  pin(id, pinned = true) { return this.update(id, { pinned:Boolean(pinned) }); }

  list({ includeArchived = false } = {}) { return this.read().filter((task) => includeArchived || !task.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt); }

  eventFile(id) { return path.join(this.events, `${id}.json`); }

  find(id) { return this.read().find((task) => task.id === id); }
  findBySession(name) { return this.read().find((task) => (task.sessionName || task.name) === name); }

  review(id, decision) {
    if (!['approved', 'needs_changes'].includes(decision)) throw new Error("Invalid review decision.");
    const tasks = this.read(); const task = tasks.find((entry) => entry.id === id);
    if (!task) throw new Error("Task not found.");
    task.review = { decision, reviewedAt: Date.now() }; this.write(tasks); return task;
  }

  sync({ includeArchived = false } = {}) {
    const tasks = this.read(); let changed = false;
    for (const task of tasks) {
      if (task.status !== "running") continue;
      try {
        const event = JSON.parse(fs.readFileSync(task.eventFile, "utf8"));
        task.status = event.status;
        task.exitCode = event.exitCode;
        task.finishedAt = Date.now();
        changed = true;
      } catch (error) { if (error.code !== "ENOENT") throw error; }
    }
    if (changed) this.write(tasks);
    return tasks.filter((task) => includeArchived || !task.archived).sort((a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt - a.createdAt);
  }
}

module.exports = { TaskStore };
