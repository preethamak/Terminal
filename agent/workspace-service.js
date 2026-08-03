const fs = require("node:fs/promises");
const path = require("node:path");
const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const FOLDER_NAME = /^[A-Za-z0-9][A-Za-z0-9 ._-]{0,79}$/;

class WorkspaceService {
  constructor({ index }) { this.index = index; }
  async roots() { return this.index.ensureRoots(); }
  async addRoot(root) { return this.index.addRoot(root); }
  async resolveRoot(root) {
    const roots = await this.roots(); const canonical = await fs.realpath(root);
    if (!roots.includes(canonical)) throw new Error("Choose an approved workspace root."); return canonical;
  }
  async create({ root, name, initialiseGit = false }) {
    if (!FOLDER_NAME.test(name || "") || name.startsWith(".")) throw new Error("Folder names must be 1–80 letters, numbers, spaces, ., _, or -.");
    const canonicalRoot = await this.resolveRoot(root); const target = path.resolve(canonicalRoot, name);
    if (!target.startsWith(`${canonicalRoot}${path.sep}`)) throw new Error("Folder must stay inside the selected workspace root.");
    try { await fs.lstat(target); throw new Error("That folder already exists."); } catch (error) { if (error.code !== "ENOENT") throw error; }
    await fs.mkdir(target, { mode:0o700 }); const canonicalTarget = await fs.realpath(target);
    if (!canonicalTarget.startsWith(`${canonicalRoot}${path.sep}`)) throw new Error("Folder resolves outside the selected workspace root.");
    if (initialiseGit) await execFileAsync("git", ["init"], { cwd:canonicalTarget });
    this.index.touch(canonicalTarget); return { path:canonicalTarget, name:path.basename(canonicalTarget), kind:initialiseGit ? "git" : "folder", source:"created" };
  }
}

module.exports = { WorkspaceService, FOLDER_NAME };
