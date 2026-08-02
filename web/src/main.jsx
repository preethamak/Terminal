import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { VertexRelayClient } from "../relay-client.js";
import jsQR from "jsqr";
import "./styles.css";
import "./accessibility.css";

const stored = (key) => { try { return JSON.parse(localStorage.getItem(key) || "null"); } catch { return null; } };
const initials = (value = "Vertex") => value.split(/\s+/).map((part) => part[0]).join("").slice(0, 2).toUpperCase();
const formatTime = (time) => new Intl.DateTimeFormat(undefined, { hour:"numeric", minute:"2-digit" }).format(time || Date.now());

function useVertex() {
  const [token, setToken] = useState(() => localStorage.getItem("vertex.token"));
  const [relay, setRelay] = useState(() => stored("vertex.relay"));
  const [status, setStatus] = useState("Connecting to your laptop…");
  const [data, setData] = useState({ tasks:[], sessions:[], projects:[] });
  const relayClient = useRef(null); const pending = useRef(new Map()); const terminalListener = useRef(() => {});

  const direct = useCallback(async (path, options = {}) => {
    const response = await fetch(path, { ...options, headers:{ Authorization:`Bearer ${token}`, ...(options.headers || {}) } });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || "Laptop is unavailable"); return body;
  }, [token]);
  const remote = useCallback((type, values = {}) => new Promise((resolve, reject) => {
    const requestId = crypto.randomUUID(); const timeout = setTimeout(() => { pending.current.delete(requestId); reject(new Error("Laptop is unavailable")); }, 10_000);
    pending.current.set(requestId, { resolve, reject, timeout }); relayClient.current?.send({ type, requestId, ...values });
  }), []);
  const request = useCallback((type, values = {}) => {
    if (relay) return remote(type, values);
    const routes = {
      list: () => direct("/sessions"), listTasks: () => direct("/tasks"), listProjects: () => direct("/projects"),
      refreshProjects: () => direct("/projects/refresh", { method:"POST" }), taskDiff: () => direct(`/tasks/${values.id}/diff`),
      reviewTask: () => direct(`/tasks/${values.id}/review`, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ decision:values.decision }) }),
    };
    return routes[type]();
  }, [direct, relay, remote]);
  const refresh = useCallback(async () => {
    try {
      const [sessions, tasks, initialProjects] = await Promise.all([request("list"), request("listTasks"), request("listProjects")]);
      const projects = initialProjects.projects?.length ? initialProjects : await request("refreshProjects");
      setData({ sessions:sessions.sessions || [], tasks:tasks.tasks || [], projects:projects.projects || [] }); setStatus("Laptop online");
    } catch (error) { setStatus(error.message); }
  }, [request]);
  useEffect(() => {
    if (!relay) return;
    const client = new VertexRelayClient(relay); relayClient.current = client;
    client.onstatus = (next) => setStatus(next === "online" ? "Laptop online" : "Reconnecting securely…");
    client.onmessage = (event) => {
      const match = event.requestId && pending.current.get(event.requestId);
      if (match) { clearTimeout(match.timeout); pending.current.delete(event.requestId); match.resolve(event); }
      terminalListener.current(event);
    };
    client.connect(); return () => client.close();
  }, [relay]);
  useEffect(() => { if (token || relay) refresh(); }, [token, relay, refresh]);
  useEffect(() => { const timer = setInterval(() => { if (token || relay) refresh(); }, 12000); return () => clearInterval(timer); }, [token, relay, refresh]);
  const send = useCallback((message, directSocket) => { if (relay) relayClient.current?.send(message); else if (directSocket?.readyState === WebSocket.OPEN) directSocket.send(JSON.stringify(message)); }, [relay]);
  const forget = useCallback(() => { localStorage.removeItem("vertex.token"); localStorage.removeItem("vertex.relay"); setToken(null); setRelay(null); setData({ tasks:[], sessions:[], projects:[] }); }, []);
  const saveToken = useCallback((value) => { localStorage.setItem("vertex.token", value); setToken(value); }, []);
  const saveRelay = useCallback((value) => { localStorage.setItem("vertex.relay", JSON.stringify(value)); setRelay(value); }, []);
  return useMemo(() => ({ token, relay, status, data, setStatus, direct, request, refresh, send, terminalListener, setToken:saveToken, setRelay:saveRelay, forget }), [token, relay, status, data, direct, request, refresh, send, saveToken, saveRelay, forget]);
}

