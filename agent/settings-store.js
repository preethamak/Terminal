const fs = require("node:fs");
const path = require("node:path");

const DEFAULTS = Object.freeze({ preventSleep:true });

class SettingsStore {
  constructor(root = path.join(process.env.HOME || ".", ".vertex")) { this.root = root; this.file = path.join(root, "settings.json"); }
  read() { try { return { ...DEFAULTS, ...JSON.parse(fs.readFileSync(this.file, "utf8")) }; } catch (error) { if (error.code === "ENOENT") return { ...DEFAULTS }; throw error; } }
  update(values) { if (typeof values.preventSleep !== "boolean") throw new Error("preventSleep must be true or false."); const next = { ...this.read(), preventSleep:values.preventSleep }; fs.mkdirSync(this.root, { recursive:true, mode:0o700 }); fs.writeFileSync(this.file, `${JSON.stringify(next, null, 2)}\n`, { mode:0o600 }); return next; }
}

module.exports = { SettingsStore, DEFAULTS };
