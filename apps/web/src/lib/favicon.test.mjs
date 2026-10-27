import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

test("app favicon is a valid 32-pixel ICO containing a PNG image", async () => {
  const icon = await readFile(new URL("../../app/favicon.ico", import.meta.url));
  assert.equal(icon.readUInt16LE(0), 0, "ICO reserved field");
  assert.equal(icon.readUInt16LE(2), 1, "ICO resource type");
  assert.equal(icon.readUInt16LE(4), 1, "ICO image count");
  assert.equal(icon[6], 32, "icon width");
  assert.equal(icon[7], 32, "icon height");
  assert.equal(icon.readUInt16LE(10), 1, "icon color planes");
  assert.equal(icon.readUInt16LE(12), 32, "icon color depth");
  assert.deepEqual(icon.subarray(22, 30), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
});
