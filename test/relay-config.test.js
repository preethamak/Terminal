const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { RelayConfig } = require("../agent/relay-config");

test("relay identity persists while allowing deployment URL to be added later", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-relay-config-"));
  const config = new RelayConfig(root); const initial = config.ensure(); const deployed = config.ensure("wss://relay.example/v1/connect");
  assert.equal(initial.machineId, deployed.machineId); assert.equal(initial.relayKey, deployed.relayKey); assert.equal(deployed.relayUrl, "wss://relay.example/v1/connect");
  fs.rmSync(root, { recursive: true, force: true });
});
