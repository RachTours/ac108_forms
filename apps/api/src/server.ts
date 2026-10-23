import "dotenv/config";
import { app } from "./app.js";
import { prisma } from "./db/client.js";
import { env } from "./env.js";
import { markDraining } from "./http/service-state.js";

const server = app.listen(env.API_PORT, env.HOST, () => {
  process.stdout.write(`ReviewRoom API listening on ${env.HOST}:${env.API_PORT}\n`);
});

let shuttingDown = false;
async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;
  markDraining();
  process.stdout.write(`Received ${signal}; shutting down gracefully.\n`);
  let shutdownTimer: NodeJS.Timeout | undefined;
  server.close(async (error) => {
    if (error) process.exitCode = 1;
    try {
      await prisma.$disconnect();
    } catch {
      process.exitCode = 1;
    }
    if (shutdownTimer) clearTimeout(shutdownTimer);
  });
  server.closeIdleConnections();
  shutdownTimer = setTimeout(() => {
    process.stderr.write("Graceful shutdown timed out after 10 seconds.\n");
    process.exit(1);
  }, 10_000);
  shutdownTimer.unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
