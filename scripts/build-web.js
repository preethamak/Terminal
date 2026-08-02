const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const output = path.join(root, "dist");
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, "vendor"), { recursive: true });
for (const file of fs.readdirSync(path.join(root, "web"))) fs.copyFileSync(path.join(root, "web", file), path.join(output, file));
fs.copyFileSync(path.join(root, "node_modules", "@xterm", "xterm", "lib", "xterm.js"), path.join(output, "vendor", "xterm.js"));
fs.copyFileSync(path.join(root, "node_modules", "@xterm", "xterm", "css", "xterm.css"), path.join(output, "vendor", "xterm.css"));
fs.copyFileSync(path.join(root, "node_modules", "@xterm", "addon-fit", "lib", "addon-fit.js"), path.join(output, "vendor", "addon-fit.js"));
console.log("Built Vercel-ready Vertex web app in dist/");
