import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { resolveStandaloneServer } from "./standalone-entry.mjs";

test("resolves the packaged Hostinger server before the raw Next standalone server", async () => {
  const root = await mkdtemp(join(tmpdir(), "reviewroom-standalone-"));
  try {
    const hostinger = join(root, ".next-audit", "hostinger", "server.js");
    const standalone = join(root, ".next-audit", "standalone", "apps", "web", "server.js");
    await mkdir(join(root, ".next-audit", "hostinger"), { recursive: true });
    await mkdir(join(root, ".next-audit", "standalone", "apps", "web"), { recursive: true });
    await writeFile(standalone, "");
    await writeFile(hostinger, "");

    assert.equal(resolveStandaloneServer(root, ".next-audit"), hostinger);
    await rm(hostinger);
    assert.equal(resolveStandaloneServer(root, ".next-audit"), standalone);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("returns no entry when the configured build output is missing", () => {
  assert.equal(resolveStandaloneServer("C:/missing-reviewroom-build", ".next"), null);
});
