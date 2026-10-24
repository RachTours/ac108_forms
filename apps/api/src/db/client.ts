import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../generated/prisma/client.js";
import { env, mysqlConnection, mysqlSsl } from "../env.js";

const adapter = new PrismaMariaDb({
  host: mysqlConnection.host,
  port: mysqlConnection.port,
  user: mysqlConnection.user,
  password: mysqlConnection.password,
  database: mysqlConnection.database,
  connectionLimit: env.DATABASE_CONNECTION_LIMIT,
  ssl: mysqlSsl,
});

export const prisma = new PrismaClient({ adapter });
