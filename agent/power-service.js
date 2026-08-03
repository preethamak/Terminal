const fs = require("node:fs");
const path = require("node:path");

function readFile(file) { try { return fs.readFileSync(file, "utf8").trim(); } catch { return null; } }

function readBattery(root = "/sys/class/power_supply") {
  let entries; try { entries = fs.readdirSync(root); } catch { return null; }
  for (const name of entries) {
    const directory = path.join(root, name);
    if (readFile(path.join(directory, "type")) !== "Battery") continue;
    const percentage = Number(readFile(path.join(directory, "capacity")));
    const status = readFile(path.join(directory, "status"));
    if (!Number.isFinite(percentage) && !status) continue;
    return { percentage:Number.isFinite(percentage) ? Math.max(0, Math.min(100, Math.round(percentage))) : null, status:status || "Unknown" };
  }
  return null;
}

module.exports = { readBattery };
