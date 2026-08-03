const test = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { TravelService } = require("../agent/travel-service");

test("travel mode starts exactly one sleep inhibitor and stops it", () => {
  let calls = 0; const child = new EventEmitter(); child.exitCode = null; child.killed = false; child.kill = (signal) => { child.killed = true; child.exitCode = 0; child.emit("exit"); assert.equal(signal, "SIGTERM"); };
  const service = new TravelService({ spawnProcess:(command, args) => { calls += 1; assert.equal(command, "systemd-inhibit"); assert.deepEqual(args, ["--what=sleep", "--mode=block", "--why=Vertex is keeping your laptop available", "sleep", "infinity"]); return child; } });
  assert.equal(service.enable().active, true); assert.equal(service.enable().active, true); assert.equal(calls, 1); assert.equal(service.disable().active, false);
});

test("travel mode reports an unavailable inhibitor honestly", () => {
  const service = new TravelService({ spawnProcess:() => { throw new Error("systemd-inhibit missing"); } });
  const status = service.enable(); assert.equal(status.active, false); assert.match(status.lastError, /missing/);
});
