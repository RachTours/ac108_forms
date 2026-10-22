import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../env.js";

const databaseUrl = new URL(env.DATABASE_URL);
const adapter = new PrismaMariaDb({
  host: databaseUrl.hostname,
  port: Number(databaseUrl.port || 3306),
  user: decodeURIComponent(databaseUrl.username),
  password: decodeURIComponent(databaseUrl.password),
  database: decodeURIComponent(databaseUrl.pathname.slice(1)),
  connectionLimit: env.DATABASE_CONNECTION_LIMIT,
  ssl: env.NODE_ENV === "production" ? { rejectUnauthorized: true } : false,
});

export const prisma = new PrismaClient({ adapter });
