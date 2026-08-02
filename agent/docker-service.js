const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const CONTAINER = /^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,127}$/;
const MAX_LOG_BYTES = 96 * 1024;

class DockerService {
  constructor({ exec = execFileAsync } = {}) { this.exec = exec; }

  async list() {
    try { await this.exec("docker", ["version", "--format", "{{.Server.Version}}"]) } catch { return { available:false, containers:[] }; }
    const { stdout } = await this.exec("docker", ["ps", "-a", "--format", "{{json .}}"], { maxBuffer:512 * 1024 });
    const containers = stdout.trim().split("\n").filter(Boolean).slice(0, 100).flatMap((line) => { try { const item = JSON.parse(line); return [{ id:item.ID, name:item.Names, image:item.Image, status:item.Status, state:item.State || "unknown", ports:item.Ports || "" }]; } catch { return []; } });
    return { available:true, containers };
  }

  async logs({ container }) {
    if (!CONTAINER.test(container || "")) throw new Error("Invalid container.");
    const { stdout, stderr } = await this.exec("docker", ["logs", "--tail", "200", container], { maxBuffer:MAX_LOG_BYTES });
    return { container, content:`${stdout || ""}${stderr || ""}`.slice(-MAX_LOG_BYTES) };
  }
}

module.exports = { DockerService, CONTAINER, MAX_LOG_BYTES };
