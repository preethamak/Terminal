const test = require("node:test");
const assert = require("node:assert/strict");
const { DockerService } = require("../agent/docker-service");

test("docker service uses read-only allowlisted commands and bounds logs", async () => {
  const calls = []; const service = new DockerService({ exec:async (_command, args) => { calls.push(args); if (args[0] === "version") return { stdout:"27.0\n" }; if (args[0] === "ps") return { stdout:'{"ID":"abc123","Names":"api","Image":"node:22","Status":"Up 2 minutes","State":"running"}\n' }; return { stdout:"line\n", stderr:"" }; } });
  const status = await service.list(); assert.equal(status.available, true); assert.equal(status.containers[0].name, "api");
  assert.equal((await service.logs({ container:"api" })).content, "line\n"); assert.equal(calls.every((args) => ["version", "ps", "logs"].includes(args[0])), true);
  await assert.rejects(service.logs({ container:"api;rm" }), /Invalid container/);
});
