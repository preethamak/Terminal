const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { DeviceStore } = require("../agent/device-store");

test("a QR challenge creates a revocable device token", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-device-store-"));
  const store = new DeviceStore(root);
  const device = store.pair(store.createChallenge(), "Test phone");
  assert.equal(store.findByToken(device.token).name, "Test phone");
  store.revoke(device.id);
  assert.equal(store.findByToken(device.token), undefined);
  fs.rmSync(root, { recursive: true, force: true });
});
