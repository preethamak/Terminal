const test = require("node:test");
const assert = require("node:assert/strict");
const { SESSION_NAME } = require("../agent/session-manager");

test("session names allow concise terminal-safe names", () => {
  for (const value of ["vertex", "codex-1", "project_alpha", "logs.2026"]) assert.equal(SESSION_NAME.test(value), true);
});

test("session names reject shell-sensitive input", () => {
  for (const value of ["", "two words", "../escape", "name;rm", "a".repeat(64)]) assert.equal(SESSION_NAME.test(value), false);
});
