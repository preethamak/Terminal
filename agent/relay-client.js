const { EventEmitter } = require("node:events");
const WebSocket = require("ws");
const { decrypt, encrypt } = require("./relay-crypto");

class RelayClient extends EventEmitter {
  constructor({ relayUrl, machineId, devices, pairingKey }) {
    super();
    this.relayUrl = relayUrl;
    this.machineId = machineId;
    this.devices = devices;
    this.pairingKey = pairingKey;
    this.socket = null;
    this.reconnectTimer = null;
    this.clients = new Map();
    this.pairingKeys = new Map();
  }

  start() { if (this.relayUrl) this.connect(); }
  stop() { clearTimeout(this.reconnectTimer); this.socket?.close(); }
  online() { return this.socket?.readyState === WebSocket.OPEN; }
  connect() {
    const url = new URL(this.relayUrl);
    url.searchParams.set("role", "agent"); url.searchParams.set("machine", this.machineId);
    const socket = new WebSocket(url);
    this.socket = socket;
    socket.on("open", () => this.emit("online"));
    socket.on("message", (raw) => this.receive(raw));
    socket.on("error", () => {});
    socket.on("close", () => {
      if (this.socket !== socket) return;
      this.emit("offline");
      this.reconnectTimer = setTimeout(() => this.connect(), 1500);
    });
  }

  receive(raw) {
    let envelope;
    try { envelope = JSON.parse(raw.toString()); } catch { return; }
    if (envelope.type !== "frame" || !envelope.from || !envelope.frame) return;
    const key = envelope.keyId === "pair" ? this.pairingKey(envelope.pairCode) : this.devices.findRelayKey(envelope.keyId);
    if (!key) return;
    try {
      const message = decrypt(key, envelope.frame);
      if (envelope.keyId === "pair") this.pairingKeys.set(envelope.pairCode, key);
      this.clients.set(envelope.keyId === "pair" ? `pair:${envelope.pairCode}` : envelope.keyId, envelope.from);
      this.emit("message", { message, keyId: envelope.keyId, pairCode: envelope.pairCode, from: envelope.from });
    } catch { /* Authentication failure: do not reveal details to the relay. */ }
  }

  send({ keyId, pairCode, message }) {
    const key = keyId === "pair" ? (this.pairingKeys.get(pairCode) || this.pairingKey(pairCode)) : this.devices.findRelayKey(keyId);
    const destination = this.clients.get(keyId === "pair" ? `pair:${pairCode}` : keyId);
    if (!key || !destination || !this.online()) return false;
    this.socket.send(JSON.stringify({ type: "frame", to: destination, keyId, pairCode, frame: encrypt(key, message) }));
    return true;
  }
}

module.exports = { RelayClient };
