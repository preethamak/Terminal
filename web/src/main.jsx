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
  const [data, setData] = useState({ tasks:[], sessions:[], projects:[], activities:[], health:null, settings:{ preventSleep:true }, docker:{ available:false, containers:[] } });
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
      createSession: () => direct("/sessions", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ name:values.name, cwd:values.cwd }) }),
      refreshProjects: () => direct("/projects/refresh", { method:"POST" }), taskDiff: () => direct(`/tasks/${values.id}/diff`),
      reviewTask: () => direct(`/tasks/${values.id}/review`, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ decision:values.decision }) }),
      listActivity: () => direct("/activity"), readActivity: () => direct("/activity/read", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ id:values.id || null }) }),
      testActivity: () => direct("/activity/test", { method:"POST" }),
      getHealth: () => direct("/device-health"), listDevices: () => direct("/devices"), revokeDevice: () => direct(`/devices/${encodeURIComponent(values.id)}/revoke`, { method:"POST" }),
      sessionAction: () => direct(`/sessions/${encodeURIComponent(values.name)}/action`, { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(values) }),
      listFiles: () => direct(`/files?project=${encodeURIComponent(values.projectPath)}&path=${encodeURIComponent(values.relativePath || "")}`), readFile: () => direct(`/files/preview?project=${encodeURIComponent(values.projectPath)}&path=${encodeURIComponent(values.relativePath || "")}`),
      gitStatus: () => direct(`/git?project=${encodeURIComponent(values.projectPath)}`),
      listDocker: () => direct("/docker"), dockerLogs: () => direct(`/docker/log?container=${encodeURIComponent(values.container)}`),
      getSettings: () => direct("/settings"), updateSettings: () => direct("/settings", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify(values) }),
    };
    return routes[type]();
  }, [direct, relay, remote]);
  const refresh = useCallback(async () => {
    try {
      const [sessions, tasks, initialProjects, activity, health, docker, settings] = await Promise.all([request("list"), request("listTasks"), request("listProjects"), request("listActivity"), request("getHealth"), request("listDocker"), request("getSettings")]);
      const projects = initialProjects.projects?.length ? initialProjects : await request("refreshProjects");
      setData({ sessions:sessions.sessions || [], tasks:tasks.tasks || [], projects:projects.projects || [], activities:activity.activities || [], health, settings, docker }); setStatus("Laptop online");
    } catch (error) { setStatus(error.message); }
  }, [request]);
  const discoverProjects = useCallback(async () => {
    try {
      const response = await request("refreshProjects");
      const projects = response.projects || [];
      setData((current) => ({ ...current, projects })); setStatus("Laptop online");
      return projects;
    } catch (error) { setStatus(error.message); throw error; }
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
  const forget = useCallback(() => { localStorage.removeItem("vertex.token"); localStorage.removeItem("vertex.relay"); setToken(null); setRelay(null); setData({ tasks:[], sessions:[], projects:[], activities:[], health:null, settings:{ preventSleep:true }, docker:{ available:false, containers:[] } }); }, []);
  const saveToken = useCallback((value) => { localStorage.setItem("vertex.token", value); setToken(value); }, []);
  const saveRelay = useCallback((value) => { localStorage.setItem("vertex.relay", JSON.stringify(value)); setRelay(value); }, []);
  return useMemo(() => ({ token, relay, status, data, setStatus, direct, request, refresh, discoverProjects, send, terminalListener, setToken:saveToken, setRelay:saveRelay, forget }), [token, relay, status, data, direct, request, refresh, discoverProjects, send, saveToken, saveRelay, forget]);
}

function App() {
  const vertex = useVertex(); const [screen, setScreen] = useState("home"); const [selected, setSelected] = useState(null); const [sheet, setSheet] = useState(null); const [pairingStatus, setPairingStatus] = useState("");
  useEffect(() => { if (!vertex.token && !vertex.relay) setScreen("welcome"); }, [vertex.token, vertex.relay]);
  useEffect(() => { if (vertex.token || vertex.relay) return; const params = new URLSearchParams(location.search); const pair = params.get("pair"); const relayPair = params.get("relayPair"); if (!pair && !relayPair) return;
    if (relayPair) {
      try {
        const raw = atob(relayPair.replace(/-/g,"+").replace(/_/g,"/")); const pairing = JSON.parse(new TextDecoder().decode(Uint8Array.from(raw, (char) => char.charCodeAt(0))));
        if (pairing.v !== 1 || !pairing.relay || !pairing.machine || !pairing.code || !pairing.key) throw new Error("Invalid pairing QR");
        const client = new VertexRelayClient({ relay:pairing.relay, machine:pairing.machine, keyId:"pair", pairCode:pairing.code, key:pairing.key });
        setPairingStatus("Connecting securely to your laptop…");
        const timeout = setTimeout(() => { client.close(); setPairingStatus("Pairing did not finish. This link may be expired, already used, or your laptop agent is offline. Run npm run pair on the laptop for a fresh link."); }, 12_000);
        client.onstatus = (status) => { if (status === "online") setPairingStatus("Laptop found. Completing secure pairing…"); };
        client.onmessage = (message) => { if (message.type !== "paired") return; clearTimeout(timeout); client.close(); history.replaceState({}, "", location.pathname); vertex.setRelay({ relay:pairing.relay, machine:pairing.machine, keyId:message.device.id, key:message.key }); setPairingStatus("Paired. Opening your laptop…"); setScreen("home"); };
        client.connect(); client.send({ type:"pair", code:pairing.code, name:`Android (${navigator.platform})` });
      } catch { setPairingStatus("That pairing link is invalid. Run npm run pair on the laptop and use the new link."); setScreen("welcome"); }
      return;
    }
    setPairingStatus("Pairing with your laptop…");
    fetch("/pair", { method:"POST", headers:{ "content-type":"application/json" }, body:JSON.stringify({ code:pair, name:`Android (${navigator.platform})` }) }).then((response) => response.json()).then((body) => { if (!body.token) throw new Error(body.error); history.replaceState({}, "", location.pathname); vertex.setToken(body.token); setPairingStatus("Paired. Opening your laptop…"); setScreen("home"); }).catch(() => setPairingStatus("Pairing did not finish. Generate a fresh QR on the laptop and try again."));
  }, [vertex.token, vertex.relay]);
  if (screen === "welcome") return <Welcome pairingStatus={pairingStatus} onConnect={(value) => { vertex.setToken(value); setScreen("home"); }} />;
  if (screen === "terminal") return <TerminalView vertex={vertex} session={selected} onClose={() => { setScreen("home"); vertex.refresh(); }} onSwitch={setSelected} />;
  return <main className="shell">
    <Topbar status={vertex.status} onProfile={() => setSheet("profile")} />
    <section className="content">
      <Hero tasks={vertex.data.tasks} onStart={() => setSheet("task")} onTerminal={() => setSheet({ type:"session", terminal:true })} />
      <AttentionInbox activities={vertex.data.activities} tasks={vertex.data.tasks} onOpen={(task) => { setSelected(task); setSheet("taskDetail"); }} onRead={() => vertex.request("readActivity").then(vertex.refresh)} />
      <section className="section-head"><div><p className="kicker">CONTINUE WORKING</p><h2>Active tasks</h2></div><button className="link" onClick={vertex.refresh}>Refresh</button></section>
      <TaskRail tasks={vertex.data.tasks} onOpen={(task) => { setSelected(task); setSheet("taskDetail"); }} onTerminal={(task) => { setSelected(task); setScreen("terminal"); }} />
      <section className="section-head"><div><p className="kicker">YOUR LAPTOP</p><h2>Workspaces</h2></div><button className="link" onClick={() => setSheet("projects")}>View all</button></section>
      <ProjectGrid projects={vertex.data.projects} onOpen={(project) => setSheet({ type:"session", project })} onDiscover={vertex.discoverProjects} />
      <section className="section-head compact"><div><p className="kicker">PERSISTENT TERMINALS</p><h2>Sessions</h2></div></section>
      <SessionList sessions={vertex.data.sessions} onOpen={(session) => { setSelected(session); setScreen("terminal"); }} onManage={(session) => { setSelected(session); setSheet("sessionDetail"); }} />
      <DockerSummary docker={vertex.data.docker} onOpen={() => setSheet("docker")} />
    </section>
    <nav className="bottom-nav"><button className="nav-active">⌂<span>Home</span></button><button onClick={() => setSheet("projects")}>◈<span>Projects</span></button><button className="add" onClick={() => setSheet("task")}>+</button><button onClick={() => setSheet("activity")}>◌<span>Activity</span></button><button onClick={() => setSheet("profile")}>◉<span>Account</span></button></nav>
    {sheet && <Sheet kind={sheet} vertex={vertex} selected={selected} close={() => setSheet(null)} openTerminal={(item) => { setSelected(item); setSheet(null); setScreen("terminal"); }} />}
  </main>;
}

function Welcome({ onConnect, pairingStatus }) { const [token, setToken] = useState(""); const [scanner, setScanner] = useState(false); const [copied, setCopied] = useState(false); const [pairLink, setPairLink] = useState(""); const [linkError, setLinkError] = useState(""); const copyCommand = async () => { try { await navigator.clipboard.writeText("cd ~/vertex && npm run pair"); setCopied(true); setTimeout(() => setCopied(false), 1800); } catch { setCopied(false); } }; const openPairLink = () => { try { const url = new URL(pairLink.trim()); if (!url.searchParams.get("relayPair")) throw new Error(); window.location.assign(url.href); } catch { setLinkError("Paste the full Vertex pairing link printed by npm run pair."); } }; return <main className="welcome"><div className="orb orb-one"/><div className="orb orb-two"/><div className="welcome-card"><Brand/><div className="welcome-copy"><p className="kicker">YOUR LAPTOP, IN YOUR POCKET</p><h1>Your terminal,<br/><em>wherever you are.</em></h1><p>Pair once, then open your laptop’s real terminal securely from this phone.</p></div>{pairingStatus && <p className="pairing-status">{pairingStatus}</p>}<div className="pair-card pair-guide"><span className="pair-icon">1</span><div><strong>On your laptop, run this</strong><div className="pair-command"><code>cd ~/vertex && npm run pair</code><button onClick={copyCommand}>{copied ? "Copied" : "Copy"}</button></div><small>It restarts Vertex and prints a fresh QR code and pairing link. Do not open that link on the laptop.</small></div></div><div className="pair-card pair-guide"><span className="pair-icon">2</span><div><strong>Use it only on this phone</strong><small>Scan the QR or paste the fresh pairing link below.</small></div></div><button className="primary-button welcome-scan" onClick={() => setScanner(true)}>Scan pairing QR <span>⌗</span></button><details className="pair-link-fallback"><summary>Camera does not work? Paste the pairing link</summary><p>Copy the link printed by <code>npm run pair</code>, send it to this phone, then paste it here.</p><input value={pairLink} onChange={(event) => { setPairLink(event.target.value); setLinkError(""); }} placeholder="https://vertex-cyan-phi.vercel.app/?relayPair=…" inputMode="url"/><button className="secondary-button" onClick={openPairLink}>Pair with link <span>→</span></button>{linkError && <p className="form-error">{linkError}</p>}</details><details className="development-token"><summary>Use a development token instead</summary><label className="token-label">Local testing token<input value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste only for direct local testing" type="password" /></label><button className="secondary-button" onClick={() => token && onConnect(token)}>Connect with token <span>→</span></button></details><p className="welcome-foot">Your code stays on your laptop. Always.</p></div>{scanner && <QrScanner close={() => setScanner(false)}/>}</main>; }
function QrScanner({ close }) {
  const video = useRef(null); const picker = useRef(null); const stream = useRef(null); const frame = useRef(null); const scanning = useRef(false);
  const [message, setMessage] = useState("Use your camera, or take a photo of the QR on your laptop.");
  const [cameraActive, setCameraActive] = useState(false);
  const pair = useCallback((value) => {
    if (value?.includes("relayPair=")) window.location.assign(value);
    else setMessage("That is not a Vertex pairing QR. Try the QR shown by your laptop.");
  }, []);
  const decodeImage = useCallback((source, width, height) => {
    const canvas = document.createElement("canvas"); canvas.width = width; canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently:true }); context.drawImage(source, 0, 0, width, height);
    return jsQR(context.getImageData(0, 0, width, height).data, width, height, { inversionAttempts:"attemptBoth" })?.data;
  }, []);
  const decodePhoto = (file) => {
    if (!file) return;
    const image = new Image(); const url = URL.createObjectURL(file);
    image.onload = () => { const code = decodeImage(image, image.naturalWidth, image.naturalHeight); URL.revokeObjectURL(url); pair(code); };
    image.onerror = () => { URL.revokeObjectURL(url); setMessage("Vertex could not read that photo. Take a sharper, well-lit photo of the QR."); };
    image.src = url;
  };
  const startCamera = async () => {
    if (scanning.current) return;
    setMessage("Requesting camera access…");
    try {
      stream.current = await navigator.mediaDevices.getUserMedia({ video:{ facingMode:{ ideal:"environment" } }, audio:false });
      video.current.srcObject = stream.current; await video.current.play(); scanning.current = true; setCameraActive(true);
      setMessage("Point your phone at the QR on your laptop.");
      const detector = "BarcodeDetector" in window ? new BarcodeDetector({ formats:["qr_code"] }) : null;
      let lastAttempt = 0;
      const scan = async (timestamp) => {
        if (!scanning.current || !video.current) return;
        if (timestamp - lastAttempt > 110 && video.current.videoWidth) {
          lastAttempt = timestamp;
          try {
            const code = detector ? (await detector.detect(video.current))[0]?.rawValue : decodeImage(video.current, video.current.videoWidth, video.current.videoHeight);
            if (code) return pair(code);
          } catch { /* The next video frame is safe to try. */ }
        }
        frame.current = requestAnimationFrame(scan);
      };
      frame.current = requestAnimationFrame(scan);
    } catch (error) {
      const denied = error?.name === "NotAllowedError";
      setMessage(denied ? "Camera access is off. In Android Settings → Apps → Vertex → Permissions, allow Camera, then try again." : "This wrapper cannot open the camera. Open Vertex in Android Chrome to scan, or use the pairing-link fallback on the first screen.");
    }
  };
  useEffect(() => () => { scanning.current = false; cancelAnimationFrame(frame.current); stream.current?.getTracks().forEach((track) => track.stop()); }, []);
  return <div className="scanner-backdrop"><section className="scanner-card"><button className="sheet-close" onClick={close}>×</button><p className="kicker">PAIR VERTEX</p><h2>Scan the laptop QR</h2><video ref={video} className={`scanner-video ${cameraActive ? "is-active" : ""}`} muted playsInline/><p>{message}</p><button className="primary-button scanner-camera-button" onClick={startCamera}>{cameraActive ? "Camera is scanning…" : "Use camera"}<span>⌗</span></button><input ref={picker} className="qr-photo-input" type="file" accept="image/*" capture="environment" onChange={(event) => decodePhoto(event.target.files?.[0])}/><button className="scan-photo-button" onClick={() => picker.current?.click()}>Take or choose QR photo <span>⌑</span></button><small className="scanner-help">If Android never asks for Camera permission, use Chrome for this first pairing or paste the pairing link from the previous screen.</small></section></div>;
}
function Brand() { return <div className="brand"><span className="brand-mark">V</span><span>vertex</span></div>; }
function Topbar({ status, onProfile }) { return <header className="topbar"><Brand/><button className="connection-pill" onClick={onProfile}><i></i>{status}<span>⌄</span></button></header>; }
function Hero({ tasks, onStart, onTerminal }) { const active = tasks.find((task) => task.status === "running"); return <section className="hero"><div className="hero-glow"/><div className="hero-copy"><p className="kicker">{active ? "RUNNING ON YOUR LAPTOP" : "READY WHEN YOU ARE"}</p><h1>{active ? active.name : "Pick up where you left off."}</h1><p>{active ? `${active.projectName || "Workspace"} · ${active.cli || "terminal"} is still working.` : "Start an AI task or open a terminal in any project."}</p><div className="hero-actions"><button className="hero-action" onClick={onStart}>{active ? "Open task" : "Start a task"}<span>→</span></button><button className="hero-terminal-action" onClick={onTerminal}>Open terminal <span>›_</span></button></div></div><div className="hero-visual"><div className="terminal-mini"><div><b></b><b></b><b></b></div><code><i>$</i> {active ? "codex working…" : "vertex connect"}<br/><span>{active ? "✓ reading repository" : "your laptop is ready"}</span></code></div></div></section>; }
function AttentionInbox({ activities, tasks, onOpen, onRead }) { const unread = activities.filter((item) => !item.readAt); const attention = unread.filter((item) => item.type === "attention"); if (!unread.length) return null; return <section className="attention-inbox"><div className="section-head"><div><p className="kicker">YOUR ATTENTION</p><h2>{attention.length ? "Your task is waiting" : "Recent activity"}</h2></div><button className="link" onClick={onRead}>Mark read</button></div>{unread.slice(0, 2).map((item) => <button className={`attention-card ${item.type}`} key={item.id} onClick={() => onOpen(tasks.find((task) => task.id === item.taskId))}><span>{item.type === "attention" ? "!" : item.type === "failed" ? "×" : "✓"}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><b>→</b></button>)}</section>; }
function TaskRail({ tasks, onOpen, onTerminal }) { if (!tasks.length) return <button className="empty-card" onClick={() => onOpen({})}><span>✦</span><div><strong>Your next task starts here</strong><small>Launch Codex, Claude Code, or any terminal command.</small></div><b>+</b></button>; return <div className="task-rail">{tasks.slice(0, 6).map((task) => <article className="task-card" key={task.id} onClick={() => onOpen(task)}><div className="task-top"><span className={`status-dot ${task.status}`}></span><span>{task.cli === "claude" ? "Claude" : task.cli === "codex" ? "Codex" : "Terminal"}</span><button aria-label="Open terminal" onClick={(event) => { event.stopPropagation(); onTerminal(task); }}>↗</button></div><h3>{task.name}</h3><p>{task.projectName || "Local workspace"}</p><div className="task-bottom"><span>{task.status === "running" ? "In progress" : task.status}</span><time>{formatTime(task.createdAt)}</time></div></article>)}</div>; }
function ProjectGrid({ projects, onOpen, onDiscover, limit = 4 }) { const [scanning, setScanning] = useState(false); const [favourites, setFavourites] = useState(() => new Set(stored("vertex.projectFavourites") || [])); const toggle = (projectPath) => { const next = new Set(favourites); next.has(projectPath) ? next.delete(projectPath) : next.add(projectPath); localStorage.setItem("vertex.projectFavourites", JSON.stringify([...next])); setFavourites(next); }; if (!projects.length) return <button className="empty-card project-scan" onClick={async () => { if (!onDiscover || scanning) return; setScanning(true); try { await onDiscover(); } finally { setScanning(false); } }}><span>⌕</span><div><strong>{scanning ? "Scanning your laptop…" : "Find projects on laptop"}</strong><small>Vertex securely finds Git projects in your home folder. No paths to type.</small></div><b>{scanning ? "…" : "→"}</b></button>; const ordered = [...projects].sort((a, b) => Number(favourites.has(b.path)) - Number(favourites.has(a.path)) || a.name.localeCompare(b.name)); return <div className="project-grid">{ordered.slice(0, limit).map((project, index) => <article className="project-tile" key={project.path}><button className={`project-card c${index % 4}`} onClick={() => onOpen(project)}><span className="project-icon">{initials(project.name)}</span><strong>{project.name}</strong><small>{project.branch || "main"}</small><i>→</i></button><button className={`project-favourite ${favourites.has(project.path) ? "is-favourite" : ""}`} aria-label={`Toggle favourite ${project.name}`} onClick={() => toggle(project.path)}>★</button></article>)}</div>; }
function SessionList({ sessions, onOpen, onManage }) { if (!sessions.length) return <p className="muted-copy">No open terminal sessions yet.</p>; return <div className="sessions">{sessions.map((session) => <div className="session-row" key={session.name}><button onClick={() => onOpen(session)}><span className="session-terminal">›_</span><span><strong>{session.name}</strong><small>{session.attached ? "Active now" : "Ready to resume"}</small></span><b>→</b></button><button className="session-manage" aria-label={`Manage ${session.name}`} onClick={() => onManage(session)}>•••</button></div>)}</div>; }
function DockerSummary({ docker, onOpen }) { if (!docker?.available) return null; const running = docker.containers.filter((item) => item.state === "running").length; return <button className="docker-summary" onClick={onOpen}><span>◇</span><div><strong>Docker</strong><small>{running} running · {docker.containers.length} containers</small></div><b>→</b></button>; }

