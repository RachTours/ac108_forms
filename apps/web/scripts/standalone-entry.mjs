import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function resolveStandaloneServer(appRoot, distDir = ".next") {
  const candidates = [
    resolve(appRoot, distDir, "hostinger", "server.js"),
    resolve(appRoot, distDir, "standalone", "apps", "web", "server.js"),
  ];
  return candidates.find((candidate) => existsSync(candidate)) ?? null;
}
