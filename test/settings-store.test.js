const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { SettingsStore } = require("../agent/settings-store");

test("sleep-prevention defaults on and persists an explicit user choice", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-settings-")); const store = new SettingsStore(root);
  assert.equal(store.read().preventSleep, true); assert.equal(store.update({ preventSleep:false }).preventSleep, false); assert.equal(new SettingsStore(root).read().preventSleep, false);
  assert.throws(() => store.update({ preventSleep:"yes" }), /true or false/); fs.rmSync(root, { recursive:true, force:true });
});
