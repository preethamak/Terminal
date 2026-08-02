// Local development equivalent of relay/worker.js. It is never needed by an
// end user; it lets us test the production transport before a Cloudflare deploy.
const http = require("node:http");
const { WebSocketServer } = require("ws");

const port = Number(process.env.VERTEX_RELAY_PORT || 8790);
const server = http.createServer((request, response) => {
  if (new URL(request.url, "http://localhost").pathname === "/health") { response.writeHead(200, { "content-type":"application/json" }); return response.end('{"ok":true}'); }
  response.writeHead(404); response.end();
});
const sockets = new WebSocketServer({ noServer:true }); const machines = new Map();
function machine(id) { if (!machines.has(id)) machines.set(id, { agent:null, devices:new Map() }); return machines.get(id); }
function safeSend(socket, message) { if (socket && socket.readyState === socket.OPEN) socket.send(JSON.stringify(message)); }
server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, "http://localhost");
  if (url.pathname !== "/v1/connect") return socket.destroy();
  const role = url.searchParams.get("role"), id = url.searchParams.get("machine"), client = url.searchParams.get("client");
  if (!/^[a-f0-9-]{36}$/i.test(id || "") || !["agent","device"].includes(role) || (role === "device" && !client)) return socket.destroy();
  sockets.handleUpgrade(request, socket, head, (ws) => {
    const room = machine(id); if (role === "agent") { room.agent?.close(); room.agent = ws; } else { room.devices.get(client)?.close(); room.devices.set(client, ws); }
    ws.on("message", (raw) => {
      if (raw.length > 1024 * 1024) return ws.close(1009, "Frame too large");
      let envelope; try { envelope = JSON.parse(raw.toString()); } catch { return; }
      if (envelope.type !== "frame" || !envelope.frame || typeof envelope.frame !== "object") return;
      if (role === "device") safeSend(room.agent, { type:"frame", from:client, keyId:envelope.keyId, pairCode:envelope.pairCode, frame:envelope.frame });
      else safeSend(room.devices.get(envelope.to), { type:"frame", keyId:envelope.keyId, pairCode:envelope.pairCode, frame:envelope.frame });
    });
    ws.on("close", () => { if (role === "agent" && room.agent === ws) room.agent = null; if (role === "device" && room.devices.get(client) === ws) room.devices.delete(client); });
  });
});
if (require.main === module) server.listen(port, "127.0.0.1", () => console.log(`Vertex local relay on ws://127.0.0.1:${port}/v1/connect`));
module.exports = { safeSend };
