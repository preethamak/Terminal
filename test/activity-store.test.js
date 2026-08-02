const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { ActivityStore } = require("../agent/activity-store");

test("activity store deduplicates notifications and marks them read", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "vertex-activity-")); const store = new ActivityStore(root);
  const created = store.add({ type:"attention", title:"Input needed", fingerprint:"task:1" });
  assert.equal(store.add({ type:"attention", title:"Input needed", fingerprint:"task:1" }), null);
  assert.equal(store.list().length, 1); assert.equal(store.markRead(created.id)[0].readAt > 0, true);
  fs.rmSync(root, { recursive:true, force:true });
});
