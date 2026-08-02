const test = require("node:test");
const assert = require("node:assert/strict");
const { outputSequencer, validateResize } = require("../agent/terminal-protocol");

test("terminal output sequence is ordered and monotonic", () => {
  const messages = [];
  const sequencer = outputSequencer((message) => messages.push(message));
  sequencer.next("one"); sequencer.next("two");
  assert.deepEqual(messages.map((message) => message.sequence), [1, 2]);
  assert.equal(sequencer.current(), 2);
});

test("terminal resize only permits useful integer dimensions", () => {
  assert.deepEqual(validateResize({ cols: 120, rows: 42 }), { cols: 120, rows: 42 });
  for (const value of [{ cols: 1, rows: 30 }, { cols: 120.5, rows: 30 }, { cols: 700, rows: 30 }, { cols: 120, rows: 0 }]) {
    assert.throws(() => validateResize(value));
  }
});
