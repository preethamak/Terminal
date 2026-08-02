// Cloudflare Worker + Durable Object relay. It only routes opaque frames.
// Deploy later with `wrangler deploy`; no Cloudflare account is required to develop Vertex.
export class MachineRelay {
  constructor(state) { this.state = state; this.agent = null; this.devices = new Map(); }
  async fetch(request) {
    if (request.headers.get("Upgrade") !== "websocket") return new Response("Vertex relay", { status: 200 });
    const url = new URL(request.url); const role = url.searchParams.get("role"); const client = url.searchParams.get("client");
    if (!["agent", "device"].includes(role) || (role === "device" && !client)) return new Response("Bad relay connection", { status: 400 });
    const pair = new WebSocketPair(); const [browser, socket] = Object.values(pair); socket.accept();
    if (role === "agent") { this.agent?.close(1012, "Agent replaced"); this.agent = socket; }
    else { this.devices.get(client)?.close(1012, "Device replaced"); this.devices.set(client, socket); }
    socket.addEventListener("message", (event) => this.route(role, client, socket, event.data));
    socket.addEventListener("close", () => { if (role === "agent" && this.agent === socket) this.agent = null; if (role === "device" && this.devices.get(client) === socket) this.devices.delete(client); });
    return new Response(null, { status: 101, webSocket: browser });
  }
  route(role, client, socket, value) {
    if (typeof value !== "string" || value.length > 1024 * 1024) return socket.close(1009, "Frame too large");
    let envelope; try { envelope = JSON.parse(value); } catch { return; }
    if (envelope.type !== "frame" || !envelope.frame || typeof envelope.frame !== "object") return;
    if (role === "device") { if (this.agent) this.agent.send(JSON.stringify({ type: "frame", from: client, keyId: envelope.keyId, pairCode: envelope.pairCode, frame: envelope.frame })); return; }
    const target = this.devices.get(envelope.to);
    if (target) target.send(JSON.stringify({ type: "frame", keyId: envelope.keyId, pairCode: envelope.pairCode, frame: envelope.frame }));
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === "/health") return Response.json({ ok: true });
    if (url.pathname !== "/v1/connect") return new Response("Not found", { status: 404 });
    const machine = url.searchParams.get("machine");
    if (!machine || !/^[a-f0-9-]{36}$/i.test(machine)) return new Response("Invalid machine", { status: 400 });
    return env.MACHINE_RELAY.get(env.MACHINE_RELAY.idFromName(machine)).fetch(request);
  }
};
