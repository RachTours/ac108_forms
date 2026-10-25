import { spawnSync } from "node:child_process";
import { isRecoverableReviewDraftMigrationFailure } from "./migration-recovery.mjs";

const bootstrapKeys = [
  "BOOTSTRAP_EMAIL",
  "BOOTSTRAP_NAME",
  "BOOTSTRAP_PASSWORD",
  "BOOTSTRAP_ORGANIZATION",
  "BOOTSTRAP_SLUG",
];
const bootstrapRequested = process.env.BOOTSTRAP_OWNER_ON_DEPLOY === "true";
const hasBootstrapValues = bootstrapKeys.some((key) => Boolean(process.env[key]));

if (hasBootstrapValues && !bootstrapRequested) {
  throw new Error("Remove BOOTSTRAP_* variables or set BOOTSTRAP_OWNER_ON_DEPLOY=true for the one-time owner setup.");
}

if (bootstrapRequested) {
  const missingKeys = bootstrapKeys.filter((key) => !process.env[key]);
  if (missingKeys.length > 0) {
    throw new Error(`BOOTSTRAP_OWNER_ON_DEPLOY=true requires: ${missingKeys.join(", ")}`);
  }
}

const npmCli = process.env.npm_execpath;
if (!npmCli) throw new Error("npm_execpath is unavailable; run this script through an npm script.");

function runNpm(args, { capture = false } = {}) {
  const result = spawnSync(process.execPath, [npmCli, ...args], {
    stdio: capture ? "pipe" : "inherit",
    encoding: capture ? "utf8" : undefined,
    env: process.env,
  });
  if (result.error) throw result.error;
  if (capture) {
    process.stdout.write(result.stdout ?? "");
    process.stderr.write(result.stderr ?? "");
    return { status: result.status ?? 1, output: `${result.stdout ?? ""}\n${result.stderr ?? ""}` };
  }
  if (result.status !== 0) process.exit(result.status ?? 1);
  return { status: 0, output: "" };
}

runNpm(["run", "db:generate"]);
runNpm(["run", "db:assignment-preflight", "--workspace", "@reviewroom/api"]);
const migrationResult = runNpm(["run", "db:migrate"], { capture: true });
if (migrationResult.status !== 0) {
  if (!isRecoverableReviewDraftMigrationFailure(migrationResult.output)) process.exit(migrationResult.status);
  process.stdout.write("Recovering the known partially applied ReviewDraft migration before retrying.\n");
  runNpm(["run", "db:migrate:resolve-review-drafts", "--workspace", "@reviewroom/api"]);
  runNpm(["run", "db:migrate"]);
}
runNpm(["run", "build", "--workspace", "@reviewroom/contracts"]);
runNpm(["run", "build", "--workspace", "@reviewroom/domain"]);

if (bootstrapRequested) {
  runNpm(["run", "db:bootstrap-owner", "--workspace", "@reviewroom/api"]);
  process.stdout.write("One-time owner bootstrap completed. Remove BOOTSTRAP_OWNER_ON_DEPLOY and all BOOTSTRAP_* variables now.\n");
}

runNpm(["run", "build", "--workspace", "@reviewroom/api"]);
