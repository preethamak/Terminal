const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");
const { newKey } = require("./relay-crypto");

class RelayConfig {
  constructor(root = path.join(process.env.HOME || ".", ".vertex")) {
    this.root = root;
    this.file = path.join(root, "relay.json");
  }

  read() {
    try { return JSON.parse(fs.readFileSync(this.file, "utf8")); }
    catch (error) { if (error.code === "ENOENT") return null; throw error; }
  }

  ensure(relayUrl = process.env.VERTEX_RELAY_URL) {
    const existing = this.read();
    if (existing) return { ...existing, relayUrl: relayUrl || existing.relayUrl || null };
    const config = { machineId: crypto.randomUUID(), relayKey: newKey(), relayUrl: relayUrl || null, createdAt: Date.now() };
    fs.mkdirSync(this.root, { recursive: true, mode: 0o700 });
    fs.writeFileSync(this.file, `${JSON.stringify(config, null, 2)}\n`, { mode: 0o600 });
    return config;
  }
}

module.exports = { RelayConfig };
