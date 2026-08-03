const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAX_CHECKPOINTS = 200;
const MAX_NOTE_LENGTH = 2400;

class CheckpointStore {
  constructor(root = path.join(process.env.HOME || ".", ".vertex")) { this.root = root; this.file = path.join(root, "checkpoints.json"); }
  read() { try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
  write(items) { fs.mkdirSync(this.root, { recursive:true, mode:0o700 }); fs.writeFileSync(this.file, `${JSON.stringify(items.slice(0, MAX_CHECKPOINTS), null, 2)}\n`, { mode:0o600 }); }
  list({ taskId = null, session = null } = {}) { return this.read().filter((item) => (!taskId || item.taskId === taskId) && (!session || item.session === session)).sort((a, b) => b.createdAt - a.createdAt); }
  add({ note, taskId = null, session = null, cwd = null }) {
    const value = String(note || "").trim();
    if (!value || value.length > MAX_NOTE_LENGTH) throw new Error(`Checkpoint notes must be 1–${MAX_NOTE_LENGTH} characters.`);
    const item = { id:crypto.randomUUID(), note:value, taskId:taskId || null, session:session || null, cwd:cwd || null, createdAt:Date.now() };
    this.write([item, ...this.read()]); return item;
  }
  remove(id) { const items = this.read(); if (!items.some((item) => item.id === id)) throw new Error("Checkpoint not found."); this.write(items.filter((item) => item.id !== id)); }
}

module.exports = { CheckpointStore, MAX_CHECKPOINTS, MAX_NOTE_LENGTH };