function Sheet({ kind, vertex, selected, close, openTerminal }) {
  const content = typeof kind === "string" ? { type:kind } : kind;
  return <div className="sheet-backdrop" onMouseDown={close}><section className="sheet" onMouseDown={(event) => event.stopPropagation()}><div className="sheet-handle"/><button className="sheet-close" onClick={close}>×</button>
    {content.type === "profile" && <ProfilePanel vertex={vertex} close={close}/>} {content.type === "sessionDetail" && <SessionDetail session={selected} vertex={vertex} close={close}/>} {content.type === "taskDetail" && <TaskDetail task={selected} vertex={vertex} openTerminal={openTerminal} close={close}/>} {content.type === "projects" && <ProjectsPanel vertex={vertex}/>} {content.type === "activity" && <ActivityPanel vertex={vertex}/>} {content.type === "docker" && <DockerPanel vertex={vertex}/>} {(!content.type || content.type === "session") && <TaskComposer project={content.project} terminal={content.terminal} vertex={vertex} close={close} openTerminal={openTerminal}/>}</section></div>;
}

function ProfilePanel({ vertex, close }) {
  const [devices, setDevices] = useState([]); const [error, setError] = useState(""); const [preventSleep, setPreventSleep] = useState(vertex.data.settings?.preventSleep ?? true);
  const [setup, setSetup] = useState(false);
  const load = useCallback(() => vertex.request("listDevices").then((value) => setDevices(value.devices || [])).catch((caught) => setError(caught.message)), [vertex]);
  useEffect(() => { load(); }, [load]);
  const revoke = async (device) => { if (!window.confirm(`Remove ${device.name} from Vertex? It will lose access immediately.`)) return; try { await vertex.request("revokeDevice", { id:device.id }); await load(); } catch (caught) { setError(caught.message); } };
  const toggleSleep = async () => { const next = !preventSleep; setPreventSleep(next); try { await vertex.request("updateSettings", { preventSleep:next }); await vertex.refresh(); } catch (caught) { setPreventSleep(!next); setError(caught.message); } };
  if (setup) return <SetupPanel vertex={vertex} close={() => setSetup(false)}/>;
  return <><p className="kicker">VERTEX DEVICE</p><h2>Your private workspace</h2><div className="profile-row"><span className="avatar">A</span><div><strong>{vertex.data.health?.hostname || "Paired laptop"}</strong><small>{vertex.status} · {vertex.data.health?.projects || 0} projects</small></div><i className="status-dot running"/></div><p className="kicker">RUNNING TASKS</p><button className={`setting-toggle ${preventSleep ? "enabled" : ""}`} onClick={toggleSleep}><span><strong>Keep laptop awake</strong><small>Only while a Vertex task is running</small></span><b>{preventSleep ? "On" : "Off"}</b></button><p className="kicker">PAIRED DEVICES</p><div className="device-list">{devices.map((device) => <div key={device.id}><span>◉</span><p><strong>{device.name}</strong><small>{device.revoked ? "Revoked" : "Active"}</small></p>{!device.revoked && <button onClick={() => revoke(device)}>Revoke</button>}</div>)}</div>{error && <p className="form-error">{error}</p>}<button className="secondary-button setup-button" onClick={() => setSetup(true)}>Setup & test Vertex <span>→</span></button><button className="danger-button" onClick={() => { vertex.forget(); close(); }}>Forget this laptop</button></>;
}

