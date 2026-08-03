const fs = require("node:fs");
const path = require("node:path");

const MAX_STARTS = 20;

function disk(root) {
  try {
    const stat = fs.statfsSync(root);
    const blockSize = Number(stat.bsize || stat.frsize || 0);
    const totalBytes = Number(stat.blocks || 0) * blockSize;
    const availableBytes = Number(stat.bavail || 0) * blockSize;
    if (!Number.isFinite(totalBytes) || totalBytes <= 0) return null;
    return { totalBytes, availableBytes:Math.max(0, availableBytes), usedPercent:Math.max(0, Math.min(100, Math.round((1 - availableBytes / totalBytes) * 100))) };
  } catch { return null; }
}

class HealthService {
  constructor({ root = path.join(process.env.HOME || ".", ".vertex"), diskRoot = process.env.HOME || process.cwd(), now = () => Date.now(), version = null } = {}) {
    this.root = root;
    this.file = path.join(root, "agent-history.json");
    this.diskRoot = diskRoot;
    this.now = now;
    this.startedAt = now();
    this.version = version || this.readVersion();
    this.relay = { reconnects:0, lastConnectedAt:null, lastDisconnectedAt:null };
    this.recordStart();
  }

  readVersion() { try { return JSON.parse(fs.readFileSync(path.join(__dirname, "..", "package.json"), "utf8")).version || "unknown"; } catch { return "unknown"; } }
  readHistory() { try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (error) { if (error.code === "ENOENT") return { starts:[] }; throw error; } }
  writeHistory(history) { fs.mkdirSync(this.root, { recursive:true, mode:0o700 }); fs.writeFileSync(this.file, `${JSON.stringify(history, null, 2)}\n`, { mode:0o600 }); }
  recordStart() { const history = this.readHistory(); history.starts = [this.startedAt, ...(history.starts || [])].slice(0, MAX_STARTS); this.writeHistory(history); }
  relayConnected() { this.relay.lastConnectedAt = this.now(); }
  relayDisconnected() { this.relay.reconnects += 1; this.relay.lastDisconnectedAt = this.now(); }
  status() {
    const now = this.now(); const starts = this.readHistory().starts || [];
    return { version:this.version, startedAt:this.startedAt, uptimeSeconds:Math.max(0, Math.round((now - this.startedAt) / 1000)), disk:disk(this.diskRoot), relay:{ ...this.relay }, recentStarts:starts.slice(0, 5), checkedAt:now };
  }
}

module.exports = { HealthService, disk, MAX_STARTS };
