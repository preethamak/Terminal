const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const os = require("node:os");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const { WebSocketServer } = require("ws");
const { SessionManager } = require("./session-manager");
const { shellQuote } = require("./session-manager");
const { TaskStore } = require("./task-store");
const { DeviceStore } = require("./device-store");
const { outputSequencer, validateResize } = require("./terminal-protocol");
const { ProjectIndex } = require("./project-index");
const { appendEvent, event } = require("./adapters/adapter");
const { diffForTask: diffForTaskService } = require("./diff-service");
const { RelayConfig } = require("./relay-config");
const { RelayClient } = require("./relay-client");
const { ActivityStore } = require("./activity-store");
const { TaskMonitor } = require("./task-monitor");
const { NotificationService } = require("./notification-service");
const { FileService } = require("./file-service");
const { GitService } = require("./git-service");
const { DockerService } = require("./docker-service");
const { SettingsStore } = require("./settings-store");
const { WorkspaceIndex } = require("./workspace-index");
const { WorkspaceService } = require("./workspace-service");

const PORT = Number(process.env.VERTEX_PORT || 8787);
const HOST = process.env.VERTEX_HOST || "0.0.0.0";
const TOKEN_FILE = process.env.VERTEX_TOKEN_FILE || path.join(process.env.HOME || ".", ".vertex", "token");
const PAIRING_FILE = path.join(process.env.HOME || ".", ".vertex", "pairing.json");
const manager = new SessionManager();
const execFileAsync = promisify(execFile);
const tasks = new TaskStore();
const devices = new DeviceStore();
const activities = new ActivityStore();
const notifications = new NotificationService({ activities });
const taskMonitor = new TaskMonitor({ tasks, manager, activities });
const relayConfig = new RelayConfig().ensure();
const projects = new ProjectIndex();
const workspaceIndex = new WorkspaceIndex();
const workspaces = new WorkspaceService({ index:workspaceIndex });
const files = new FileService({ projects });
const git = new GitService({ projects });
const docker = new DockerService();
const settings = new SettingsStore();
const WEB_ROOT = fs.existsSync(path.join(__dirname, "..", "dist")) ? path.join(__dirname, "..", "dist") : path.join(__dirname, "..", "web");

function loadToken() {
  if (process.env.VERTEX_TOKEN) return process.env.VERTEX_TOKEN;
  fs.mkdirSync(path.dirname(TOKEN_FILE), { recursive: true, mode: 0o700 });
  try {
    return fs.readFileSync(TOKEN_FILE, "utf8").trim();
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    const token = crypto.randomBytes(32).toString("base64url");
    fs.writeFileSync(TOKEN_FILE, `${token}\n`, { mode: 0o600 });
    return token;
  }
}

const token = loadToken();

function localAddress() {
  for (const entries of Object.values(os.networkInterfaces())) {
    for (const entry of entries || []) {
      if (entry.family === "IPv4" && !entry.internal && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(entry.address)) return entry.address;
    }
  }
  return null;
}

function authorized(request) {
  const supplied = request.headers.authorization?.replace(/^Bearer\s+/i, "") || new URL(request.url, "http://localhost").searchParams.get("token");
  if (!supplied) return false;
  if (devices.findByToken(supplied)) return true;
  const expected = Buffer.from(token);
  const actual = Buffer.from(supplied);
  return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
}

function readJson(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.on("data", (chunk) => { body += chunk; if (body.length > 64 * 1024) request.destroy(); });
    request.on("end", () => { try { resolve(JSON.parse(body || "{}")); } catch { reject(new Error("Invalid JSON.")); } });
    request.on("error", reject);
  });
}

function json(response, status, body) {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(body));
}

function writePairingUrl(url) {
  fs.mkdirSync(path.dirname(PAIRING_FILE), { recursive:true, mode:0o700 });
  fs.writeFileSync(PAIRING_FILE, `${JSON.stringify({ url, createdAt:Date.now(), expiresAt:Date.now() + 10 * 60 * 1000 })}\n`, { mode:0o600 });
  fs.chmodSync(PAIRING_FILE, 0o600);
}

