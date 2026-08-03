const LOCKED_MESSAGE = "Vertex is locked on the laptop. Run npm run unlock on the laptop to restore phone access.";

function assertPairedAccess({ paired, locked }) {
  if (paired && locked) throw new Error(LOCKED_MESSAGE);
}

function pairingAllowed(locked) {
  if (locked) throw new Error("Vertex is locked locally. Unlock it from the laptop before pairing or reconnecting a phone.");
}

module.exports = { LOCKED_MESSAGE, assertPairedAccess, pairingAllowed };
