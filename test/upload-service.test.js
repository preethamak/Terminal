const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { UploadService, validName, decode } = require("../agent/upload-service");

test("upload service writes only a new allowed file below the resolved workspace", async () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-upload-")); const nested = path.join(root, "notes"); fs.mkdirSync(nested);
  const files = { resolve:async () => ({ root, fullPath:nested, relative:"notes" }) }; const service = new UploadService({ files });
  const result = await service.upload({ projectPath:root, relativePath:"notes", name:"error.png", content:Buffer.from("image bytes").toString("base64") });
  assert.equal(result.size, 11); assert.equal(fs.readFileSync(path.join(nested, "error.png"), "utf8"), "image bytes"); await assert.rejects(service.upload({ projectPath:root, name:"error.png", content:"YQ==" }), /already exists/);
  fs.rmSync(root, { recursive:true, force:true });
});

test("upload validation rejects traversal, unsupported extensions, and malformed base64", () => {
  assert.equal(validName("../escape.js"), false); assert.equal(validName("payload.exe"), false); assert.throws(() => decode("not base64 !"), /base64/);
});
