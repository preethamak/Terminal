const test = require("node:test");
const assert = require("node:assert/strict");
const { safeSend } = require("../relay/dev-server");

test("local relay safe-send behavior does not dereference an absent peer", () => {
  assert.doesNotThrow(() => safeSend(null, { type:"frame" }));
  let sent = false;
  safeSend({ OPEN:1, readyState:1, send:() => { sent = true; } }, { type:"frame" });
  assert.equal(sent, true);
});