function health() {
  return { ok:true, hostname:os.hostname(), platform:process.platform, uptimeSeconds:Math.round(process.uptime()), projects:projects.list().length, notification:notifications.status(), preventSleep:settings.read().preventSleep, checkedAt:Date.now() };
}

async function listWorkspaces({ refreshProjects = false } = {}) {
  if (refreshProjects) await projects.refresh();
  return workspaceIndex.list({ sessions:await manager.list(), tasks:tasks.sync(), projects:projects.list() });
}

async function controlSession({ action, name, nextName, taskId }) {
  if (action === "stop") {
    const result = await manager.kill(name); const task = tasks.findBySession(name); if (task) tasks.update(task.id, { status:"stopped", finishedAt:Date.now(), attention:null });
    activities.add({ type:"session_stopped", taskId:task?.id || null, session:name, title:"Session stopped", detail:name, fingerprint:`stopped:${name}:${Date.now()}` }); return result;
  }
  if (action === "rename") {
    const result = await manager.rename(name, nextName); const task = tasks.findBySession(name); if (task) tasks.update(task.id, { name:nextName, sessionName:nextName }); return result;
  }
  if (action === "pin" || action === "archive") {
    if (!taskId) throw new Error("A task is required.");
    return action === "pin" ? tasks.pin(taskId) : tasks.archive(taskId);
  }
  throw new Error("Unsupported session action.");
}

function createTestActivity() {
  const activity = activities.add({ type:"test", title:"Vertex test received", detail:"Your phone reached the laptop through Vertex's encrypted connection.", fingerprint:`test:${Date.now()}` });
  return { activity };
}

