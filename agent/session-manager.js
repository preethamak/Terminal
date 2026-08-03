const { execFile } = require("node:child_process");
const { promisify } = require("node:util");
const pty = require("node-pty");

const execFileAsync = promisify(execFile);
const SESSION_NAME = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,62}$/;
const SESSION_SEPARATOR = "|";
const shellQuote = (value) => `'${String(value).replaceAll("'", "'\\''")}'`;
const inhibitedCommand = (command, name, shell) => `systemd-inhibit --what=sleep --mode=block --why=${shellQuote(`Vertex task: ${name}`)} ${shellQuote(shell)} -lc ${shellQuote(command)}`;

function parseSessionList(stdout) {
  return stdout.trim().split("\n").filter(Boolean).map((line) => {
    const [name, createdAt, attached] = line.split(SESSION_SEPARATOR);
    return { name, createdAt:Number(createdAt), attached:Number(attached) > 0 };
  });
}

function parseSessionMetadata(stdout) {
  const value = stdout.trim(); const separator = value.indexOf(SESSION_SEPARATOR);
  return separator < 0 ? { cwd:null, program:null } : { cwd:value.slice(0, separator) || null, program:value.slice(separator + 1) || null };
}

class SessionManager {
  constructor({ shell = process.env.SHELL || "/bin/bash" } = {}) {
    this.shell = shell;
    this.attachments = new Map();
  }

  async ensureTmux() {
    try {
      await execFileAsync("tmux", ["-V"]);
    } catch {
      throw new Error("tmux is required. Install it first (for example: sudo apt install tmux).");
    }
  }

  async supportsInhibit() { try { await execFileAsync("systemd-inhibit", ["--version"]); return true; } catch { return false; } }

  async list() {
    await this.ensureTmux();
    try {
      const { stdout } = await execFileAsync("tmux", [
        "list-sessions",
        "-F",
        `#{session_name}${SESSION_SEPARATOR}#{session_created}${SESSION_SEPARATOR}#{session_attached}`,
      ]);
      const sessions = parseSessionList(stdout);
      return Promise.all(sessions.map(async (session) => {
        try {
          const { stdout: metadata } = await execFileAsync("tmux", ["display-message", "-p", "-t", session.name, `#{pane_current_path}${SESSION_SEPARATOR}#{pane_current_command}`]);
          return { ...session, ...parseSessionMetadata(metadata) };
        } catch { return { ...session, cwd:null, program:null }; }
      }));
    } catch (error) {
      if (error.code === 1) return [];
      throw error;
    }
  }

  async create({ name, cwd, command, eventFile, preventSleep = false }) {
    if (!SESSION_NAME.test(name || "")) {
      throw new Error("Session names must be 1–63 characters: letters, numbers, ., _, or -.");
    }
    if (!cwd || !cwd.startsWith("/")) throw new Error("A valid absolute project path is required.");
    await this.ensureTmux();
    const args = ["new-session", "-d", "-s", name, "-c", cwd, this.shell];
    if (command) {
      if (!eventFile) throw new Error("An event file is required for a managed task.");
      const runnable = preventSleep && await this.supportsInhibit() ? inhibitedCommand(command, name, this.shell) : command;
      const script = [
        "set +e",
        runnable,
        "vertex_exit=$?",
        'if [ "$vertex_exit" -eq 0 ]; then vertex_status=completed; else vertex_status=failed; fi',
        `printf '{"status":"%s","exitCode":%s}\\n' "$vertex_status" "$vertex_exit" > ${shellQuote(eventFile)}`,
        'printf "\\n[Vertex] Task %s (exit %s). Terminal remains open.\\n" "$vertex_status" "$vertex_exit"',
        `exec ${shellQuote(this.shell)}`,
      ].join("\n");
      args.push("-lc", script);
    }
    await execFileAsync("tmux", args);
    return { name, cwd };
  }

  async snapshot(name) {
    if (!SESSION_NAME.test(name || "")) throw new Error("Invalid session name.");
    // A reconnect should restore the terminal's reviewable history, not only the
    // currently visible pane. tmux limits this to the session history-limit.
    const { stdout } = await execFileAsync("tmux", ["capture-pane", "-p", "-e", "-S", "-", "-t", name]);
    return stdout;
  }

  async rename(name, nextName) {
    if (!SESSION_NAME.test(name || "") || !SESSION_NAME.test(nextName || "")) throw new Error("Session names must be 1–63 letters, numbers, ., _, or -.");
    await execFileAsync("tmux", ["rename-session", "-t", name, nextName]);
    return { name:nextName };
  }

  async kill(name) {
    if (!SESSION_NAME.test(name || "")) throw new Error("Invalid session name.");
    await execFileAsync("tmux", ["kill-session", "-t", name]);
    return { name, stopped:true };
  }

  async sendApproval(name, choice) {
    if (!SESSION_NAME.test(name || "")) throw new Error("Invalid session name.");
    if (choice !== "y" && choice !== "n") throw new Error("Approval choice must be y or n.");
    await execFileAsync("tmux", ["send-keys", "-t", name, choice, "Enter"]);
    return { name, choice };
  }

  attach(name, { onData, onExit }) {
    if (!SESSION_NAME.test(name || "")) throw new Error("Invalid session name.");
    const terminal = pty.spawn("tmux", ["attach-session", "-t", name], {
      name: "xterm-256color",
      cols: 100,
      rows: 30,
      cwd: process.cwd(),
      env: { ...process.env, TERM: "xterm-256color" },
    });
    terminal.onData(onData);
    terminal.onExit(onExit);
    return terminal;
  }
}

module.exports = { SessionManager, SESSION_NAME, SESSION_SEPARATOR, parseSessionList, parseSessionMetadata, shellQuote, inhibitedCommand };