function SetupPanel({ vertex, close }) {
  const [message, setMessage] = useState(""); const [testing, setTesting] = useState(false); const health = vertex.data.health; const notification = health?.notification;
  const testActivity = async () => { setTesting(true); setMessage(""); try { await vertex.request("testActivity"); await vertex.refresh(); setMessage("Test received. You can now see it in Home → Activity."); } catch (caught) { setMessage(caught.message); } finally { setTesting(false); } };
  return <><p className="kicker">SETUP & TEST</p><h2>Check Vertex yourself</h2><p className="muted-copy setup-intro">These checks are real. They show what works on your laptop today and what still needs a native Android or Firebase setup.</p><div className="setup-checks"><SetupCheck ready={Boolean(health?.ok)} title="Encrypted laptop link" detail={health?.ok ? `Connected to ${health.hostname}` : "Reconnect your laptop agent"}/><SetupCheck ready={vertex.data.sessions.length > 0} title="Persistent terminals" detail={vertex.data.sessions.length ? `${vertex.data.sessions.length} terminal${vertex.data.sessions.length === 1 ? "" : "s"} ready to resume` : "Open a terminal to test this"}/><SetupCheck ready={vertex.data.projects.length > 0} title="Project discovery" detail={vertex.data.projects.length ? `${vertex.data.projects.length} project${vertex.data.projects.length === 1 ? "" : "s"} found` : "Use Find projects on laptop"}/><SetupCheck ready title="In-app activity" detail="Ready to test over your encrypted connection"/><SetupCheck ready={Boolean(notification?.firebaseConfigured)} title="Background push" detail={notification?.firebaseConfigured ? "Firebase configuration detected" : "Needs Firebase + Nativine Android setup"}/><SetupCheck ready={false} title="Biometric lock" detail="Needs a Nativine native biometric bridge"/></div><button className="primary-button" disabled={testing || !health?.ok} onClick={testActivity}>{testing ? "Sending test…" : "Send in-app activity test"}<span>→</span></button>{message && <p className={message.includes("received") ? "setup-success" : "form-error"}>{message}</p>}<p className="setup-foot">The test safely writes one activity event on your laptop. It does not run a terminal command or send terminal text to Vertex servers.</p><button className="secondary-button" onClick={close}>‹ Back to account</button></>;
}

