const fs = require("node:fs/promises");
const fsSync = require("node:fs");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const SKIP = new Set([".git", ".cache", ".config", ".local", ".npm", ".cargo", ".rustup", ".gemini", ".openclaw", ".codex", ".agents", "node_modules", "vendor", "dist", "build", "target"]);

class ProjectIndex {
  constructor({ root = process.env.HOME || ".", file = path.join(process.env.HOME || ".", ".vertex", "projects.json"), maxDepth = 4 } = {}) {
    this.root = root; this.file = file; this.maxDepth = maxDepth; this.refreshing = null;
  }

  read() { try { return JSON.parse(fsSync.readFileSync(this.file, "utf8")); } catch (error) { if (error.code === "ENOENT") return []; throw error; } }
  write(projects) { fsSync.mkdirSync(path.dirname(this.file), { recursive: true, mode: 0o700 }); fsSync.writeFileSync(this.file, `${JSON.stringify(projects, null, 2)}\n`, { mode: 0o600 }); }

  async refresh() {
    if (this.refreshing) return this.refreshing;
    this.refreshing = this.scan();
    try { return await this.refreshing; } finally { this.refreshing = null; }
  }

  async scan() {
    const found = []; const walk = async (directory, depth) => {
      let entries; try { entries = await fs.readdir(directory, { withFileTypes: true }); } catch { return; }
      if (entries.some((entry) => entry.name === ".git")) { found.push(await this.describe(directory)); return; }
      if (depth >= this.maxDepth) return;
      await Promise.all(entries.filter((entry) => entry.isDirectory() && !SKIP.has(entry.name) && !entry.name.startsWith(".")).map((entry) => walk(path.join(directory, entry.name), depth + 1)));
    };
    await walk(this.root, 0); this.write(found); return this.list();
  }

  async describe(projectPath) {
    let branch = "detached";
    try { ({ stdout: branch } = await execFileAsync("git", ["branch", "--show-current"], { cwd: projectPath })); branch = branch.trim() || "detached"; } catch { /* ignored */ }
    const previous = this.read().find((project) => project.path === projectPath);
    return { name: path.basename(projectPath), path: projectPath, branch, lastOpenedAt: previous?.lastOpenedAt || 0 };
  }

  list() { return this.read().sort((a, b) => (b.lastOpenedAt - a.lastOpenedAt) || a.name.localeCompare(b.name)); }
  touch(projectPath) { const projects = this.read(); const project = projects.find((entry) => entry.path === projectPath); if (project) { project.lastOpenedAt = Date.now(); this.write(projects); } }
}

module.exports = { ProjectIndex, SKIP };
