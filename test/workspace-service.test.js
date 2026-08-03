const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { WorkspaceIndex } = require("../agent/workspace-index");
const { WorkspaceService } = require("../agent/workspace-service");

test("workspace service creates a plain folder only below an approved root", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-workspace-service-")); const root = path.join(home, "Projects"); fs.mkdirSync(root);
  const index = new WorkspaceIndex({ home, file:path.join(home, ".vertex", "workspaces.json") }); await index.ensureRoots(); const service = new WorkspaceService({ index });
  const created = await service.create({ root, name:"new app" }); assert.equal(created.name, "new app"); assert.equal(fs.statSync(created.path).isDirectory(), true);
  await assert.rejects(service.create({ root, name:"../escape" }), /Folder names/);
  await assert.rejects(service.create({ root:home, name:"wrong-root" }), /approved workspace root/);
  fs.rmSync(home, { recursive:true, force:true });
});

test("workspace service optionally initialises Git in the newly created folder", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-workspace-git-")); const root = path.join(home, "Projects"); fs.mkdirSync(root);
  const index = new WorkspaceIndex({ home, file:path.join(home, ".vertex", "workspaces.json") }); await index.ensureRoots(); const service = new WorkspaceService({ index });
  const created = await service.create({ root, name:"git-app", initialiseGit:true }); assert.equal(created.kind, "git"); assert.equal(fs.statSync(path.join(created.path, ".git")).isDirectory(), true);
  fs.rmSync(home, { recursive:true, force:true });
});
