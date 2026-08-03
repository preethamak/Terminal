const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { readBattery } = require("../agent/power-service");

test("power service returns laptop battery percentage and charge state", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-power-")); const battery = path.join(root, "BAT0"); fs.mkdirSync(battery);
  fs.writeFileSync(path.join(battery, "type"), "Battery\n"); fs.writeFileSync(path.join(battery, "capacity"), "82\n"); fs.writeFileSync(path.join(battery, "status"), "Charging\n");
  assert.deepEqual(readBattery(root), { percentage:82, status:"Charging" }); fs.rmSync(root, { recursive:true, force:true });
});

test("power service returns null when the machine has no battery", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-power-none-")); fs.mkdirSync(path.join(root, "AC")); fs.writeFileSync(path.join(root, "AC", "type"), "Mains\n");
  assert.equal(readBattery(root), null); fs.rmSync(root, { recursive:true, force:true });
});
