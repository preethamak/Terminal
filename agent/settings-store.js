const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = Object.freeze({ preventSleep:true, travelMode:true, agentLocked:false });

class SettingsStore {
  constructor(root = path.join(process.env.HOME || ".", ".vertex")) { this.root = root; this.file = path.join(root, "settings.json"); }
  read() { try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(this.file, "utf8")) }; } catch (error) { if (error.code === "ENOENT") return { ...DEFAULTS }; throw error; } }
  update(values) {
    const allowed = ["preventSleep", "travelMode", "agentLocked"];
    const supplied = allowed.filter((key) => Object.hasOwn(values || {}, key));
    if (!supplied.length || supplied.some((key) => typeof values[key] !== "boolean")) throw new Error("Settings must use true or false values.");
    const next = { ...this.read() }; for (const key of supplied) next[key] = values[key];
    fs.mkdirSync(this.root, { recursive:true, mode:0o700 }); fs.writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`, { mode:0o600 }); return next;
  }
}

module.exports = { SettingsStore, DEFAULTS };
