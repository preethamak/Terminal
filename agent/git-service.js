const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);

class GitService {
  constructor({ projects, exec = execFileAsync }) { this.projects = projects; this.exec = exec; }

  project(projectPath) {
    const project = this.projects.list().find((entry) => entry.path === projectPath);
    if (!project) throw new Error("That project is not available to Vertex.");
    return project.path;
  }

  async status({ projectPath }) {
    const cwd = this.project(projectPath);
    let branch; try { ({ stdout:branch } = await this.exec("git", ["branch", "--show-current"], { cwd })); branch = branch.trim() || "detached"; } catch { throw new Error("This workspace is not a Git repository."); }
    const [{ stdout:porcelain }, { stdout:stat }] = await Promise.all([
      this.exec("git", ["status", "--porcelain=v1", "--untracked-files=all"], { cwd, maxBuffer:512 * 1024 }),
      this.exec("git", ["diff", "--stat"], { cwd, maxBuffer:512 * 1024 }),
    ]);
    const changes = porcelain.trim().split("\n").filter(Boolean).slice(0, 100).map((line) => ({ status:line.slice(0, 2).trim() || "?", file:line.slice(3).replace(/^.* -> /, "") }));
    return { projectPath, branch, changes, totalChanges:porcelain.trim() ? porcelain.trim().split("\n").length : 0, stat:stat.trim() || "Working tree is clean." };
  }
}

module.exports = { GitService };
