import dotenv from "dotenv";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

dotenv.config({ path: resolve(fileURLToPath(new URL(".", import.meta.url)), "../.env") });

const normalize = (value) => value?.trim().toLowerCase();

function connectionParts(env) {
  if (env.DB_HOST || env.DB_NAME) {
    return { host: env.DB_HOST, database: env.DB_NAME };
  }
  if (!env.DATABASE_URL) return { host: undefined, database: undefined };

  try {
    const url = new URL(env.DATABASE_URL);
    return { host: url.hostname, database: decodeURIComponent(url.pathname.slice(1)) };
  } catch {
    throw new Error("Unable to verify database target: configured connection URL is invalid.");
  }
}

export function assertDatabaseIsNotProduction(env) {
  const productionHost = normalize(env.PRODUCTION_DB_HOST);
  const productionName = normalize(env.PRODUCTION_DB_NAME);
  if (Boolean(productionHost) !== Boolean(productionName)) {
    throw new Error("Configure both PRODUCTION_DB_HOST and PRODUCTION_DB_NAME together before database operations.");
  }
  if (!productionHost) return;

  const target = connectionParts(env);
  if (!target.host || !target.database) {
    throw new Error("Unable to verify database target: configure DB_HOST/DB_NAME or DATABASE_URL.");
  }

  if (normalize(target.host) === productionHost && normalize(target.database) === productionName) {
    throw new Error("Refusing database operation: configured target matches the protected production database.");
  }
}

const databaseMutation = process.env.npm_lifecycle_event?.startsWith("db:")
  || process.argv.some((argument) => argument === "migrate"
    || argument.startsWith("migrate:")
    || /(?:^|[-_:])(seed|cleanup|bootstrap-owner)(?:$|[-_:])/.test(argument));

if (databaseMutation) assertDatabaseIsNotProduction(process.env);
