const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_ENTRIES = 300;
const MAX_PREVIEW_BYTES = 256 * 1024;
const HIDDEN = new Set([".git", "node_modules", "dist", "build", "target"]);

class FileService {
  constructor({ projects, workspaces = async () => [] }) { this.projects = projects; this.workspaces = workspaces; }

  async project(projectPath) {
    const project = this.projects.list().find((entry) => entry.path === projectPath);
    if (project) return project.path;
    const workspace = (await this.workspaces()).find((entry) => entry.path === projectPath);
    if (!workspace) throw new Error("That workspace is not available to Vertex.");
    return workspace.path;
  }

  async resolve(projectPath, relativePath = "") {
    const root = await this.project(projectPath); const rootReal = await fs.realpath(root);
    const requested = path.resolve(rootReal, relativePath || ".");
    const resolved = await fs.realpath(requested);
    if (resolved !== rootReal && !resolved.startsWith(`${rootReal}${path.sep}`)) throw new Error("That location is outside this project.");
    return { root:rootReal, fullPath:resolved, relative:path.relative(rootReal, resolved) };
  }

  async list({ projectPath, relativePath = "" }) {
    const location = await this.resolve(projectPath, relativePath); const entries = await fs.readdir(location.fullPath, { withFileTypes:true });
    const files = [];
    for (const entry of entries) {
      if (entry.name.startsWith(".") || HIDDEN.has(entry.name)) continue;
      const fullPath = path.join(location.fullPath, entry.name); let stat;
      try { stat = await fs.stat(fullPath); } catch { continue; }
      if (!stat.isDirectory() && !stat.isFile()) continue;
      files.push({ name:entry.name, relativePath:path.join(location.relative, entry.name), kind:stat.isDirectory() ? "directory" : "file", size:stat.size, modifiedAt:stat.mtimeMs });
      if (files.length >= MAX_ENTRIES) break;
    }
    files.sort((a, b) => Number(b.kind === "directory") - Number(a.kind === "directory") || a.name.localeCompare(b.name));
    return { projectPath, relativePath:location.relative, files };
  }

  async preview({ projectPath, relativePath }) {
    const location = await this.resolve(projectPath, relativePath); const stat = await fs.stat(location.fullPath);
    if (!stat.isFile()) throw new Error("Choose a file to preview.");
    if (stat.size > MAX_PREVIEW_BYTES) throw new Error("This file is too large for a mobile preview. Open the terminal instead.");
    const content = await fs.readFile(location.fullPath);
    if (content.includes(0)) throw new Error("This is a binary file and cannot be previewed.");
    return { projectPath, relativePath:location.relative, name:path.basename(location.fullPath), size:stat.size, content:content.toString("utf8") };
  }
}

module.exports = { FileService, MAX_ENTRIES, MAX_PREVIEW_BYTES };
