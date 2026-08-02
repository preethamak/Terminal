const { execFile } = require("node:child_process");
const { promisify } = require("node:util");

const execFileAsync = promisify(execFile);
const MAX_DIFF_BYTES = 2 * 1024 * 1024;

async function git(cwd, args, maxBuffer = MAX_DIFF_BYTES) {
  return execFileAsync("git", args, { cwd, maxBuffer });
}

async function diffForTask(task) {
  if (!task) throw new Error("Task not found.");
  const base = task.baseRef ? [task.baseRef, "--"] : ["--"];
  const [{ stdout: diff }, { stdout: stat }, { stdout: names }] = await Promise.all([
    git(task.cwd, ["diff", "--no-ext-diff", "--no-textconv", ...base]),
    git(task.cwd, ["diff", "--stat", ...base], 256 * 1024),
    git(task.cwd, ["diff", "--name-status", ...base], 256 * 1024),
  ]);
  if (Buffer.byteLength(diff) > MAX_DIFF_BYTES) throw new Error("Diff exceeds the mobile review limit. Open the terminal to inspect it.");
  return { stat, diff, files: names.trim().split("\n").filter(Boolean).map((line) => { const [status, file] = line.split("\t"); return { status, file }; }) };
}

module.exports = { MAX_DIFF_BYTES, diffForTask };
