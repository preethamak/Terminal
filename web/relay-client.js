// Browser half of Vertex's relay protocol. The relay receives only { nonce,
// ciphertext, tag }; plaintext terminal input/output never leaves this client.
export class VertexRelayClient {
  constructor(config) {
    this.config = config; this.socket = null; this.queue = []; this.onmessage = () => {}; this.onstatus = () => {};
    this.clientId = config.clientId || crypto.randomUUID(); this.reconnectTimer = null;
  }
  async key() {
    if (!this.cryptoKey) this.cryptoKey = crypto.subtle.importKey("raw", this.bytes(this.config.key), { name:"AES-GCM" }, false, ["encrypt", "decrypt"]);
    return this.cryptoKey;
  }
  bytes(value) { const raw = atob(value.replace(/-/g,"+").replace(/_/g,"/")); return Uint8Array.from(raw, (char) => char.charCodeAt(0)); }
  base64url(bytes) { let value = ""; bytes.forEach((byte) => { value += String.fromCharCode(byte); }); return btoa(value).replace(/\+/g,"-").replace(/\//g,"_").replace(/=+$/,""); }
  async encrypt(message) { const nonce = crypto.getRandomValues(new Uint8Array(12)); const ciphertext = await crypto.subtle.encrypt({ name:"AES-GCM", iv:nonce }, await this.key(), new TextEncoder().encode(JSON.stringify(message))); const all = new Uint8Array(ciphertext); return { n:this.base64url(nonce), c:this.base64url(all.slice(0,-16)), t:this.base64url(all.slice(-16)) }; }
  async decrypt(frame) { const data = new Uint8Array([...this.bytes(frame.c), ...this.bytes(frame.t)]); const plaintext = await crypto.subtle.decrypt({ name:"AES-GCM", iv:this.bytes(frame.n) }, await this.key(), data); return JSON.parse(new TextDecoder().decode(plaintext)); }
  connect() {
    const url = new URL(this.config.relay); url.searchParams.set("role", "device"); url.searchParams.set("machine", this.config.machine); url.searchParams.set("client", this.clientId);
    const socket = new WebSocket(url); this.socket = socket;
    socket.onopen = () => { this.onstatus("online"); const queued = this.queue.splice(0); queued.forEach((item) => this.send(item)); };
    socket.onmessage = async ({ data }) => { try { const envelope = JSON.parse(data); if (envelope.type === "frame") this.onmessage(await this.decrypt(envelope.frame)); } catch { /* corrupted relay data is discarded */ } };
    socket.onclose = () => { if (this.socket !== socket) return; this.onstatus("offline"); clearTimeout(this.reconnectTimer); this.reconnectTimer = setTimeout(() => this.connect(), 1200); };
    socket.onerror = () => socket.close();
  }
  async send(message) {
    if (this.socket?.readyState !== WebSocket.OPEN) { this.queue.push(message); return; }
    const frame = await this.encrypt(message);
    this.socket.send(JSON.stringify({ type:"frame", keyId:this.config.keyId, pairCode:this.config.pairCode, frame }));
  }
  close() { clearTimeout(this.reconnectTimer); this.socket?.close(); this.socket = null; }
}
