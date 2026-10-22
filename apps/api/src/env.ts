import dotenv from "dotenv";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { readMysqlConnection, resolveMysqlSsl } from "./db/mysql-config.js";

dotenv.config({ path: resolve(fileURLToPath(new URL(".", import.meta.url)), "../../../.env") });

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  HOST: z.preprocess((value) => typeof value === "string" && value.trim() ? value.trim() : undefined, z.string().default("0.0.0.0")),
  PORT: z.coerce.number().int().min(1).max(65535).optional(),
  API_PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_CONNECTION_LIMIT: z.coerce.number().int().min(1).max(100).default(10),
  DB_HOST: z.string().optional(),
  DB_PORT: z.string().optional(),
  DB_NAME: z.string().optional(),
  DB_USER: z.string().optional(),
  DB_PASSWORD: z.string().optional(),
  DB_SSL: z.enum(["true", "false"]).optional().transform((value) => value === undefined ? undefined : value === "true"),
  DATABASE_URL: z.string().optional(),
  SESSION_SECRET: z.string().min(32),
  TOKEN_ENCRYPTION_KEY: z.string().optional(),
  WEB_ORIGIN: z.string().url().refine((value) => new URL(value).origin === value, "WEB_ORIGIN must be an origin without a path"),
  TRUSTED_PROXIES: z.string().default(""),
});

const parsedEnv = envSchema.parse(process.env);
export const mysqlConnection = readMysqlConnection(parsedEnv);
export const mysqlSsl = resolveMysqlSsl(parsedEnv.DB_SSL, parsedEnv.NODE_ENV, mysqlConnection.host);
const configuredEncryptionKey = parsedEnv.TOKEN_ENCRYPTION_KEY ? Buffer.from(parsedEnv.TOKEN_ENCRYPTION_KEY, "base64url") : null;
if (parsedEnv.NODE_ENV === "production" && !configuredEncryptionKey) throw new Error("TOKEN_ENCRYPTION_KEY must be configured in production.");
const tokenEncryptionKey = configuredEncryptionKey ?? createHash("sha256").update(`reviewroom-invitation-key:${parsedEnv.SESSION_SECRET}`).digest();
if (tokenEncryptionKey.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes.");
export const env = { ...parsedEnv, API_PORT: parsedEnv.PORT ?? parsedEnv.API_PORT, TOKEN_ENCRYPTION_KEY: tokenEncryptionKey };
export const trustedProxies = env.TRUSTED_PROXIES.split(",").map((value) => value.trim()).filter(Boolean);

