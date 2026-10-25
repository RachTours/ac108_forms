import "dotenv/config";
import { randomUUID, createHash, randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";
import { PrismaMariaDb } from "@prisma/adapter-mariadb";
import { PrismaClient } from "../apps/api/dist/generated/prisma/client.js";
import { assertDatabaseIsNotProduction } from "./db-target-guard.mjs";

const localHosts = new Set(["127.0.0.1", "localhost", "::1"]);
const dbHost = process.env.DB_HOST?.trim() ?? "";
const dbName = process.env.DB_NAME?.trim() ?? "";
if (!localHosts.has(dbHost.toLowerCase())) throw new Error("Roadmap benchmark only runs against a loopback MySQL host.");
if (!/^reviewroom_qa_[a-z0-9_]+$/i.test(dbName)) throw new Error("Roadmap benchmark requires a specifically named local QA database.");
assertDatabaseIsNotProduction(process.env);
const connection = { host: dbHost, port: Number(process.env.DB_PORT ?? 3306), database: dbName, user: process.env.DB_USER, password: process.env.DB_PASSWORD, connectionLimit: 8, collation: "utf8mb4_unicode_ci" };
if (!connection.user || !connection.password || !Number.isInteger(connection.port)) throw new Error("Local MySQL credentials are incomplete.");
const prisma = new PrismaClient({ adapter: new PrismaMariaDb(connection) });
const apiOrigin = "http://127.0.0.1:4000";
const webOrigin = "http://127.0.0.1:5000";
const organizationId = randomUUID();
const suffix = organizationId.replaceAll("-", "");
const userIds = Array.from({ length: 51 }, () => randomUUID());
let seeded = false;

function hash(value) { return createHash("sha256").update(value).digest("hex"); }
function percentile(values, ratio) { return values[Math.min(values.length - 1, Math.ceil(values.length * ratio) - 1)] ?? 0; }

async function measure(name, url, headers, samples = 24, concurrency = 6) {
  const durations = [];
  const statuses = new Map();
  const failures = [];
  let next = 0;
  const started = performance.now();
  await Promise.all(Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = next++;
      if (index >= samples) return;
      const tick = performance.now();
      try {
        const response = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
        await response.arrayBuffer();
        durations.push(performance.now() - tick);
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
        if (response.status !== 200) failures.push(response.status);
      } catch (error) { durations.push(performance.now() - tick); failures.push(error instanceof Error ? error.name : "request error"); }
    }
  }));
  const elapsed = performance.now() - started;
  const sorted = [...durations].sort((a, b) => a - b);
  const statusSummary = [...statuses].sort(([a], [b]) => String(a).localeCompare(String(b))).map(([status, count]) => `${status}:${count}`).join(", ");
  console.log(`${name}: ${samples} requests, p50 ${percentile(sorted, .5).toFixed(1)} ms, p95 ${percentile(sorted, .95).toFixed(1)} ms, ${((samples * 1000) / elapsed).toFixed(1)} req/s, statuses ${statusSummary || "none"}`);
  if (failures.length) throw new Error(`${name} produced ${failures.length} non-200 responses.`);
}

