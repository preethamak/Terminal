const test = require("node:test");
const assert = require("node:assert/strict");
const { RelayClient } = require("../agent/relay-client");
const { decrypt, encrypt, newKey } = require("../agent/relay-crypto");

function relay({ pairingKey, deviceKey }) {
  return new RelayClient({
    relayUrl: "ws://relay.example/v1/connect",
    machineId: "00000000-0000-4000-8000-000000000000",
    pairingKey: (code) => code === "pair-code" ? pairingKey : null,
    devices: { findRelayKey: (id) => id === "device-1" ? deviceKey : null },
  });
}

test("relay client decrypts a pairing frame and returns an opaque paired response", () => {
  const pairingKey = newKey(); const client = relay({ pairingKey, deviceKey: newKey() }); let received;
  client.on("message", (event) => { received = event; });
  client.receive(JSON.stringify({ type:"frame", from:"phone-tab", keyId:"pair", pairCode:"pair-code", frame:encrypt(pairingKey, { type:"pair", code:"pair-code", name:"Test phone" }) }));
  assert.deepEqual(received.message, { type:"pair", code:"pair-code", name:"Test phone" });
  const sent = []; client.socket = { OPEN:1, readyState:1, send:(message) => sent.push(JSON.parse(message)) };
  assert.equal(client.send({ keyId:"pair", pairCode:"pair-code", message:{ type:"paired", key:"never plaintext at relay" } }), true);
  assert.equal(JSON.stringify(sent[0]).includes("never plaintext"), false);
  assert.deepEqual(decrypt(pairingKey, sent[0].frame), { type:"paired", key:"never plaintext at relay" });
});

test("relay client binds a paired device to its relay route", () => {
  const deviceKey = newKey(); const client = relay({ pairingKey:newKey(), deviceKey }); let received;
  client.on("message", (event) => { received = event; });
  client.receive(JSON.stringify({ type:"frame", from:"phone-tab", keyId:"device-1", frame:encrypt(deviceKey, { type:"listTasks", requestId:"req-1" }) }));
  assert.equal(received.keyId, "device-1");
  const sent = []; client.socket = { OPEN:1, readyState:1, send:(message) => sent.push(JSON.parse(message)) };
  client.send({ keyId:"device-1", message:{ type:"tasks", requestId:"req-1", tasks:[] } });
  assert.equal(sent[0].to, "phone-tab");
  assert.deepEqual(decrypt(deviceKey, sent[0].frame), { type:"tasks", requestId:"req-1", tasks:[] });
});
