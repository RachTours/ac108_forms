import { cp, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const appRoot = process.cwd();
const nextOutputDir = process.env.NEXT_DIST_DIR?.trim() || ".next";
const nextOutputRoot = resolve(appRoot, nextOutputDir);
const standaloneRoot = resolve(nextOutputRoot, "standalone");
const standaloneAppRoot = resolve(standaloneRoot, "apps/web");
const standaloneServer = resolve(standaloneAppRoot, "server.js");
const hostingerRoot = resolve(nextOutputRoot, "hostinger");
const reactPackage = resolve(standaloneRoot, "node_modules/react/package.json");
const reactDomPackage = resolve(standaloneRoot, "node_modules/react-dom/package.json");

if (!existsSync(standaloneServer)) {
  throw new Error(`Next.js standalone server was not generated at ${standaloneServer}`);
}

if (!existsSync(reactPackage)) {
  throw new Error(`React was not included in the standalone runtime at ${reactPackage}`);
}
if (!existsSync(reactDomPackage)) {
  throw new Error(`React DOM was not included in the standalone runtime at ${reactDomPackage}`);
}

const staticSource = resolve(nextOutputRoot, "static");
const staticDestination = resolve(standaloneAppRoot, nextOutputDir, "static");
await mkdir(resolve(standaloneAppRoot, nextOutputDir), { recursive: true });
await cp(staticSource, staticDestination, { recursive: true, force: true });

const publicSource = resolve(appRoot, "public");
if (existsSync(publicSource)) {
  await cp(publicSource, resolve(standaloneAppRoot, "public"), { recursive: true, force: true });
}

await mkdir(hostingerRoot, { recursive: true });
await cp(standaloneAppRoot, hostingerRoot, { recursive: true, force: true });
await cp(resolve(standaloneRoot, "node_modules"), resolve(hostingerRoot, "node_modules"), { recursive: true, force: true });
await cp(resolve(standaloneRoot, "packages"), resolve(hostingerRoot, "packages"), { recursive: true, force: true });

if (!existsSync(resolve(hostingerRoot, "server.js")) || !existsSync(resolve(hostingerRoot, "node_modules/react/package.json"))) {
  throw new Error("The Hostinger Node.js package is missing its server entry or React runtime dependency.");
}

process.stdout.write(`Prepared self-contained Hostinger Node.js package at ${nextOutputDir}/hostinger.\n`);
