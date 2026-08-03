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

test("a relay pairing challenge is short-lived, secret, and creates a per-device relay key", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-device-store-relay-"));
  const store = new DeviceStore(root); const code = store.createChallenge(); const pairingKey = store.pairingKey(code);
  assert.equal(Buffer.from(pairingKey, "base64url").length, 32);
  const device = store.pair(code, "Relay phone");
  assert.equal(store.pairingKey(code), null);
  assert.equal(store.findRelayKey(device.id), device.relayKey);
  store.revoke(device.id);
  assert.equal(store.findRelayKey(device.id), null);
  fs.rmSync(root, { recursive: true, force: true });
});

test("a paired device can store and remove its Android push token", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-device-push-")); const store = new DeviceStore(root); const device = store.pair(store.createChallenge(), "Push phone"); const pushToken = "token-with-enough-characters-for-fcm";
  assert.equal(store.setPushToken(device.id, pushToken).pushToken, pushToken); assert.throws(() => store.setPushToken("missing", pushToken), /not found/);
  store.removePushTokens([pushToken]); assert.equal(store.read()[0].pushToken, undefined); fs.rmSync(root, { recursive:true, force:true });
});
