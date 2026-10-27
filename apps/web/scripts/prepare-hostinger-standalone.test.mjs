import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const prepareScript = fileURLToPath(new URL("./prepare-hostinger-standalone.mjs", import.meta.url));

for (const distDir of [".next", ".next-release-check"]) {
  test(`Hostinger package serves static assets from its configured ${distDir} directory`, async () => {
    const root = await mkdtemp(resolve(tmpdir(), "reviewroom-package-test-"));
    try {
      const appRoot = resolve(root, "apps/web");
      const output = resolve(appRoot, distDir);
      const standalone = resolve(output, "standalone");
      const files = {
        "apps/web/server.js": "// synthetic standalone entry",
        [`apps/web/${distDir}/BUILD_ID`]: "synthetic-build",
        "node_modules/react/package.json": '{"name":"react"}',
        "node_modules/react-dom/package.json": '{"name":"react-dom"}',
        "packages/contracts/package.json": '{"name":"@reviewroom/contracts"}',
      };
      for (const [file, contents] of Object.entries(files)) {
        const path = resolve(standalone, file);
        await mkdir(dirname(path), { recursive: true });
        await writeFile(path, contents);
      }
      await mkdir(resolve(output, "static/chunks"), { recursive: true });
      await writeFile(resolve(output, "static/chunks/app.js"), "console.log('synthetic asset');");
      const result = spawnSync(process.execPath, [prepareScript], { cwd: appRoot, env: { ...process.env, NEXT_DIST_DIR: distDir }, encoding: "utf8" });
      assert.equal(result.status, 0, result.stderr);
      const packageRoot = resolve(output, "hostinger");
      assert.equal(await readFile(resolve(packageRoot, distDir, "static/chunks/app.js"), "utf8"), "console.log('synthetic asset');");
      assert.equal(await readFile(resolve(packageRoot, distDir, "BUILD_ID"), "utf8"), "synthetic-build");
    } finally {
      assert.equal(dirname(root), resolve(tmpdir()), "Cleanup must stay inside the test temporary directory.");
      assert.ok(root.startsWith(resolve(tmpdir(), "reviewroom-package-test-")));
      await rm(root, { recursive: true, force: true });
    }
  });
}
