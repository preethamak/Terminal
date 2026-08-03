const { spawn } = require("node:child_process");

class TravelService {
  constructor({ spawnProcess = spawn, command = "systemd-inhibit" } = {}) {
    this.spawnProcess = spawnProcess;
    this.command = command;
    this.child = null;
    this.startedAt = null;
    this.lastStoppedAt = null;
    this.lastError = null;
  }

  status() {
    return {
      active: Boolean(this.child && this.child.exitCode === null && !this.child.killed),
      startedAt: this.startedAt,
      lastStoppedAt: this.lastStoppedAt,
      lastError: this.lastError,
    };
  }

  enable() {
    if (this.status().active) return this.status();
    this.lastError = null;
    try {
      const child = this.spawnProcess(this.command, ["--what=sleep", "--mode=block", "--why=Vertex Travel Mode", "sleep", "infinity"], { stdio:"ignore" });
      this.child = child;
      this.startedAt = Date.now();
      child.once?.("error", (error) => { this.lastError = error.message; this.child = null; this.lastStoppedAt = Date.now(); });
      child.once?.("exit", () => { if (this.child === child) this.child = null; this.lastStoppedAt = Date.now(); });
    } catch (error) {
      this.lastError = error.message;
      this.lastStoppedAt = Date.now();
    }
    return this.status();
  }

  disable() {
    const child = this.child;
    this.child = null;
    this.lastStoppedAt = Date.now();
    if (child && child.exitCode === null && !child.killed) child.kill("SIGTERM");
    return this.status();
  }
}

module.exports = { TravelService };
