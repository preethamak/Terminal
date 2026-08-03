const test = require("node:test");
const assert = require("node:assert/strict");
const { LOCKED_MESSAGE, assertPairedAccess, pairingAllowed } = require("../agent/access-control");

test("local lock denies paired device access but leaves laptop-local access available", () => {
  assert.throws(() => assertPairedAccess({ paired:true, locked:true }), new RegExp(LOCKED_MESSAGE));
  assert.doesNotThrow(() => assertPairedAccess({ paired:false, locked:true }));
  assert.doesNotThrow(() => assertPairedAccess({ paired:true, locked:false }));
});

test("local lock also blocks new pairing", () => {
  assert.throws(() => pairingAllowed(true), /locked locally/); assert.doesNotThrow(() => pairingAllowed(false));
});
