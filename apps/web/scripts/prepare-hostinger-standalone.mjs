import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = process.cwd();
const standaloneRoot = resolve(appRoot, ".next/standalone");
const standaloneAppRoot = resolve(standaloneRoot, "apps/web");
const standaloneServer = resolve(standaloneAppRoot, "server.js");
const reactPackage = resolve(standaloneRoot, "node_modules/react/package.json");

if (!existsSync(standaloneServer)) {
  throw new Error(`Next.js standalone server was not generated at ${standaloneServer}`);
}

if (!existsSync(reactPackage)) {
  throw new Error(`React was not included in the standalone runtime at ${reactPackage}`);
}

const staticSource = resolve(appRoot, ".next/static");
const staticDestination = resolve(standaloneAppRoot, ".next/static");
await mkdir(resolve(standaloneAppRoot, ".next"), { recursive: true });
await cp(staticSource, staticDestination, { recursive: true, force: true });

const publicSource = resolve(appRoot, "public");
if (existsSync(publicSource)) {
  await cp(publicSource, resolve(standaloneAppRoot, "public"), { recursive: true, force: true });
}

process.stdout.write("Hostinger standalone runtime includes React and Next.js static assets.\n");