function sendWebFile(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\//, "");
  const file = path.resolve(WEB_ROOT, requested);
  if (!file.startsWith(`${WEB_ROOT}${path.sep}`)) return false;
  try {
    const contents = fs.readFileSync(file);
    const types = { ".css": "text/css", ".html": "text/html", ".js": "text/javascript", ".json": "application/manifest+json", ".svg": "image/svg+xml" };
    response.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    response.end(contents);
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

function sendVendorFile(request, response) {
  const pathname = new URL(request.url, "http://localhost").pathname;
  const files = {
    "/vendor/xterm.js": ["@xterm/xterm/lib/xterm.js", "text/javascript"],
    "/vendor/xterm.css": ["@xterm/xterm/css/xterm.css", "text/css"],
    "/vendor/addon-fit.js": ["@xterm/addon-fit/lib/addon-fit.js", "text/javascript"],
  };
  const item = files[pathname];
  if (!item) return false;
  response.writeHead(200, { "content-type": item[1], "cache-control": "public, max-age=31536000, immutable" });
  fs.createReadStream(path.join(__dirname, "..", "node_modules", item[0])).pipe(response);
  return true;
}

const server = http.createServer(async (request, response) => {
  const pathname = new URL(request.url, "http://localhost").pathname;
  if (pathname === "/health") return json(response, 200, { ok:true });
  if (request.method === "GET" && sendVendorFile(request, response)) return;
  if (request.method === "GET" && sendWebFile(request, response)) return;
  if (request.method === "POST" && pathname === "/pair") {
    try {
      const body = await readJson(request);
      const device = devices.pair(body.code, body.name);
      return json(response, 201, { token: device.token, device: { id: device.id, name: device.name } });
    } catch (error) { return json(response, 400, { error: error.message }); }
  }
  if (!authorized(request)) return json(response, 401, { error: "Unauthorized" });
  if (pathname === "/sessions" && request.method === "GET") {
    try {
      return json(response, 200, { sessions: await manager.list() });
    } catch (error) {
      return json(response, 503, { error: error.message });
    }
  }
  if (pathname === "/sessions" && request.method === "POST") {
    try {
      const body = await readJson(request);
      return json(response, 201, { session: await manager.create({ name:body.name, cwd:body.cwd }) });
    } catch (error) {
      return json(response, 400, { error: error.message });
    }
  }
  if (pathname === "/tasks") return json(response, 200, { tasks: tasks.sync() });
  if (pathname === "/activity" && request.method === "GET") return json(response, 200, { activities:activities.list() });
  if (pathname === "/activity/read" && request.method === "POST") { const body = await readJson(request); return json(response, 200, { activities:activities.markRead(body.id || null) }); }
  if (pathname === "/activity/test" && request.method === "POST") return json(response, 201, createTestActivity());
  if (pathname === "/device-health" && request.method === "GET") return json(response, 200, health());
  if (pathname === "/settings" && request.method === "GET") return json(response, 200, settings.read());
  if (pathname === "/settings" && request.method === "POST") return json(response, 200, settings.update(await readJson(request)));
  if (pathname === "/files" && request.method === "GET") { const query = new URL(request.url, "http://localhost").searchParams; return json(response, 200, await files.list({ projectPath:query.get("project"), relativePath:query.get("path") || "" })); }
  if (pathname === "/files/preview" && request.method === "GET") { const query = new URL(request.url, "http://localhost").searchParams; return json(response, 200, await files.preview({ projectPath:query.get("project"), relativePath:query.get("path") || "" })); }
  if (pathname === "/git" && request.method === "GET") { const query = new URL(request.url, "http://localhost").searchParams; return json(response, 200, await git.status({ projectPath:query.get("project") })); }
  if (pathname === "/docker" && request.method === "GET") return json(response, 200, await docker.list());
  if (pathname === "/docker/log" && request.method === "GET") { const query = new URL(request.url, "http://localhost").searchParams; return json(response, 200, await docker.logs({ container:query.get("container") })); }
  if (pathname === "/devices" && request.method === "GET") return json(response, 200, { devices: devices.read().map(({ token: _token, relayKey: _relayKey, ...device }) => device) });
  const revokeMatch = pathname.match(/^\/devices\/([a-f0-9-]+)\/revoke$/);
  if (request.method === "POST" && revokeMatch) { devices.revoke(revokeMatch[1]); activities.add({ type:"device_revoked", title:"Device access revoked", detail:revokeMatch[1].slice(0, 8), fingerprint:`revoked:${revokeMatch[1]}` }); return json(response, 200, { ok:true }); }
  const sessionActionMatch = pathname.match(/^\/sessions\/([^/]+)\/action$/);
  if (request.method === "POST" && sessionActionMatch) { const body = await readJson(request); return json(response, 200, { result:await controlSession({ ...body, name:decodeURIComponent(sessionActionMatch[1]) }) }); }
  if (pathname === "/projects" && request.method === "GET") return json(response, 200, { projects: projects.list() });
  if (pathname === "/projects/refresh" && request.method === "POST") return json(response, 200, { projects: await projects.refresh() });
  if (pathname === "/workspaces" && request.method === "GET") return json(response, 200, { workspaces:await listWorkspaces() });
  if (pathname === "/workspaces/refresh" && request.method === "POST") return json(response, 200, { workspaces:await listWorkspaces({ refreshProjects:true }) });
  if (pathname === "/workspace-roots" && request.method === "GET") return json(response, 200, { roots:await workspaces.roots() });
  if (pathname === "/workspace-roots" && request.method === "POST") { const body = await readJson(request); return json(response, 201, { roots:await workspaces.addRoot(body.root) }); }
  if (pathname === "/workspaces" && request.method === "POST") { const body = await readJson(request); return json(response, 201, { workspace:await workspaces.create({ root:body.root, name:body.name, initialiseGit:Boolean(body.initialiseGit) }) }); }
  const diffMatch = pathname.match(/^\/tasks\/([a-f0-9-]+)\/diff$/);
  if (request.method === "GET" && diffMatch) {
    try { return json(response, 200, await diffForTask(diffMatch[1])); } catch (error) { return json(response, 400, { error: error.message }); }
  }
  const reviewMatch = pathname.match(/^\/tasks\/([a-f0-9-]+)\/review$/);
  if (request.method === "POST" && reviewMatch) {
    try { const body = await readJson(request); return json(response, 200, { task: tasks.review(reviewMatch[1], body.decision) }); } catch (error) { return json(response, 400, { error: error.message }); }
  }
  return json(response, 404, { error: "Not found" });
});

const websocket = new WebSocketServer({ noServer: true });
server.on("upgrade", (request, socket, head) => {
  if (!authorized(request)) return socket.destroy();
  websocket.handleUpgrade(request, socket, head, (client) => websocket.emit("connection", client));
});

function send(client, message) {
  if (client.readyState === client.OPEN) client.send(JSON.stringify(message));
}

function commandForTask({ cli, prompt, command }) {
  if (cli === "codex") return `codex ${shellQuote(prompt || "")}`;
  if (cli === "claude") return `claude ${shellQuote(prompt || "")}`;
  if (cli === "command" && command) return command;
  throw new Error("Choose Codex, Claude, or provide a command.");
}

async function createTask(message) {
  const id = crypto.randomUUID();
  const name = message.name;
  let baseRef = null; let branch = "detached";
  try { ({ stdout: baseRef } = await execFileAsync("git", ["rev-parse", "HEAD"], { cwd: message.cwd })); baseRef = baseRef.trim(); } catch { /* non-git project */ }
  try { ({ stdout: branch } = await execFileAsync("git", ["branch", "--show-current"], { cwd: message.cwd })); branch = branch.trim() || "detached"; } catch { /* non-git project */ }
  const task = {
    id, name, sessionName:name, cwd: message.cwd, projectName: path.basename(message.cwd), branch, cli: message.cli, prompt: message.prompt || "", status: "running",
    createdAt: Date.now(), eventFile: tasks.eventFile(id), baseRef,
  };
  await manager.create({ name, cwd: message.cwd, command: commandForTask(message), eventFile: task.eventFile, preventSleep:settings.read().preventSleep });
  tasks.add(task);
  appendEvent(task, event(task, "task_started", { cli: task.cli, prompt: task.prompt }));
  activities.add({ type:"started", taskId:id, session:name, title:"Task started", detail:name, fingerprint:`started:${id}` });
  projects.touch(message.cwd);
  return task;
}

async function diffForTask(id) {
  const task = tasks.find(id);
  return { task, ...(await diffForTaskService(task)) };
}

function attachClient(client) {
  let terminal; let attachedName = null;
  send(client, { type: "ready" });

  client.on("message", async (raw) => {
    let message;
    try {
      message = JSON.parse(raw.toString());
    } catch {
      return send(client, { type: "error", message: "Messages must be JSON." });
    }
    try {
      if (message.type === "list") return send(client, { type: "sessions", requestId: message.requestId, sessions: await manager.list() });
      if (message.type === "listTasks") return send(client, { type: "tasks", requestId: message.requestId, tasks: tasks.sync() });
      if (message.type === "listActivity") return send(client, { type:"activity", requestId:message.requestId, activities:activities.list() });
      if (message.type === "readActivity") return send(client, { type:"activity", requestId:message.requestId, activities:activities.markRead(message.id || null) });
      if (message.type === "testActivity") return send(client, { type:"testActivity", requestId:message.requestId, ...createTestActivity() });
      if (message.type === "getHealth") return send(client, { type:"health", requestId:message.requestId, ...health() });
      if (message.type === "getSettings") return send(client, { type:"settings", requestId:message.requestId, ...settings.read() });
      if (message.type === "updateSettings") return send(client, { type:"settings", requestId:message.requestId, ...settings.update(message) });
      if (message.type === "listFiles") return send(client, { type:"files", requestId:message.requestId, ...(await files.list(message)) });
      if (message.type === "readFile") return send(client, { type:"file", requestId:message.requestId, ...(await files.preview(message)) });
      if (message.type === "gitStatus") return send(client, { type:"git", requestId:message.requestId, ...(await git.status(message)) });
      if (message.type === "listDocker") return send(client, { type:"docker", requestId:message.requestId, ...(await docker.list()) });
      if (message.type === "dockerLogs") return send(client, { type:"dockerLogs", requestId:message.requestId, ...(await docker.logs(message)) });
      if (message.type === "listDevices") return send(client, { type:"devices", requestId:message.requestId, devices:devices.read().map(({ token: _token, relayKey: _relayKey, ...device }) => device) });
      if (message.type === "revokeDevice") { devices.revoke(message.id); return send(client, { type:"revoked", requestId:message.requestId, id:message.id }); }
      if (message.type === "sessionAction") return send(client, { type:"sessionAction", requestId:message.requestId, result:await controlSession(message) });
      if (message.type === "listProjects") return send(client, { type: "projects", requestId: message.requestId, projects: projects.list() });
      if (message.type === "refreshProjects") return send(client, { type: "projects", requestId: message.requestId, projects: await projects.refresh() });
      if (message.type === "listWorkspaces") return send(client, { type:"workspaces", requestId:message.requestId, workspaces:await listWorkspaces() });
      if (message.type === "refreshWorkspaces") return send(client, { type:"workspaces", requestId:message.requestId, workspaces:await listWorkspaces({ refreshProjects:true }) });
      if (message.type === "listWorkspaceRoots") return send(client, { type:"workspaceRoots", requestId:message.requestId, roots:await workspaces.roots() });
      if (message.type === "addWorkspaceRoot") return send(client, { type:"workspaceRoots", requestId:message.requestId, roots:await workspaces.addRoot(message.root) });
      if (message.type === "createWorkspace") return send(client, { type:"workspaceCreated", requestId:message.requestId, workspace:await workspaces.create({ root:message.root, name:message.name, initialiseGit:Boolean(message.initialiseGit) }) });
      if (message.type === "taskDiff") return send(client, { type: "diff", requestId: message.requestId, ...(await diffForTask(message.id)) });
      if (message.type === "reviewTask") return send(client, { type: "reviewed", requestId: message.requestId, task: tasks.review(message.id, message.decision) });
      if (message.type === "create") return send(client, { type: "created", requestId: message.requestId, session: await manager.create(message) });
      if (message.type === "createSession") return send(client, { type: "created", requestId: message.requestId, session: await manager.create({ name:message.name, cwd:message.cwd }) });
      if (message.type === "createTask") return send(client, { type: "taskCreated", requestId: message.requestId, task: await createTask(message) });
      if (message.type === "attach") {
        terminal?.kill();
        attachedName = message.name;
        const snapshot = await manager.snapshot(message.name);
        const sequencer = outputSequencer((event) => send(client, event));
        send(client, { type: "terminalSnapshot", sequence: sequencer.current(), data: snapshot });
        terminal = manager.attach(message.name, {
          onData: (data) => sequencer.next(data),
          onExit: ({ exitCode }) => send(client, { type: "closed", exitCode }),
        });
        return send(client, { type: "attached", name: message.name });
      }
      if (message.type === "input" && terminal) { const task = tasks.findBySession(attachedName); if (task?.attention) tasks.update(task.id, { attention:null, status:"running" }); return terminal.write(String(message.data || "")); }
      if (message.type === "resize" && terminal) {
        const size = validateResize(message);
        return terminal.resize(size.cols, size.rows);
      }
      return send(client, { type: "error", message: "Unknown message or no attached session." });
    } catch (error) {
      send(client, { type: "error", message: error.message });
    }
  });
  client.on("close", () => terminal?.kill());
}

websocket.on("connection", attachClient);

void taskMonitor.poll().catch(() => {});
setInterval(() => { void taskMonitor.poll().catch(() => {}); }, 5000).unref();

// The relay connection is optional during development. Once VERTEX_RELAY_URL is set,
// the laptop initiates this outbound connection and no phone needs a direct laptop URL.
if (relayConfig.relayUrl) {
  const relay = new RelayClient({ relayUrl: relayConfig.relayUrl, machineId: relayConfig.machineId, devices, pairingKey: (code) => devices.pairingKey(code) });
  const relayClients = new Map();
  relay.on("online", () => console.log(`Vertex relay connected for machine ${relayConfig.machineId}`));
  relay.on("offline", () => console.log("Vertex relay disconnected; retrying…"));
  relay.on("message", ({ message, keyId, pairCode }) => {
    if (keyId === "pair") {
      if (message.type !== "pair" || message.code !== pairCode) return;
      try {
        const device = devices.pair(pairCode, message.name);
        relay.send({ keyId: "pair", pairCode, message: { type: "paired", device: { id: device.id, name: device.name }, key: device.relayKey } });
      } catch { /* A failed pairing is intentionally indistinguishable to the relay. */ }
      return;
    }
    let client = relayClients.get(keyId);
    if (!client) {
      const { EventEmitter } = require("node:events");
      client = new EventEmitter();
      client.readyState = 1; client.OPEN = 1;
      client.send = (serialized) => relay.send({ keyId, message: JSON.parse(serialized) });
      client.kill = () => client.emit("close");
      relayClients.set(keyId, client);
      attachClient(client);
    }
    client.emit("message", JSON.stringify(message));
  });
  relay.start();
}

server.listen(PORT, HOST, () => {
  console.log(`Vertex agent listening on http://${HOST}:${PORT}`);
  void projects.refresh().then((found) => console.log(`Vertex indexed ${found.length} Git projects from this laptop.`)).catch((error) => console.error(`Vertex could not index projects: ${error.message}`));
  const pairCode = devices.createChallenge();
  let publicUrl = process.env.VERTEX_PAIR_URL;
  if (relayConfig.relayUrl) {
    const relayPair = Buffer.from(JSON.stringify({ v: 1, relay: relayConfig.relayUrl, machine: relayConfig.machineId, code: pairCode, key: devices.pairingKey(pairCode) })).toString("base64url");
    const appUrl = process.env.VERTEX_APP_URL || "https://app.vertex.example";
    const pairUrl = `${appUrl.replace(/\/$/, "")}/?relayPair=${relayPair}`;
    writePairingUrl(pairUrl);
    console.log(`Vertex relay pairing QR (valid for 10 minutes): ${pairUrl}`);
    try { require("node:child_process").execFileSync("qrencode", ["-t", "ANSIUTF8", pairUrl], { stdio: "inherit" }); } catch { console.log("Install qrencode to display that URL as a terminal QR code."); }
    console.log("Vertex relay mode: the laptop makes an outbound encrypted connection; no Tailscale is used.");
    return;
  }
  if (!publicUrl) {
    try { publicUrl = `http://${require("node:child_process").execFileSync("tailscale", ["ip", "-4"], { encoding: "utf8" }).trim()}:${PORT}`; } catch { publicUrl = `http://<laptop-tailscale-ip>:${PORT}`; }
  }
  if (publicUrl.includes("<laptop-tailscale-ip>")) {
    const address = localAddress();
    if (address) publicUrl = `http://${address}:${PORT}`;
  }
  const pairUrl = `${publicUrl.replace(/\/$/, "")}/?pair=${pairCode}`;
  writePairingUrl(pairUrl);
  console.log(`Pairing QR URL (valid for 10 minutes): ${pairUrl}`);
  console.log(`Bootstrap token (development fallback): ${token}`);
  try { require("node:child_process").execFileSync("qrencode", ["-t", "ANSIUTF8", pairUrl], { stdio: "inherit" }); } catch { console.log("Install qrencode to display that URL as a terminal QR code."); }
  console.log("Development-only direct mode. Set VERTEX_RELAY_URL to use the Vertex relay transport.");
});
