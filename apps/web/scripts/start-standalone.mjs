import { spawn } from "node:child_process";
import { resolve } from "node:path";
import { resolveStandaloneServer } from "./standalone-entry.mjs";

const appRoot = process.cwd();
const distDir = process.env.NEXT_DIST_DIR?.trim() || ".next";
const entry = resolveStandaloneServer(appRoot, distDir);

if (!entry) {
  throw new Error(`No standalone Next.js server found in ${resolve(appRoot, distDir)}. Run the production build first.`);
}

const child = spawn(process.execPath, [entry], { cwd: appRoot, env: process.env, stdio: "inherit" });
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
child.on("error", (error) => {
  process.stderr.write(`Could not start the standalone Next.js server: ${error.message}\n`);
  process.exitCode = 1;
});
child.on("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});
