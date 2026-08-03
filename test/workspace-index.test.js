const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { WorkspaceIndex } = require("../agent/workspace-index");

test("workspace index includes ordinary folders, Git folders, and active session directories", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-workspaces-")); const projects = path.join(home, "Projects"); const plain = path.join(projects, "scratch"); const git = path.join(projects, "app"); const active = path.join(home, "active-work");
  fs.mkdirSync(path.join(git, ".git"), { recursive:true }); fs.mkdirSync(plain, { recursive:true }); fs.mkdirSync(active, { recursive:true });
  const index = new WorkspaceIndex({ home, file:path.join(home, ".vertex", "workspaces.json") });
  const workspaces = await index.list({ sessions:[{ cwd:active }], projects:[] });
  assert.deepEqual(workspaces.map((item) => item.name), ["active-work", "app", "scratch"]);
  assert.equal(workspaces.find((item) => item.name === "app").kind, "git"); assert.equal(workspaces.find((item) => item.name === "scratch").kind, "folder");
  fs.rmSync(home, { recursive:true, force:true });
});