function SetupCheck({ ready, title, detail }) { return <article className={`setup-check ${ready ? "ready" : "needs-setup"}`}><span>{ready ? "✓" : "!"}</span><div><strong>{title}</strong><small>{detail}</small></div><b>{ready ? "Ready" : "Setup"}</b></article>; }

function ProjectsPanel({ vertex }) { const [query, setQuery] = useState(""); const [project, setProject] = useState(null); const projects = vertex.data.projects.filter((item) => item.name.toLowerCase().includes(query.toLowerCase())); if (project) return <FileBrowser project={project} vertex={vertex} close={() => setProject(null)}/>; return <><p className="kicker">WORKSPACES</p><h2>Browse your laptop</h2><input className="project-search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search projects"/><ProjectGrid projects={projects} onOpen={setProject} onDiscover={vertex.discoverProjects} limit={Number.MAX_SAFE_INTEGER}/></>; }

function FileBrowser({ project, vertex, close }) { const [relativePath, setRelativePath] = useState(""); const [listing, setListing] = useState({ files:[] }); const [preview, setPreview] = useState(null); const [view, setView] = useState("files"); const [error, setError] = useState(""); const load = useCallback(async (next = relativePath) => { try { setError(""); const value = await vertex.request("listFiles", { projectPath:project.path, relativePath:next }); setListing(value); setRelativePath(value.relativePath); setPreview(null); } catch (caught) { setError(caught.message); } }, [project.path, relativePath, vertex]); useEffect(() => { load(""); }, [project.path]); const parent = relativePath ? relativePath.split("/").slice(0, -1).join("/") : null; const open = async (file) => { if (file.kind === "directory") return load(file.relativePath); try { setPreview(await vertex.request("readFile", { projectPath:project.path, relativePath:file.relativePath })); } catch (caught) { setError(caught.message); } }; return <><p className="kicker">{project.name.toUpperCase()}</p><h2>{view === "git" ? "Git workspace" : preview ? preview.name : relativePath || "Files"}</h2><div className="file-toolbar"><button onClick={close}>‹ Projects</button><button className={view === "files" ? "active" : ""} onClick={() => setView("files")}>Files</button><button className={view === "git" ? "active" : ""} onClick={() => { setPreview(null); setView("git"); }}>Git</button>{view === "files" && !preview && parent !== null && <button onClick={() => load(parent)}>↑ Up</button>}</div>{error && <p className="form-error">{error}</p>}{view === "git" ? <GitWorkspace project={project} vertex={vertex}/> : preview ? <pre className="file-preview">{preview.content}</pre> : <div className="file-list">{listing.files.map((file) => <button key={file.relativePath} onClick={() => open(file)}><span>{file.kind === "directory" ? "□" : "≡"}</span><div><strong>{file.name}</strong><small>{file.kind === "directory" ? "Folder" : `${Math.ceil(file.size / 1024)} KB`}</small></div><b>›</b></button>)}</div>}</>; }

