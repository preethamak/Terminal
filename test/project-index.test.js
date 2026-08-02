const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ProjectIndex } = require("../agent/project-index");

test("project index discovers git roots and skips dependency folders", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-projects-"));
  fs.mkdirSync(path.join(root, "app", ".git"), { recursive: true });
  fs.mkdirSync(path.join(root, "node_modules", "ignored", ".git"), { recursive: true });
  const index = new ProjectIndex({ root, file: path.join(root, "index.json") });
  const projects = await index.refresh();
  assert.equal(projects.length, 1); assert.equal(projects[0].name, "app");
  fs.rmSync(root, { recursive: true, force: true });
});
