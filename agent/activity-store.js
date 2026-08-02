const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

const MAX_ACTIVITIES = 200;

class ActivityStore {
  constructor(root = path.join(process.env.HOME || ".", ".vertex")) {
    this.root = root; this.file = path.join(root, "activity.json");
  }

  read() { try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
  write(activities) { fs.mkdirSync(this.root, { recursive:true, mode:0o700 }); fs.writeFileSync(this.file, `${JSON.stringify(activities.slice(0, MAX_ACTIVITIES), null, 2)}\n`, { mode:0o600 }); }
  list() { return this.read().sort((a, b) => b.createdAt - a.createdAt); }

  add({ type, taskId = null, session = null, title, detail = "", fingerprint = null }) {
    const activities = this.read();
    if (fingerprint && activities.some((entry) => entry.fingerprint === fingerprint)) return null;
    const activity = { id:crypto.randomUUID(), type, taskId, session, title:String(title).slice(0, 160), detail:String(detail).slice(0, 400), fingerprint, createdAt:Date.now(), readAt:null };
    activities.unshift(activity); this.write(activities); return activity;
  }

  markRead(id = null) {
    const activities = this.read(); const now = Date.now();
    for (const activity of activities) if ((!id || activity.id === id) && !activity.readAt) activity.readAt = now;
    this.write(activities); return activities;
  }
}

module.exports = { ActivityStore, MAX_ACTIVITIES };
