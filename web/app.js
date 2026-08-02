const screens = ["setup", "sessions", "create", "task", "diff", "terminal-screen"];
const $ = (id) => document.getElementById(id);
const state = { token: localStorage.getItem("vertex.token"), relayConfig: JSON.parse(localStorage.getItem("vertex.relay") || "null"), relayClient: null, relayPending: new Map(), socket: null, terminal: null, fit: null, task: null, taskStates: new Map(), taskSnapshotLoaded: false, activeTerminal: null, output: { expected: 1, pending: new Map(), scheduled: false }, reconnectTimer: null, resizeTimer: null };
const specialKeys = { "ctrl-c":"\u0003", esc:"\u001b", tab:"\t", up:"\u001b[A", down:"\u001b[B", left:"\u001b[D", right:"\u001b[C" };
let availableProjects = [];

function show(id) { screens.forEach((screen) => $(screen).classList.toggle("hidden", screen !== id)); }
function endpoint() { return location.origin; }
function api(path) { return fetch(`${endpoint()}${path}`, { headers: { Authorization: `Bearer ${state.token}` } }); }
function relayRequest(type, payload = {}) {
  const requestId = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => { state.relayPending.delete(requestId); reject(new Error("Laptop is unavailable")); }, 10_000);
    state.relayPending.set(requestId, { resolve, reject, timeout }); state.relayClient.send({ type, requestId, ...payload });
  });
}
function receiveRelayMessage(event) {
  if (event.requestId && state.relayPending.has(event.requestId)) {
    const pending = state.relayPending.get(event.requestId); state.relayPending.delete(event.requestId); clearTimeout(pending.timeout); pending.resolve(event);
  }
  handleTerminalEvent(event);
}
function startRelay(config = state.relayConfig) {
  if (!config || state.relayClient) return;
  state.relayClient = new VertexRelayClient(config);
  state.relayClient.onmessage = receiveRelayMessage;
  state.relayClient.onstatus = (status) => { if (!$("sessions").classList.contains("hidden")) $("connection").textContent = status === "online" ? "Laptop online" : "Reconnecting to laptop…"; };
  state.relayClient.connect();
}
async function loadSessions() {
  $("connection").textContent = "Connecting…";
  try {
    const body = state.relayClient ? await relayRequest("list") : await api("/sessions").then(async (response) => { if (!response.ok) throw new Error(response.status === 401 ? "Pairing token is invalid" : "Laptop unavailable"); return response.json(); });
    const { sessions } = body;
    $("connection").textContent = "Laptop online";
    $("session-list").replaceChildren(...sessions.map((session) => {
      const button = document.createElement("button"); button.className = "session";
      button.append(document.createTextNode(session.name));
      const subtitle = document.createElement("small"); subtitle.textContent = session.attached ? "Active" : "Ready"; button.append(subtitle);
      button.onclick = () => openTerminal(session.name); return button;
    }));
    loadTasks(); loadProjects();
  } catch (error) { $("connection").textContent = error.message; }
}

function projectOptions(select) {
  select.replaceChildren(new Option(availableProjects.length ? "Choose a project" : "No projects found — refresh projects", ""));
  availableProjects.forEach((project) => select.add(new Option(`${project.name} · ${project.branch}`, project.path)));
}
async function loadProjects(refresh = false) {
  try {
    const body = state.relayClient ? await relayRequest(refresh ? "refreshProjects" : "listProjects") : await (refresh ? fetch(`${endpoint()}/projects/refresh`, { method:"POST", headers:{ Authorization:`Bearer ${state.token}` } }) : api("/projects")).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; });
    if (!refresh && body.projects.length === 0) return loadProjects(true);
    availableProjects = body.projects; projectOptions($("cwd")); projectOptions($("task-cwd"));
  } catch { availableProjects = []; }
}

async function loadTasks() {
  try {
    const body = state.relayClient ? await relayRequest("listTasks") : await api("/tasks").then(async (response) => { if (!response.ok) throw new Error("Tasks unavailable"); return response.json(); });
    const { tasks } = body;
    if (state.taskSnapshotLoaded && Notification.permission === "granted") tasks.forEach((task) => {
      const previous = state.taskStates.get(task.id);
      if (previous && previous !== task.status && task.status !== "running") new Notification(`Vertex: ${task.name}`, { body: `Task ${task.status}. Tap to review changes.` });
    });
    state.taskStates = new Map(tasks.map((task) => [task.id, task.status])); state.taskSnapshotLoaded = true;
    $("task-list").replaceChildren(...tasks.map((task) => {
      const button = document.createElement("button"); button.className = "session";
      button.append(document.createTextNode(task.name));
      const subtitle = document.createElement("small"); subtitle.textContent = `${task.projectName || task.cwd} · ${task.branch || ""} · ${task.cli} · ${task.status}`; button.append(subtitle);
      button.onclick = () => openDiff(task); return button;
    }));
  } catch { $("task-list").replaceChildren(); }
}

