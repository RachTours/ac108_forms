import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";
import { buildDatabaseUrl } from "./src/db/mysql-config.ts";

dotenv.config({ path: resolve(fileURLToPath(new URL(".", import.meta.url)), "../../.env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: buildDatabaseUrl(process.env) || env("DATABASE_URL") },
});
