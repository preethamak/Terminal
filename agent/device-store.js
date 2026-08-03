const crypto = require("node:crypto");
const fs = require("node:fs");
const path = require("node:path");

class DeviceStore {
  constructor(root = path.join(process.env.HOME || ".", ".vertex")) {
    this.root = root;
    this.file = path.join(root, "devices.json");
    this.challenges = new Map();
  }

  read() { try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
  write(devices) { fs.mkdirSync(this.root, { recursive: true, mode: 0o700 }); fs.writeFileSync(this.file, `${JSON.stringify(devices, null, 2)}\n`, { mode: 0o600 }); }

  createChallenge() {
    const code = crypto.randomBytes(24).toString("base64url");
    this.challenges.set(code, { expiresAt: Date.now() + 10 * 60 * 1000, relayKey: crypto.randomBytes(32).toString("base64url") });
    return code;
  }

  pairingKey(code) {
    const challenge = this.challenges.get(code);
    if (!challenge || challenge.expiresAt < Date.now()) return null;
    return challenge.relayKey;
  }

  pair(code, name = "Android phone") {
    const challenge = this.challenges.get(code);
    if (!challenge || challenge.expiresAt < Date.now()) throw new Error("That pairing QR has expired. Generate a new one on the laptop.");
    this.challenges.delete(code);
    const device = { id: crypto.randomUUID(), name: name.slice(0, 80), token: crypto.randomBytes(32).toString("base64url"), relayKey: crypto.randomBytes(32).toString("base64url"), createdAt: Date.now(), revoked: false };
    const devices = this.read(); devices.push(device); this.write(devices);
    return device;
  }

  findByToken(token) {
    const candidate = Buffer.from(token || "");
    return this.read().find((device) => {
      const value = Buffer.from(device.token);
      return !device.revoked && value.length === candidate.length && crypto.timingSafeEqual(value, candidate);
    });
  }

  findRelayKey(id) {
    const device = this.read().find((entry) => entry.id === id && !entry.revoked);
    return device?.relayKey || null;
  }

  setPushToken(id, pushToken) {
    if (typeof pushToken !== "string" || pushToken.length < 20 || pushToken.length > 4096) throw new Error("Invalid Android push token.");
    const devices = this.read(); const device = devices.find((entry) => entry.id === id && !entry.revoked);
    if (!device) throw new Error("Paired device not found.");
    device.pushToken = pushToken; device.pushUpdatedAt = Date.now(); this.write(devices); return device;
  }

  removePushTokens(tokens) {
    const rejected = new Set(tokens || []); if (!rejected.size) return;
    const devices = this.read(); let changed = false;
    for (const device of devices) if (rejected.has(device.pushToken)) { delete device.pushToken; delete device.pushUpdatedAt; changed = true; }
    if (changed) this.write(devices);
  }

  revoke(id) { const devices = this.read(); const device = devices.find((entry) => entry.id === id); if (!device) throw new Error("Device not found."); device.revoked = true; delete device.pushToken; delete device.pushUpdatedAt; this.write(devices); }
}

module.exports = { DeviceStore };