try {
  const now = new Date();
  const reviewerIds = userIds.slice(1);
  const adminId = userIds[0];
  const membershipIds = Array.from({ length: 51 }, () => randomUUID());
  const targetIds = Array.from({ length: 1000 }, () => randomUUID());
  const assignmentIds = targetIds.map(() => randomUUID());
  const formId = randomUUID();
  const formVersionId = randomUUID();
  const sessionId = randomUUID();
  const sessionToken = randomBytes(32).toString("base64url");
  await prisma.$transaction(async (tx) => {
    await tx.organization.create({ data: { id: organizationId, name: `Local benchmark ${suffix.slice(0, 8)}`, slug: `bench-${suffix.slice(0, 32)}` } });
    const identityIds = [adminId, ...reviewerIds];
    await tx.user.createMany({ data: identityIds.map((id, index) => ({ id, email: `bench-${suffix}-${index}@example.invalid`, displayName: index === 0 ? "Benchmark Admin" : `Reviewer ${String(index).padStart(2, "0")}` })) });
    await tx.membership.createMany({ data: identityIds.map((userId, index) => ({ id: membershipIds[index], organizationId, userId, role: index === 0 ? "OWNER" : "REVIEWER", passwordHash: "benchmark-only-not-a-login-password" })) });
    await tx.reviewTarget.createMany({ data: targetIds.map((id, index) => ({ id, organizationId, displayName: `Synthetic Person ${String(index).padStart(4, "0")}`, email: `person-${suffix}-${index}@example.invalid` })) });
    await tx.assignment.createMany({ data: targetIds.map((targetId, index) => ({ id: assignmentIds[index], organizationId, targetId, reviewerId: membershipIds[1 + (index % 50)] })) });
    await tx.form.create({ data: { id: formId, organizationId, title: "Synthetic benchmark form", description: "Synthetic benchmark data", status: "PUBLISHED" } });
    await tx.formVersion.create({ data: { id: formVersionId, formId, version: 1, definition: { title: "Synthetic benchmark form", description: "Synthetic benchmark data", fields: [] }, publishedAt: now } });
    await tx.form.update({ where: { id: formId }, data: { currentPublishedId: formVersionId } });
    await tx.submission.createMany({ data: targetIds.flatMap((targetId, targetIndex) => Array.from({ length: 10 }, (_, submissionIndex) => {
      const id = randomUUID();
      return { id, organizationId, formId, formVersionId, targetId, reviewerId: membershipIds[1 + (targetIndex % 50)], idempotencyKey: id, payloadHash: hash(`${id}:synthetic`), answers: {}, reviewedAt: submissionIndex % 2 === 0 ? now : null, submittedAt: new Date(now.getTime() - ((targetIndex * 10 + submissionIndex) % 365) * 86_400_000) };
    })) });
    await tx.progressConfig.create({ data: { organizationId, submissionGoal: 10_000 } });
    await tx.session.create({ data: { id: sessionId, tokenHash: hash(sessionToken), userId: adminId, organizationId, membershipId: membershipIds[0], expiresAt: new Date(now.getTime() + 60 * 60 * 1000) } });
  }, { maxWait: 10_000, timeout: 120_000 });
  seeded = true;
  const sessionCookie = `reviewroom-admin-${sessionId}=${sessionToken}`;
  const apiHeaders = { Cookie: sessionCookie, "X-Reviewroom-Audience": "admin", "X-Reviewroom-Session-Id": sessionId };
  const pageHeaders = { ...apiHeaders, "x-reviewroom-request-path": "/admin/overview" };
  console.log("Synthetic local dataset: 50 reviewers, 1,000 people, 10,000 submissions.");
  await measure("Reviewer progress API", `${apiOrigin}/api/v1/progress/reviewer-board`, apiHeaders);
  await measure("People list API", `${apiOrigin}/api/v1/review-targets?limit=100`, apiHeaders);
  await measure("Assignment list API", `${apiOrigin}/api/v1/assignments?limit=100`, apiHeaders);
  await measure("Submission list API", `${apiOrigin}/api/v1/submissions?limit=100`, apiHeaders);
  await measure("Overview page", `${webOrigin}/admin/overview?rr_session=${sessionId}`, pageHeaders, 12, 2);
  await measure("People page", `${webOrigin}/admin/people?rr_session=${sessionId}`, { ...pageHeaders, "x-reviewroom-request-path": "/admin/people" }, 12, 2);
  await measure("Submissions page", `${webOrigin}/admin/submissions?rr_session=${sessionId}`, { ...pageHeaders, "x-reviewroom-request-path": "/admin/submissions" }, 12, 2);
  const metrics = process.memoryUsage();
  console.log(`Benchmark runner memory: RSS ${(metrics.rss / 1024 / 1024).toFixed(1)} MB, heap ${(metrics.heapUsed / 1024 / 1024).toFixed(1)} MB. Per-query counts are not exposed by the current API.`);
} finally {
  if (seeded) {
    await prisma.$transaction(async (tx) => {
      await tx.submission.deleteMany({ where: { organizationId } });
      await tx.assignment.deleteMany({ where: { organizationId } });
      await tx.reviewLink.deleteMany({ where: { organizationId } });
      await tx.session.deleteMany({ where: { organizationId } });
      await tx.progressConfig.deleteMany({ where: { organizationId } });
      await tx.organizationTheme.deleteMany({ where: { organizationId } });
      await tx.form.deleteMany({ where: { organizationId } });
      await tx.reviewTarget.deleteMany({ where: { organizationId } });
      await tx.membership.deleteMany({ where: { organizationId } });
      await tx.organization.delete({ where: { id: organizationId } });
      await tx.user.deleteMany({ where: { id: { in: userIds } } });
    }, { maxWait: 10_000, timeout: 60_000 });
    const leftovers = await prisma.submission.count({ where: { organizationId } });
    if (leftovers !== 0) throw new Error("Synthetic benchmark submissions remain after cleanup.");
    console.log("Synthetic organization removed and cleanup verified.");
  }
  await prisma.$disconnect();
}