async function openDiff(task) {
  state.task = task; show("diff"); $("diff-title").textContent = task.name; $("diff-stat").textContent = "Loading changes…"; $("diff-output").textContent = ""; $("review-status").textContent = task.review ? `Review: ${task.review.decision.replace("_", " ")}` : "";
  try {
    const body = state.relayClient ? await relayRequest("taskDiff", { id: task.id }) : await api(`/tasks/${task.id}/diff`).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; });
    $("diff-stat").textContent = body.stat || "No tracked changes yet."; $("diff-output").textContent = body.diff || "No tracked changes yet.";
  } catch (error) { $("diff-stat").textContent = error.message; }
}

async function review(decision) {
  if (!state.task) return;
  try {
    const body = state.relayClient ? await relayRequest("reviewTask", { id: state.task.id, decision }) : await fetch(`${endpoint()}/tasks/${state.task.id}/review`, { method:"POST", headers:{ Authorization:`Bearer ${state.token}`, "content-type":"application/json" }, body:JSON.stringify({ decision }) }).then(async (response) => { const value = await response.json(); if (!response.ok) throw new Error(value.error); return value; });
    $("review-status").textContent = `Review marked: ${body.task.review.decision.replace("_", " ")}`;
  } catch (error) { $("review-status").textContent = error.message; }
}

function socketUrl() { return `${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?token=${encodeURIComponent(state.token)}`; }
function send(message) { if (state.relayClient) return state.relayClient.send(message); if (state.socket?.readyState === WebSocket.OPEN) state.socket.send(JSON.stringify(message)); }
function resetOutput(sequence = 0) { state.output = { expected: sequence + 1, pending: new Map(), scheduled: false }; }
function flushOutput() {
  state.output.scheduled = false;
  let chunk = "";
  while (state.output.pending.has(state.output.expected)) {
    chunk += state.output.pending.get(state.output.expected);
    state.output.pending.delete(state.output.expected);
    state.output.expected += 1;
  }
  if (chunk) state.terminal.write(chunk);
}
function queueOutput(sequence, data) {
  if (sequence < state.output.expected || state.output.pending.has(sequence)) return;
  state.output.pending.set(sequence, data);
  if (!state.output.scheduled) { state.output.scheduled = true; requestAnimationFrame(flushOutput); }
}
function resizeTerminal() {
  clearTimeout(state.resizeTimer);
  state.resizeTimer = setTimeout(() => {
    if (!state.fit || !state.terminal) return;
    state.fit.fit();
    send({ type:"resize", cols:state.terminal.cols, rows:state.terminal.rows });
  }, 150);
}
function ensureTerminal() {
  if (state.terminal) return;
  state.terminal = new Terminal({ cursorBlink:true, fontSize:14, theme:{ background:"#111318", foreground:"#f4f6fb" }, scrollback:10000 });
  state.fit = new FitAddon.FitAddon(); state.terminal.loadAddon(state.fit);
  state.terminal.open($("terminal")); state.terminal.onData((data) => send({ type:"input", data }));
  new ResizeObserver(resizeTerminal).observe($("terminal")); window.addEventListener("orientationchange", resizeTerminal);
  resizeTerminal();
}
function handleTerminalEvent(event) {
  if ((event.type === "created" || event.type === "taskCreated") && state.activeTerminal) { state.activeTerminal.initialMessage = null; return send({ type:"attach", name:state.activeTerminal.name }); }
  if (!state.activeTerminal) return;
  if (event.type === "terminalSnapshot") { state.terminal.reset(); state.terminal.write(event.data); resetOutput(event.sequence); resizeTerminal(); return; }
  if (event.type === "output") return queueOutput(event.sequence, event.data);
  if (event.type === "attached") return resizeTerminal();
  if (event.type === "error") { $("terminal-status").textContent = event.message; state.terminal.writeln(`\r\n\x1b[31m${event.message}\x1b[0m`); }
  if (event.type === "closed") $("terminal-status").textContent = "Disconnected";
}
function connectTerminal() {
  const active = state.activeTerminal; if (!active) return;
  if (state.relayClient) { $("terminal-status").textContent = "Connected"; return active.initialMessage ? send(active.initialMessage) : send({ type:"attach", name:active.name }); }
  const socket = new WebSocket(socketUrl()); state.socket = socket;
  socket.onopen = () => { $("terminal-status").textContent = "Connected"; };
  socket.onmessage = ({ data }) => {
    const event = JSON.parse(data);
    if (event.type === "ready") return active.initialMessage ? send(active.initialMessage) : send({ type:"attach", name:active.name });
    if (event.type === "created" || event.type === "taskCreated") return handleTerminalEvent(event);
    handleTerminalEvent(event);
  };
  socket.onclose = () => {
    if (state.socket !== socket || $("terminal-screen").classList.contains("hidden") || !state.activeTerminal) return;
    $("terminal-status").textContent = "Reconnecting…";
    clearTimeout(state.reconnectTimer); state.reconnectTimer = setTimeout(connectTerminal, 1000);
  };
}
function openTerminal(name, initialMessage) {
  clearTimeout(state.reconnectTimer); state.socket?.close(); show("terminal-screen"); $("active-name").textContent = name; $("terminal-status").textContent = "Connecting…";
  ensureTerminal(); state.terminal.focus(); state.activeTerminal = { name, initialMessage };
  connectTerminal();
}

