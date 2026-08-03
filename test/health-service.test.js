const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { HealthService, disk } = require("../agent/health-service");

test("health service records bounded starts and relay history locally", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-health-")); let now = 1000;
  const service = new HealthService({ root, diskRoot:root, now:() => now, version:"test" }); now = 4000; service.relayConnected(); now = 6000; service.relayDisconnected();
  const status = service.status(); assert.equal(status.version, "test"); assert.equal(status.uptimeSeconds, 5); assert.equal(status.relay.reconnects, 1); assert.equal(status.relay.lastConnectedAt, 4000); assert.equal(status.relay.lastDisconnectedAt, 6000); assert.equal(status.recentStarts[0], 1000); assert.ok(status.disk?.totalBytes > 0);
  fs.rmSync(root, { recursive:true, force:true });
});

test("disk returns null for an unavailable filesystem", () => assert.equal(disk("/definitely/not/a/vertex/path"), null));
