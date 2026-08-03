const fs = require("node:fs/promises");
const path = require("node:path");

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;
const ALLOWED_EXTENSIONS = new Set([".txt", ".md", ".json", ".js", ".jsx", ".ts", ".tsx", ".py", ".java", ".go", ".rs", ".c", ".h", ".cpp", ".css", ".html", ".xml", ".yaml", ".yml", ".toml", ".sql", ".sh", ".png", ".jpg", ".jpeg", ".webp", ".gif", ".svg", ".pdf"]);

function validName(name) {
  return typeof name === "string" && name.length >= 1 && name.length <= 120 && !name.startsWith(".") && !name.includes("/") && !name.includes("\\") && ALLOWED_EXTENSIONS.has(path.extname(name).toLowerCase());
}

function decode(content) {
  if (typeof content !== "string" || !/^[A-Za-z0-9+/]*={0,2}$/.test(content) || content.length % 4 === 1) throw new Error("Upload content must be base64.");
  const result = Buffer.from(content, "base64"); if (!result.length || result.length > MAX_UPLOAD_BYTES) throw new Error("Uploads must be between 1 byte and 5 MiB."); return result;
}

class UploadService {
  constructor({ files }) { this.files = files; }
  async upload({ projectPath, relativePath = "", name, content }) {
    if (!validName(name)) throw new Error("Use a supported file name (text, code, image, or PDF) without folders.");
    const bytes = decode(content); const location = await this.files.resolve(projectPath, relativePath);
    const directory = await fs.stat(location.fullPath); if (!directory.isDirectory()) throw new Error("Choose a folder inside the workspace.");
    const target = path.resolve(location.fullPath, name);
    if (!target.startsWith(`${location.root}${path.sep}`)) throw new Error("Uploads must stay inside the selected workspace.");
    try { await fs.writeFile(target, bytes, { flag:"wx", mode:0o600 }); } catch (error) { if (error.code === "EEXIST") throw new Error("A file with that name already exists. Rename it before uploading."); throw error; }
    return { projectPath, relativePath:location.relative, name, size:bytes.length };
  }
}

module.exports = { UploadService, MAX_UPLOAD_BYTES, ALLOWED_EXTENSIONS, validName, decode };
