const crypto = require("node:crypto");

function decodeKey(value) {
  const key = Buffer.from(String(value || ""), "base64url");
  if (key.length !== 32) throw new Error("Relay key must be a 32-byte base64url value.");
  return key;
}

function encrypt(keyValue, message) {
  const key = Buffer.isBuffer(keyValue) ? keyValue : decodeKey(keyValue);
  const nonce = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, nonce);
  const plaintext = Buffer.from(JSON.stringify(message));
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  return { n: nonce.toString("base64url"), c: ciphertext.toString("base64url"), t: cipher.getAuthTag().toString("base64url") };
}

function decrypt(keyValue, frame) {
  const key = Buffer.isBuffer(keyValue) ? keyValue : decodeKey(keyValue);
  if (!frame || typeof frame.n !== "string" || typeof frame.c !== "string" || typeof frame.t !== "string") throw new Error("Invalid encrypted relay frame.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, Buffer.from(frame.n, "base64url"));
  decipher.setAuthTag(Buffer.from(frame.t, "base64url"));
  const plaintext = Buffer.concat([decipher.update(Buffer.from(frame.c, "base64url")), decipher.final()]);
  return JSON.parse(plaintext.toString("utf8"));
}

function newKey() { return crypto.randomBytes(32).toString("base64url"); }

module.exports = { decrypt, decodeKey, encrypt, newKey };
