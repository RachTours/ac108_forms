import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./db/client.js";
import { env } from "./env.js";

const server = app.listen(env.API_PORT, env.HOST, () => {
  process.stdout.write(`ReviewRoom API listening on ${env.HOST}:${env.API_PORT}\n`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  process.stdout.write(`Received ${signal}; shutting down gracefully.\n`);
  server.close(async (error) => {
    if (error) process.exitCode = 1;
    await prisma.$disconnect();
    process.exit();
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