function App() {
  const vertex = useVertex(); const [screen, setScreen] = useState("home"); const [selected, setSelected] = useState(null); const [sheet, setSheet] = useState(null);
  useEffect(() => { if (!vertex.token && !vertex.relay) setScreen("welcome"); }, [vertex.token, vertex.relay]);
  useEffect(() => { if (vertex.token || vertex.relay) return; const params = new URLSearchParams(location.search); const pair = params.get("pair"); const relayPair = params.get("relayPair"); if (!pair && !relayPair) return;
    if (relayPair) {
      try {
        const raw = atob(relayPair.replace(/-/g,"+").replace(/_/g,"/")); const pairing = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, (char) => char.charCodeAt(0))));
        if (pairing.v !== 1 || !pairing.relay || !pairing.machine || !pairing.code || !pairing.key) throw new Error("Invalid pairing QR");
        const client = new VertexRelayClient({ relay:pairing.relay, machine:pairing.machine, keyId:"pair", pairCode:pairing.code, key:pairing.key });
        const timeout = setTimeout(() => client.close(), 12_000);
        client.onmessage = (message) => { if (message.type !== "paired") return; clearTimeout(timeout); client.close(); history.replaceState({}, "", location.pathname); vertex.setRelay({ relay:pairing.relay, machine:pairing.machine, keyId:message.device.id, key:message.key }); setScreen("home"); };
        client.connect(); client.send({ type:"pair", code:pairing.code, name:`Android (${navigator.platform})` });
      } catch { setScreen("welcome"); }
      return;
    }
    fetch("/pair", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code:pair, name:`Android (${navigator.platform})` }) }).then((response) => response.json()).then((body) => { if (!body.token) throw new Error(body.error); history.replaceState({}, "", location.pathname); vertex.setToken(body.token); setScreen("home"); }).catch(() => setScreen("welcome"));
  }, [vertex.token, vertex.relay]);
  if (screen === "welcome") return <Welcome onConnect={(value) => { vertex.setToken(value); setScreen("home"); }} />;
  if (screen === "terminal") return <TerminalView vertex={vertex} session={selected} onClose={() => { setScreen("home"); vertex.refresh(); }} />;
  return <main className="shell">
    <Topbar status={vertex.status} onProfile={() => setSheet("profile")} />
    <section className="content">
      <Hero tasks={vertex.data.tasks} onStart={() => setSheet("task")} />
      <section className="section-head"><div><p className="kicker">CONTINUE WORKING</p><h2>Active tasks</h2></div><button className="link" onClick={vertex.refresh}>Refresh</button></section>
      <TaskRail tasks={vertex.data.tasks} onOpen={(task) => { setSelected(task); setSheet("taskDetail"); }} onTerminal={(task) => { setSelected(task); setScreen("terminal"); }} />
      <section className="section-head"><div><p className="kicker">YOUR LAPTOP</p><h2>Workspaces</h2></div><button className="link" onClick={() => setSheet("projects")}>View all</button></section>
      <ProjectGrid projects={vertex.data.projects} onOpen={(project) => setSheet({ type:"session", project })} />
      <section className="section-head compact"><div><p className="kicker">PERSISTENT TERMINALS</p><h2>Sessions</h2></div></section>
      <SessionList sessions={vertex.data.sessions} onOpen={(session) => { setSelected(session); setScreen("terminal"); }} />
    </section>
    <nav className="bottom-nav"><button className="nav-active">⌂<span>Home</span></button><button onClick={() => setSheet("projects")}>◈<span>Projects</span></button><button className="add" onClick={() => setSheet("task")}>+</button><button onClick={() => setSheet("activity")}>◌<span>Activity</span></button><button onClick={() => setSheet("profile")}>◉<span>Account</span></button></nav>
    {sheet && <Sheet kind={sheet} vertex={vertex} selected={selected} close={() => setSheet(null)} openTerminal={(item) => { setSelected(item); setSheet(null); setScreen("terminal"); }} />}
  </main>;
}