function GitWorkspace({ project, vertex }) { const [status, setStatus] = useState(null); const [error, setError] = useState(""); const load = useCallback(() => vertex.request("gitStatus", { projectPath:project.path }).then(setStatus).catch((caught) => setError(caught.message)), [project.path, vertex]); useEffect(() => { load(); }, [load]); if (error) return <p className="form-error">{error}</p>; if (!status) return <p className="muted-copy">Checking Git status…</p>; return <section className="git-workspace"><div className="git-branch"><span>⌘</span><div><strong>{status.branch}</strong><small>{status.totalChanges ? `${status.totalChanges} changed file${status.totalChanges === 1 ? "" : "s"}` : "Working tree is clean"}</small></div><button onClick={load}>Refresh</button></div><pre>{status.stat}</pre><div className="git-files">{status.changes.length ? status.changes.map((change) => <div key={`${change.status}:${change.file}`}><b>{change.status}</b><span>{change.file}</span></div>) : <p className="muted-copy">No changed files.</p>}</div><p className="muted-copy">Use the live terminal for commits and pushes.</p></section>; }

function ActivityPanel({ vertex }) { const activities = vertex.data.activities; return <><p className="kicker">ACTIVITY</p><h2>Everything is here</h2><button className="link activity-read" onClick={() => vertex.request("readActivity").then(vertex.refresh)}>Mark all read</button><div className="activity-list">{activities.length ? activities.map((item) => <article key={item.id}><span className={item.type}>{item.type === "attention" ? "!" : item.type === "failed" ? "×" : "✓"}</span><div><strong>{item.title}</strong><small>{item.detail}</small></div><time>{formatTime(item.createdAt)}</time></article>) : <p className="muted-copy">No activity yet. Vertex will keep you informed when work changes.</p>}</div></>; }
function DockerPanel({ vertex }) { const [containers, setContainers] = useState(vertex.data.docker?.containers || []); const [log, setLog] = useState(null); const [error, setError] = useState(""); const refresh = () => vertex.request("listDocker").then((value) => setContainers(value.containers || [])).catch((caught) => setError(caught.message)); const open = (container) => vertex.request("dockerLogs", { container:container.name || container.id }).then(setLog).catch((caught) => setError(caught.message)); return <><p className="kicker">DOCKER ON LAPTOP</p><h2>{log ? `${log.container} logs` : "Containers"}</h2><div className="file-toolbar">{log && <button onClick={() => setLog(null)}>‹ Containers</button>}<button onClick={refresh}>Refresh</button></div>{error && <p className="form-error">{error}</p>}{log ? <pre className="file-preview">{log.content || "No recent logs."}</pre> : <><div className="docker-list">{containers.length ? containers.map((container) => <button key={container.id} onClick={() => open(container)}><span className={`status-dot ${container.state === "running" ? "running" : ""}`}/><div><strong>{container.name}</strong><small>{container.image} · {container.status}</small></div><b>Logs →</b></button>) : <p className="muted-copy">No Docker containers on this laptop.</p>}</div><p className="muted-copy">Use a live terminal for Docker changes.</p></>}</>; }

