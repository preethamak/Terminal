const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { FileService } = require("../agent/file-service");

test("file service lists and previews only files in an approved project", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-files-")); const app = path.join(root, "app"); fs.mkdirSync(path.join(app, "src"), { recursive:true }); fs.writeFileSync(path.join(app, "src", "main.js"), "export const ok = true;\n"); fs.writeFileSync(path.join(app, ".env"), "secret");
  const service = new FileService({ projects:{ list:() => [{ path:app }] } });
  const listing = await service.list({ projectPath:app }); assert.deepEqual(listing.files.map((file) => file.name), ["src"]);
  assert.match((await service.preview({ projectPath:app, relativePath:"src/main.js" })).content, /ok/);
  await assert.rejects(service.list({ projectPath:app, relativePath:"../" }), /outside this project/);
  fs.rmSync(root, { recursive:true, force:true });
});

test("file service permits a normal approved workspace without requiring Git", async () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-files-workspace-")); const folder = path.join(home, "scratch");
  fs.mkdirSync(folder); fs.writeFileSync(path.join(folder, "notes.txt"), "plain workspace");
  const service = new FileService({ projects:{ list:() => [] }, workspaces:async () => [{ path:folder, kind:"folder" }] });
  const listing = await service.list({ projectPath:folder });
  assert.equal(listing.files[0].name, "notes.txt");
  const preview = await service.preview({ projectPath:folder, relativePath:"notes.txt" });
  assert.equal(preview.content, "plain workspace");
  fs.rmSync(home, { recursive:true, force:true });
});
