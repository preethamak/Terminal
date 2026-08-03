const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");

const DEFAULT_ROOT_NAMES = ["Projects", "projects", "code", "workspace", "workspaces", "dev"];
const SKIP = new Set([".git", "node_modules", "vendor", "dist", "build", "target"]);

class WorkspaceIndex {
  constructor({ home = process.env.HOME || ".", file = path.join(process.env.HOME || ".", ".vertex", "workspaces.json") } = {}) { this.home = path.resolve(home); this.file = file; }

  read() { try { return JSON.parse(fs.readFileSync(this.file, "utf8")); } catch (error) { if (error.code === "ENOENT") return { roots:[], recent:{} }; throw error; } }
  write(value) { fs.mkdirSync(path.dirname(this.file), { recursive:true, mode:0o700 }); fs.writeFileSync(this.file, `${JSON.stringify(value, null, 2)}\n`, { mode:0o600 }); }
  roots() { const stored = this.read().roots || []; return [...new Set(stored.map((item) => path.resolve(item)))]; }
  async ensureRoots() {
    const state = this.read(); if (state.roots?.length) return this.roots();
    const candidates = DEFAULT_ROOT_NAMES.map((name) => path.join(this.home, name));
    const existing = candidates.filter((candidate) => { try { return fs.statSync(candidate).isDirectory(); } catch { return false; } });
    const roots = existing.length ? existing : [path.join(this.home, "Projects")];
    if (!existing.length) fs.mkdirSync(roots[0], { recursive:true, mode:0o700 });
    this.write({ ...state, roots, recent:state.recent || {} }); return roots;
  }
  async addRoot(root) {
    const resolved = await fsp.realpath(root); if (!resolved.startsWith(`${this.home}${path.sep}`) && resolved !== this.home) throw new Error("Workspace roots must be inside your home folder.");
    const state = this.read(); const roots = [...new Set([...(state.roots || []), resolved])]; this.write({ ...state, roots, recent:state.recent || {} }); return roots;
  }
  touch(workspacePath) { const state = this.read(); state.recent ||= {}; state.recent[path.resolve(workspacePath)] = Date.now(); this.write(state); }
  async isGit(workspacePath) { try { return (await fsp.stat(path.join(workspacePath, ".git"))).isDirectory(); } catch { return false; } }
  async rootFolders(root) {
    let entries; try { entries = await fsp.readdir(root, { withFileTypes:true }); } catch { return []; }
    return Promise.all(entries.filter((entry) => entry.isDirectory() && !entry.name.startsWith(".") && !SKIP.has(entry.name)).map(async (entry) => {
      const workspacePath = path.join(root, entry.name); return { path:workspacePath, name:entry.name, kind:await this.isGit(workspacePath) ? "git" : "folder", source:"root" };
    }));
  }
  async list({ sessions = [], tasks = [], projects = [] } = {}) {
    const roots = await this.ensureRoots(); const state = this.read(); const entries = new Map();
    const add = async (item) => {
      if (!item?.path || !path.isAbsolute(item.path)) return;
      let resolved; try { resolved = await fsp.realpath(item.path); } catch { return; }
      const existing = entries.get(resolved); const kind = item.kind || (await this.isGit(resolved) ? "git" : "folder");
      entries.set(resolved, { path:resolved, name:path.basename(resolved), kind:existing?.kind === "git" || kind === "git" ? "git" : "folder", source:existing?.source || item.source || "recent", lastOpenedAt:state.recent?.[resolved] || 0 });
    };
    for (const root of roots) for (const folder of await this.rootFolders(root)) await add(folder);
    for (const project of projects) await add({ ...project, kind:"git", source:"git" });
    for (const session of sessions) await add({ path:session.cwd, source:"session" });
    for (const task of tasks) await add({ path:task.cwd, source:"task" });
    return [...entries.values()].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt || a.name.localeCompare(b.name));
  }
}

module.exports = { WorkspaceIndex, DEFAULT_ROOT_NAMES };