function saveToken(value) { state.token = value; localStorage.setItem("vertex.token", value); show("sessions"); loadSessions(); }
function saveRelay(config) { state.relayConfig = config; localStorage.setItem("vertex.relay", JSON.stringify(config)); startRelay(config); show("sessions"); loadSessions(); }
async function pairFromUrl() {
  const code = new URLSearchParams(location.search).get("pair");
  if (!code) return false;
  try {
    const response = await fetch(`${endpoint()}/pair`, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code, name:`Android Chrome (${navigator.platform})` }) });
    if (!response.ok) throw new Error((await response.json()).error);
    const { token } = await response.json();
    history.replaceState({}, "", location.pathname); saveToken(token); return true;
  } catch (error) { $("token").placeholder = error.message; return false; }
}
async function pairRelayFromUrl() {
  const encoded = new URLSearchParams(location.search).get("relayPair"); if (!encoded) return false;
  try {
    const pairing = JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(encoded.replace(/-/g,"+").replace(/_/g,"/")), (char) => char.charCodeAt(0))));
    if (pairing.v !== 1 || !pairing.relay || !pairing.machine || !pairing.code || !pairing.key) throw new Error("Invalid Vertex pairing QR.");
    const client = new VertexRelayClient({ relay:pairing.relay, machine:pairing.machine, keyId:"pair", pairCode:pairing.code, key:pairing.key });
    const paired = await new Promise((resolve, reject) => { const timeout = setTimeout(() => reject(new Error("Laptop did not accept pairing. Keep Vertex running and scan a new QR.")), 12_000); client.onmessage = (message) => { if (message.type === "paired") { clearTimeout(timeout); resolve(message); } }; client.connect(); client.send({ type:"pair", code:pairing.code, name:`Android (${navigator.platform})` }); });
    client.close(); history.replaceState({}, "", location.pathname); saveRelay({ relay:pairing.relay, machine:pairing.machine, keyId:paired.device.id, key:paired.key }); return true;
  } catch (error) { $("token").placeholder = error.message; return false; }
}
$("connect").onclick = () => saveToken($("token").value.trim());
$("forget").onclick = () => { localStorage.removeItem("vertex.token"); localStorage.removeItem("vertex.relay"); state.token = null; state.relayClient?.close(); state.relayClient = null; state.relayConfig = null; show("setup"); };
$("new-session").onclick = () => { $("create-error").textContent = ""; show("create"); };
$("refresh-projects").onclick = async () => { $("refresh-projects").textContent = "Scanning laptop…"; await loadProjects(true); $("refresh-projects").textContent = `${availableProjects.length} projects found`; };
$("create-session").onclick = () => { const name = $("session-name").value.trim(), cwd = $("cwd").value.trim(); if (!name || !cwd) return $("create-error").textContent = "Enter a session name and project folder."; openTerminal(name, { type:"create", name, cwd }); };
$("new-task").onclick = () => { $("task-error").textContent = ""; show("task"); };
$("enable-notifications").onclick = async () => { const permission = await Notification.requestPermission(); $("enable-notifications").textContent = permission === "granted" ? "Task notifications enabled" : "Notifications blocked"; };
$("cli").onchange = () => { const generic = $("cli").value === "command"; $("command-label").classList.toggle("hidden", !generic); $("prompt-label").classList.toggle("hidden", generic); };
$("create-task").onclick = () => {
  const name = $("task-name").value.trim(), cwd = $("task-cwd").value.trim(), cli = $("cli").value;
  const prompt = $("prompt").value.trim(), command = $("command").value.trim();
  if (!name || !cwd || (cli === "command" ? !command : !prompt)) return $("task-error").textContent = "Enter a name, project folder, and task.";
  openTerminal(name, { type:"createTask", name, cwd, cli, prompt, command });
};
$("open-task-terminal").onclick = () => state.task && openTerminal(state.task.name);
$("approve-review").onclick = () => review("approved");
$("changes-review").onclick = () => review("needs_changes");
document.querySelectorAll(".back").forEach((button) => button.onclick = () => { state.socket?.close(); show(button.dataset.back); loadSessions(); });
document.querySelectorAll("[data-key]").forEach((button) => button.onclick = () => send({ type:"input", data:specialKeys[button.dataset.key] }));
if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js");
if (state.relayConfig) { startRelay(); show("sessions"); loadSessions(); }
else if (!state.token) pairRelayFromUrl().then((paired) => { if (!paired) pairFromUrl().then((direct) => { if (!direct) show("setup"); }); });
else { show("sessions"); loadSessions(); }
setInterval(() => { if (state.token && !$("sessions").classList.contains("hidden")) loadTasks(); }, 10_000);