function Welcome({ onConnect }) { const [token, setToken] = useState(""); const [scanner, setScanner] = useState(false); return <main className="welcome"><div className="orb orb-one"/><div className="orb orb-two"/><div className="welcome-card"><Brand/><div className="welcome-copy"><p className="kicker">DEVELOPMENT, UNBOUND</p><h1>Your terminal,<br/><em>wherever you are.</em></h1><p>Start work on your laptop. Continue it naturally from Vertex—without moving your code to the cloud.</p></div><div className="pair-card"><span className="pair-icon">⌘</span><div><strong>Pair your laptop</strong><small>Scan the QR shown by your laptop.</small></div></div><button className="scan-button" onClick={() => setScanner(true)}>Scan Vertex QR <span>⌗</span></button><label className="token-label">Development token<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste only for local testing" type="password" /></label><button className="primary-button" onClick={() => token && onConnect(token)}>Connect Vertex <span>→</span></button><p className="welcome-foot">Your code stays on your laptop. Always.</p></div>{scanner && <QrScanner close={() => setScanner(false)}/>}</main>; }
function QrScanner({ close }) { const video = useRef(null); const picker = useRef(null); const [message, setMessage] = useState("Opening camera…"); const pair = (value) => { if (value?.includes("relayPair=")) window.location.assign(value); else setMessage("That image is not a Vertex pairing QR. Try again with the QR shown by your laptop."); }; const decodePhoto = (file) => { if (!file) return; const image = new Image(); const url = URL.createObjectURL(file); image.onload = () => { const canvas = document.createElement("canvas"); canvas.width = image.naturalWidth; canvas.height = image.naturalHeight; const context = canvas.getContext("2d", { willReadFrequently:true }); context.drawImage(image, 0, 0); const result = jsQR(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height, { inversionAttempts:"attemptBoth" }); URL.revokeObjectURL(url); pair(result?.data); }; image.onerror = () => { URL.revokeObjectURL(url); setMessage("Vertex could not read that photo. Take a sharper photo of the QR."); }; image.src = url; }; useEffect(() => { let stream; let frame; let stopped = false; const start = async () => { if (!("BarcodeDetector" in window)) return setMessage("Live camera scanning is unavailable here. Use “Take QR photo” below instead."); try { stream = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" } }, audio:false }); if (stopped) return; video.current.srcObject = stream; await video.current.play(); const detector = new BarcodeDetector({ formats:["qr_code"] }); setMessage("Point the camera at the QR on your laptop."); const scan = async () => { if (stopped) return; try { const codes = await detector.detect(video.current); if (codes[0]?.rawValue) return pair(codes[0].rawValue); } catch { /* A frame can be unavailable while the camera starts. */ } frame = requestAnimationFrame(scan); }; scan(); } catch { setMessage("Live camera permission was blocked. Use “Take QR photo” below instead."); } }; start(); return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach((track) => track.stop()); }; }, []); return <div className="scanner-backdrop"><section className="scanner-card"><button className="sheet-close" onClick={close}>×</button><p className="kicker">PAIR VERTEX</p><h2>Scan the laptop QR</h2><video ref={video} className="scanner-video" muted playsInline/><p>{message}</p><input ref={picker} className="qr-photo-input" type="file" accept="image/*" capture="environment" onChange={(event) => decodePhoto(event.target.files?.[0])}/><button className="scan-photo-button" onClick={() => picker.current?.click()}>Take QR photo <span>⌑</span></button></section></div>; }
function Brand() { return <div className="brand"><span className="brand-mark">V</span><span>vertex</span></div>; }
function Topbar({ status, onProfile }) { return <header className="topbar"><Brand/><button className="connection-pill" onClick={onProfile}><i></i>{status}<span>⌄</span></button></header>; }
function Hero({ tasks, onStart }) { const active = tasks.find((task) => task.status === "running"); return <section className="hero"><div className="hero-glow"/><div className="hero-copy"><p className="kicker">{active ? "RUNNING ON YOUR LAPTOP" : "READY WHEN YOU ARE"}</p><h1>{active ? active.name : "Pick up where you left off."}</h1><p>{active ? `${active.projectName || "Workspace"} · ${active.cli || "terminal"} is still working.` : "Start an AI task and Vertex will keep it within reach."}</p><button className="hero-action" onClick={onStart}>{active ? "Open task" : "Start a task"}<span>→</span></button></div><div className="hero-visual"><div className="terminal-mini"><div><b></b><b></b><b></b></div><code><i>$</i> {active ? "codex working…" : "vertex connect"}<br/><span>{active ? "✓ reading repository" : "your laptop is ready"}</span></code></div></div></section>; }
function TaskRail({ tasks, onOpen, onTerminal }) { if (!tasks.length) return <button className="empty-card" onClick={() => onOpen({})}><span>✦</span><div><strong>Your next task starts here</strong><small>Launch Codex, Claude Code, or any terminal command.</small></div><b>+</b></button>; return <div className="task-rail">{tasks.slice(0, 6).map((task) => <article className="task-card" key={task.id} onClick={() => onOpen(task)}><div className="task-top"><span className={`status-dot ${task.status}`}></span><span>{task.cli === "claude" ? "Claude" : task.cli === "codex" ? "Codex" : "Terminal"}</span><button aria-label="Open terminal" onClick={(event) => { event.stopPropagation(); onTerminal(task); }}>↗</button></div><h3>{task.name}</h3><p>{task.projectName || "Local workspace"}</p><div className="task-bottom"><span>{task.status === "running" ? "In progress" : task.status}</span><time>{formatTime(task.createdAt)}</time></div></article>)}</div>; }
function ProjectGrid({ projects, onOpen }) { if (!projects.length) return <div className="project-empty">Your projects will appear here after Vertex connects to your laptop.</div>; return <div className="project-grid">{projects.slice(0, 4).map((project, index) => <button className={`project-card c${index % 4}`} key={project.path} onClick={() => onOpen(project)}><span className="project-icon">{initials(project.name)}</span><strong>{project.name}</strong><small>{project.branch || "main"}</small><i>→</i></button>)}</div>; }
function SessionList({ sessions, onOpen }) { if (!sessions.length) return <p className="muted-copy">No open terminal sessions yet.</p>; return <div className="sessions">{sessions.map((session) => <button key={session.name} onClick={() => onOpen(session)}><span className="session-terminal">›_</span><span><strong>{session.name}</strong><small>{session.attached ? "Active now" : "Ready to resume"}</small></span><b>→</b></button>)}</div>; }

function Sheet({ kind, vertex, selected, close, openTerminal }) { const content = typeof kind === "string" ? { type:kind } : kind; const [task, setTask] = useState({ cli:"codex", name:"", cwd:content.project?.path || "", prompt:"" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const createTask = async () => { if (!task.name || !task.cwd || !task.prompt) return setError("Give this task a name, project, and instruction."); setBusy(true); try { const message = { type:"createTask", ...task, command:task.cli === "command" ? task.prompt : "" }; if (vertex.relay) { await vertex.request("createTask", message); } else { const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?token=${encodeURIComponent(vertex.token)}`); socket.onopen = () => socket.send(JSON.stringify(message)); await new Promise((resolve, reject) => { socket.onmessage = ({ data }) => { const event = JSON.parse(data); if (event.type === "taskCreated") { socket.close(); resolve(event); } }; socket.onerror = reject; }); } close(); vertex.refresh(); } catch (caught) { setError(caught.message); } finally { setBusy(false); } };
  const project = content.project; const taskDetail = content.type === "taskDetail";
  return <div className="sheet-backdrop" onMouseDown={close}><section className="sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={close}>×</button>{content.type === "profile" ? <><p className="kicker">VERTEX DEVICE</p><h2>Your private workspace</h2><div className="profile-row"><span className="avatar">A</span><div><strong>Paired laptop</strong><small>{vertex.status}</small></div><i className="status-dot running"/></div><button className="danger-button" onClick={() => { vertex.forget(); close(); }}>Forget this laptop</button></> : taskDetail ? <TaskDetail task={selected} vertex={vertex} openTerminal={openTerminal} close={close}/> : content.type === "projects" ? <><p className="kicker">WORKSPACES</p><h2>Choose a project</h2><ProjectGrid projects={vertex.data.projects} onOpen={(item) => { setTask((current) => ({ ...current, cwd:item.path })); }} /></> : content.type === "activity" ? <><p className="kicker">ACTIVITY</p><h2>Everything is here</h2><p className="muted-copy">Vertex keeps sessions running on your laptop while you are away.</p></> : <><p className="kicker">{project ? project.name.toUpperCase() : "NEW AI TASK"}</p><h2>Tell your laptop what to do.</h2><div className="agent-pills">{["codex","claude","command"].map((item) => <button className={task.cli === item ? "selected" : ""} key={item} onClick={() => setTask({ ...task, cli:item })}>{item === "claude" ? "Claude" : item === "codex" ? "Codex" : "Command"}</button>)}</div><label>Task name<input value={task.name} onChange={(event) => setTask({ ...task, name:event.target.value })} placeholder="Fix the login flow"/></label><label>Project<select value={task.cwd} onChange={(event) => setTask({ ...task, cwd:event.target.value })}><option value="">Choose a workspace</option>{vertex.data.projects.map((item) => <option key={item.path} value={item.path}>{item.name} · {item.branch}</option>)}</select></label><label>{task.cli === "command" ? "Command" : "What should it do?"}<textarea value={task.prompt} onChange={(event) => setTask({ ...task, prompt:event.target.value })} placeholder={task.cli === "command" ? "npm test" : "Fix the issue, explain the change, and run the tests."}/></label>{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy} onClick={createTask}>{busy ? "Starting…" : "Start on laptop"}<span>→</span></button></>}</section></div>; }
function TaskDetail({ task, vertex, openTerminal, close }) { const [diff, setDiff] = useState(null); useEffect(() => { if (task?.id) vertex.request("taskDiff", { id:task.id }).then(setDiff).catch(() => setDiff({ stat:"Changes will appear here when available." })); }, [task?.id, vertex.request]); if (!task) return null; return <><p className="kicker">{task.status === "running" ? "WORKING NOW" : "TASK REVIEW"}</p><h2>{task.name}</h2><div className="detail-meta"><span className={`status-dot ${task.status}`}/>{task.projectName || "Workspace"}<b>·</b>{task.cli}</div><div className="diff-preview"><strong>{diff?.stat || "Checking changes…"}</strong><pre>{diff?.diff || "Vertex will show a safe, reviewable diff once the task changes files."}</pre></div><button className="primary-button" onClick={() => openTerminal(task)}>Open live terminal <span>→</span></button><button className="secondary-button" onClick={close}>Keep running in background</button></>; }

function TerminalView({ vertex, session, onClose }) { const element = useRef(null); const socket = useRef(null); const terminal = useRef(null); const fit = useRef(null); const output = useRef({ expected:1, pending:new Map(), scheduled:false }); const [status, setStatus] = useState("Connecting…");
  useEffect(() => { let disposed = false; let cleanup = () => {}; (async () => { const [{ Terminal }, { FitAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit"), import("@xterm/xterm/css/xterm.css")]); if (disposed) return; const term = new Terminal({ cursorBlink:true, fontSize:14, fontFamily:"'JetBrains Mono', ui-monospace, monospace", theme:{ background:"#090b11", foreground:"#eaf0ff", cursor:"#a7b6ff", selectionBackground:"#364267" }, scrollback:10000 }); const addon = new FitAddon(); term.loadAddon(addon); term.open(element.current); terminal.current = term; fit.current = addon;
    const send = (message) => vertex.send(message, socket.current); const resize = () => { addon.fit(); send({ type:"resize", cols:term.cols, rows:term.rows }); }; const flush = () => { output.current.scheduled = false; let text=""; while (output.current.pending.has(output.current.expected)) { text += output.current.pending.get(output.current.expected); output.current.pending.delete(output.current.expected++); } if (text) term.write(text); };
    const receive = (event) => { if (event.type === "terminalSnapshot") { term.reset(); term.write(event.data); output.current = { expected:event.sequence + 1, pending:new Map(), scheduled:false }; resize(); } if (event.type === "output" && event.sequence >= output.current.expected && !output.current.pending.has(event.sequence)) { output.current.pending.set(event.sequence,event.data); if (!output.current.scheduled) { output.current.scheduled = true; requestAnimationFrame(flush); } } if (event.type === "attached") setStatus("Live"); if (event.type === "error") setStatus(event.message); };
    vertex.terminalListener.current = receive; term.onData((data) => send({ type:"input", data })); const observer = new ResizeObserver(() => setTimeout(resize, 80)); observer.observe(element.current); if (vertex.relay) { send({ type:"attach", name:session.name }); setStatus("Live"); } else { const connectDirect = () => { if (disposed) return; const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?token=${encodeURIComponent(vertex.token)}`); socket.current = ws; ws.onopen = () => ws.send(JSON.stringify({ type:"attach", name:session.name })); ws.onmessage = ({ data }) => receive(JSON.parse(data)); ws.onclose = () => { if (!disposed) { setStatus("Reconnecting…"); setTimeout(connectDirect, 1000); } }; }; connectDirect(); }
    requestAnimationFrame(resize); cleanup = () => { vertex.terminalListener.current = () => {}; observer.disconnect(); socket.current?.close(); term.dispose(); };
  })().catch((error) => setStatus(error.message)); return () => { disposed = true; cleanup(); };
  }, [session.name, vertex.relay, vertex.token, vertex.send, vertex.terminalListener]);
  const keys = [["Ctrl+C","\u0003"],["Esc","\u001b"],["Tab","\t"],["↑","\u001b[A"],["↓","\u001b[B"],["←","\u001b[D"],["→","\u001b[C"]]; return <main className="terminal-page"><header><button onClick={onClose}>‹</button><div><span className="kicker">LIVE TERMINAL</span><strong>{session.name}</strong></div><span className="live-pill"><i/> {status}</span></header><div className="terminal-wrap" ref={element}/><nav className="terminal-keys">{keys.map(([label,data]) => <button key={label} onClick={() => vertex.send({ type:"input", data }, socket.current)}>{label}</button>)}</nav></main>; }

const root = globalThis.__vertexReactRoot || createRoot(document.getElementById("root"));
globalThis.__vertexReactRoot = root;
root.render(<App/>);
