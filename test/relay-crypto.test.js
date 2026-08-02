const test = require("node:test");
const assert = require("node:assert/strict");
const { decrypt, encrypt, newKey } = require("../agent/relay-crypto");

test("encrypted relay frames round-trip without retaining terminal plaintext", () => {
  const key = newKey();
  const frame = encrypt(key, { type: "input", data: "codex fix the flaky test" });
  assert.equal(JSON.stringify(frame).includes("flaky test"), false);
  assert.deepEqual(decrypt(key, frame), { type: "input", data: "codex fix the flaky test" });
});

test("encrypted relay frames reject a modified authentication tag", () => {
  const key = newKey(); const frame = encrypt(key, { type: "output", data: "private terminal text" });
  frame.t = `${frame.t.slice(0, -1)}A`;
  assert.throws(() => decrypt(key, frame));
});
