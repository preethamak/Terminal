const test = require("node:test");
const assert = require("node:assert/strict");
const { NotificationService } = require("../agent/notification-service");

test("notification service sends only short task metadata to the private push sender", async () => {
  let request; const devices = { read:() => [{ pushToken:"push-token-123456789012", revoked:false }], removePushTokens:() => {} };
  const service = new NotificationService({ devices, endpoint:"https://push.example/v1/push", key:"sender-key", appUrl:"https://vertex.example", fetcher:async (...args) => { request = args; return { ok:true, json:async () => ({ delivered:1 }) }; } });
  await service.send({ title:"AI task needs your input", detail:"secret terminal output", type:"attention", taskId:"task-1", session:"codex" });
  assert.equal(request[0], "https://push.example/v1/push"); const body = JSON.parse(request[1].body); assert.equal(body.title, "AI task needs your input"); assert.equal(body.taskId, "task-1"); assert.equal("detail" in body, false);
});
