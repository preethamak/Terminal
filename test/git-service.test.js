const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { GitService } = require("../agent/git-service");

test("git service reports changes only for an approved project", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-git-")); const calls = []; const exec = async (_command, args) => { calls.push(args); if (args[0] === "branch") return { stdout:"main\n" }; if (args[0] === "status") return { stdout:"?? new.js\n" }; return { stdout:"" }; };
  const service = new GitService({ projects:{ list:() => [{ path:root }] }, exec }); const status = await service.status({ projectPath:root });
  assert.equal(status.totalChanges, 1); assert.equal(status.changes[0].file, "new.js"); assert.equal(typeof status.stat, "string");
  assert.equal(calls.every((args) => ["branch", "status", "diff"].includes(args[0])), true);
  await assert.rejects(service.status({ projectPath:"/tmp/not-vertex" }), /not available/);
  fs.rmSync(root, { recursive:true, force:true });
});