function SessionDetail({ session, vertex, close }) { const [nextName, setNextName] = useState(session?.name || ""); const [error, setError] = useState(""); const run = async (action) => { try { await vertex.request("sessionAction", { action, name:session.name, nextName }); await vertex.refresh(); close(); } catch (caught) { setError(caught.message); } }; return <><p className="kicker">PERSISTENT TERMINAL</p><h2>{session?.name}</h2><label>Rename session<input value={nextName} onChange={(event) => setNextName(event.target.value)} placeholder="codex-fix-login"/></label><button className="secondary-button" onClick={() => run("rename")}>Rename session</button><button className="danger-button" onClick={() => run("stop")}>Stop session</button>{error && <p className="form-error">{error}</p>}</>; }

function TaskComposer({ project, terminal = false, vertex, close, openTerminal }) {
  const [task, setTask] = useState({ cli:terminal ? "terminal" : "codex", name:"", cwd:project?.path || "", prompt:"" }); const [busy, setBusy] = useState(false); const [error, setError] = useState("");
  const createTask = async () => { if (!task.name || !task.cwd || (task.cli !== "terminal" && !task.prompt)) return setError(task.cli === "terminal" ? "Name this terminal and choose a project." : "Give this task a name, project, and instruction."); setBusy(true); try { if (task.cli === "terminal") { const result = await vertex.request("createSession", { name:task.name, cwd:task.cwd }); openTerminal(result.session || { name:task.name, cwd:task.cwd }); return; } const message = { type:"createTask", ...task, command:task.cli === "command" ? task.prompt : "" }; if (vertex.relay) await vertex.request("createTask", message); else { const socket = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?token=${encodeURIComponent(vertex.token)}`); socket.onopen = () => socket.send(JSON.stringify(message)); await new Promise((resolve, reject) => { socket.onmessage = ({ data }) => { const event = JSON.parse(data); if (event.type === "taskCreated") { socket.close(); resolve(event); } }; socket.onerror = reject; }); } close(); vertex.refresh(); } catch (caught) { setError(caught.message); } finally { setBusy(false); } };
  return <><p className="kicker">{task.cli === "terminal" ? "NEW REAL TERMINAL" : project ? project.name.toUpperCase() : "NEW AI TASK"}</p><h2>{task.cli === "terminal" ? "Open a shell on your laptop." : "Tell your laptop what to do."}</h2><div className="agent-pills">{["terminal","codex","claude","command"].map((item) => <button className={task.cli === item ? "selected" : ""} key={item} onClick={() => setTask({ ...task, cli:item })}>{item === "terminal" ? "Terminal" : item === "claude" ? "Claude" : item === "codex" ? "Codex" : "Command"}</button>)}</div><label>{task.cli === "terminal" ? "Terminal name" : "Task name"}<input value={task.name} onChange={(event) => setTask({ ...task, name:event.target.value.replace(/\s+/g, "-").toLowerCase() })} placeholder={task.cli === "terminal" ? "project-shell" : "fix-login-flow"}/></label><label>Project<select value={task.cwd} onChange={(event) => setTask({ ...task, cwd:event.target.value })}><option value="">Choose a workspace</option>{vertex.data.projects.map((item) => <option key={item.path} value={item.path}>{item.name} · {item.branch}</option>)}</select></label>{!vertex.data.projects.length && <button className="secondary-button project-discover-button" onClick={() => vertex.discoverProjects().catch(() => {})}>Find projects on laptop</button>}{task.cli !== "terminal" && <label>{task.cli === "command" ? "Command" : "What should it do?"}<textarea value={task.prompt} onChange={(event) => setTask({ ...task, prompt:event.target.value })} placeholder={task.cli === "command" ? "npm test" : "Fix the issue, explain the change, and run the tests."}/></label>}{error && <p className="form-error">{error}</p>}<button className="primary-button" disabled={busy} onClick={createTask}>{busy ? "Starting…" : task.cli === "terminal" ? "Open terminal" : "Start on laptop"}<span>→</span></button></>;
}
function TaskDetail({ task, vertex, openTerminal, close }) {
  const [diff, setDiff] = useState(null); const [message, setMessage] = useState("");
  useEffect(() => { if (task?.id) vertex.request("taskDiff", { id:task.id }).then(setDiff).catch(() => setDiff({ stat:"Changes will appear here when available." })); }, [task?.id, vertex.request]);
  if (!task) return null;
  const action = async (type, extra = {}) => { try { await vertex.request(type, extra); await vertex.refresh(); setMessage(type === "reviewTask" ? "Review saved on your laptop." : "Task updated."); } catch (error) { setMessage(error.message); } };
  return <><p className="kicker">{task.status === "waiting" ? "INPUT NEEDED" : task.status === "running" ? "WORKING NOW" : "TASK REVIEW"}</p><h2>{task.name}</h2><div className="detail-meta"><span className={`status-dot ${task.status}`}/>{task.projectName || "Workspace"}<b>·</b>{task.cli}</div>{task.attention && <p className="attention-copy">{task.attention.message}</p>}<div className="diff-preview"><strong>{diff?.stat || "Checking changes…"}</strong><pre>{diff?.diff || "Vertex will show a safe, reviewable diff once the task changes files."}</pre></div><button className="primary-button" onClick={() => openTerminal(task)}>Open live terminal <span>→</span></button><div className="task-actions"><button onClick={() => action("reviewTask", { id:task.id, decision:"approved" })}>Mark diff reviewed</button><button onClick={() => action("sessionAction", { action:"pin", taskId:task.id, name:task.sessionName || task.name })}>{task.pinned ? "Pinned" : "Pin task"}</button><button onClick={() => action("sessionAction", { action:"archive", taskId:task.id, name:task.sessionName || task.name })}>Archive</button></div>{message && <p className="muted-copy">{message}</p>}<button className="secondary-button" onClick={close}>Keep running in background</button></>;
}

function controlInput(data) { return data.length === 1 && /^[a-z]$/i.test(data) ? String.fromCharCode(data.toUpperCase().charCodeAt(0) - 64) : data; }

function TerminalView({ vertex, session, onClose, onSwitch }) {
  const element = useRef(null); const socket = useRef(null); const terminal = useRef(null); const fit = useRef(null); const finder = useRef(null); const output = useRef({ expected:1, pending:new Map(), scheduled:false }); const touchY = useRef(null); const pinchDistance = useRef(null); const ctrlArmed = useRef(false);
  const [status, setStatus] = useState("Connecting…"); const [following, setFollowing] = useState(true); const [searchOpen, setSearchOpen] = useState(false); const [query, setQuery] = useState(""); const [ctrlActive, setCtrlActive] = useState(false); const [fontSize, setFontSize] = useState(14); const [switcherOpen, setSwitcherOpen] = useState(false);
  const sendInput = useCallback((data) => { const payload = ctrlArmed.current ? controlInput(data) : data; if (ctrlArmed.current) { ctrlArmed.current = false; setCtrlActive(false); } vertex.send({ type:"input", data:payload }, socket.current); }, [vertex.send]);
  const adjustFont = useCallback((delta) => { const current = terminal.current; if (!current) return; const next = Math.max(11, Math.min(20, (current.options.fontSize || 14) + delta)); if (next === current.options.fontSize) return; current.options.fontSize = next; setFontSize(next); requestAnimationFrame(() => fit.current?.fit()); }, []);
  useEffect(() => {
    let disposed = false; let cleanup = () => {};
    (async () => {
      const [{ Terminal }, { FitAddon }, { SearchAddon }] = await Promise.all([import("@xterm/xterm"), import("@xterm/addon-fit"), import("@xterm/addon-search"), import("@xterm/xterm/css/xterm.css")]);
      if (disposed) return;
      const term = new Terminal({ cursorBlink:true, fontSize:14, fontFamily:"'JetBrains Mono', ui-monospace, monospace", theme:{ background:"#090b11", foreground:"#eaf0ff", cursor:"#a7b6ff", selectionBackground:"#364267" }, scrollback:10000, scrollSensitivity:3 });
      const addon = new FitAddon(); const searchAddon = new SearchAddon(); term.loadAddon(addon); term.loadAddon(searchAddon); term.open(element.current); terminal.current = term; fit.current = addon; finder.current = searchAddon;
      const send = (message) => vertex.send(message, socket.current);
      const resize = () => { addon.fit(); send({ type:"resize", cols:term.cols, rows:term.rows }); };
      const updateFollowState = () => setFollowing(term.buffer.active.viewportY >= term.buffer.active.baseY);
      const flush = () => { output.current.scheduled = false; let text=""; while (output.current.pending.has(output.current.expected)) { text += output.current.pending.get(output.current.expected); output.current.pending.delete(output.current.expected++); } if (text) term.write(text, updateFollowState); };
      const receive = (event) => {
        if (event.type === "terminalSnapshot") { term.reset(); term.write(event.data, updateFollowState); output.current = { expected:event.sequence + 1, pending:new Map(), scheduled:false }; resize(); }
        if (event.type === "output" && event.sequence >= output.current.expected && !output.current.pending.has(event.sequence)) { output.current.pending.set(event.sequence,event.data); if (!output.current.scheduled) { output.current.scheduled = true; requestAnimationFrame(flush); } }
        if (event.type === "attached") setStatus("Live"); if (event.type === "error") setStatus(event.message);
      };
      const onTouchStart = (event) => { if (event.touches.length === 2) { const [first, second] = event.touches; pinchDistance.current = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY); touchY.current = null; return; } touchY.current = event.touches[0]?.clientY ?? null; };
      const onTouchMove = (event) => {
        if (event.touches.length === 2) { const [first, second] = event.touches; const distance = Math.hypot(first.clientX - second.clientX, first.clientY - second.clientY); if (pinchDistance.current !== null && Math.abs(distance - pinchDistance.current) >= 14) { adjustFont(distance > pinchDistance.current ? 1 : -1); pinchDistance.current = distance; } event.preventDefault(); return; }
        const nextY = event.touches[0]?.clientY; if (touchY.current === null || nextY === undefined) return;
        const difference = nextY - touchY.current;
        if (Math.abs(difference) < 7) return;
        term.scrollLines(Math.round(-difference / 8)); touchY.current = nextY; updateFollowState(); event.preventDefault();
      };
      const onTouchEnd = () => { touchY.current = null; pinchDistance.current = null; };
      vertex.terminalListener.current = receive; const dataListener = term.onData(sendInput); const scrollListener = term.onScroll(updateFollowState);
      element.current.addEventListener("touchstart", onTouchStart, { passive:true }); element.current.addEventListener("touchmove", onTouchMove, { passive:false }); element.current.addEventListener("touchend", onTouchEnd, { passive:true });
      const observer = new ResizeObserver(() => setTimeout(resize, 80)); observer.observe(element.current);
      if (vertex.relay) { send({ type:"attach", name:session.name }); setStatus("Live"); } else { const connectDirect = () => { if (disposed) return; const ws = new WebSocket(`${location.protocol === "https:" ? "wss" : "ws"}://${location.host}/?token=${encodeURIComponent(vertex.token)}`); socket.current = ws; ws.onopen = () => ws.send(JSON.stringify({ type:"attach", name:session.name })); ws.onmessage = ({ data }) => receive(JSON.parse(data)); ws.onclose = () => { if (!disposed) { setStatus("Reconnecting…"); setTimeout(connectDirect, 1000); } }; }; connectDirect(); }
      requestAnimationFrame(resize);
      cleanup = () => { vertex.terminalListener.current = () => {}; observer.disconnect(); dataListener.dispose(); scrollListener.dispose(); element.current?.removeEventListener("touchstart", onTouchStart); element.current?.removeEventListener("touchmove", onTouchMove); element.current?.removeEventListener("touchend", onTouchEnd); socket.current?.close(); term.dispose(); fit.current = null; finder.current = null; };
    })().catch((error) => setStatus(error.message));
    return () => { disposed = true; cleanup(); };
  }, [adjustFont, sendInput, session.name, vertex.relay, vertex.token, vertex.send, vertex.terminalListener]);
  const keys = [["Ctrl+C","\u0003"],["Esc","\u001b"],["Tab","\t"],["|","|"],["/","/"],["↑","\u001b[A"],["↓","\u001b[B"],["←","\u001b[D"],["→","\u001b[C"]];
  const copy = async () => { const value = terminal.current?.getSelection(); if (!value) return setStatus("Select terminal text to copy"); try { await navigator.clipboard.writeText(value); setStatus("Copied"); } catch { setStatus("Copy is unavailable in this app"); } };
  const paste = async () => { try { const value = await navigator.clipboard.readText(); if (value) sendInput(value); } catch { setStatus("Allow clipboard access to paste"); } };
  const findNext = () => { if (query) finder.current?.findNext(query, { incremental:true }); };
  const sessions = vertex.data.sessions.some((item) => item.name === session.name) ? vertex.data.sessions : [session, ...vertex.data.sessions];
  return <main className="terminal-page"><header><button aria-label="Back to dashboard" onClick={onClose}>‹</button><div><span className="kicker">LIVE TERMINAL</span><strong>{session.name}</strong></div><span className="live-pill"><i/> {status}</span><button className="terminal-tool" aria-label="Switch terminal" onClick={() => setSwitcherOpen((open) => !open)}>▤</button><button className="terminal-tool" aria-label="Search terminal" onClick={() => setSearchOpen(true)}>⌕</button></header>{switcherOpen && <section className="terminal-switcher"><div><strong>Your terminals</strong><button onClick={() => vertex.refresh()}>Refresh</button></div>{sessions.map((item) => <button className={item.name === session.name ? "selected" : ""} key={item.name} disabled={item.name === session.name} onClick={() => { setSwitcherOpen(false); onSwitch(item); }}><span>›_</span><p><strong>{item.name}</strong><small>{item.attached ? "In use now" : "Ready to resume"}</small></p><b>{item.name === session.name ? "Live" : "Open"}</b></button>)}</section>}{searchOpen && <div className="terminal-search"><input autoFocus value={query} onChange={(event) => { setQuery(event.target.value); finder.current?.findNext(event.target.value, { incremental:true }); }} onKeyDown={(event) => { if (event.key === "Enter") findNext(); if (event.key === "Escape") setSearchOpen(false); }} placeholder="Find in terminal"/><button onClick={findNext}>Next</button><button onClick={() => setSearchOpen(false)}>×</button></div>}<div className="terminal-area"><div className="terminal-wrap" ref={element}/>{!following && <button className="terminal-follow" onClick={() => { terminal.current?.scrollToBottom(); setFollowing(true); }}>↓ Live</button>}<p className="terminal-hint">Swipe to review · pinch to zoom</p></div><nav className="terminal-keys"><button onClick={copy}>Copy</button><button onClick={paste}>Paste</button><button className={ctrlActive ? "armed" : ""} aria-pressed={ctrlActive} onClick={() => { ctrlArmed.current = !ctrlArmed.current; setCtrlActive(ctrlArmed.current); }}>Ctrl</button><button aria-label="Decrease terminal text size" onClick={() => adjustFont(-1)}>A−</button><button aria-label="Increase terminal text size" title={`${fontSize}px`} onClick={() => adjustFont(1)}>A+</button>{keys.map(([label,data]) => <button key={label} onClick={() => sendInput(data)}>{label}</button>)}</nav></main>;
}

const root = globalThis.__vertexReactRoot || createRoot(document.getElementById("root"));
globalThis.__vertexReactRoot = root;
root.render(<App/>);
