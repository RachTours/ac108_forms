import { randomBytes } from "node:crypto";
import { performance } from "node:perf_hooks";

const apiOrigin = (process.env.LOAD_API_URL ?? "http://localhost:4000").replace(/\/$/, "");
const webOrigin = (process.env.LOAD_WEB_URL ?? "http://localhost:5000").replace(/\/$/, "");
const concurrency = boundedInteger("LOAD_CONCURRENCY", 12, 1, 24);
const apiRequests = boundedInteger("LOAD_API_REQUESTS", 160, 20, 240);
const webRequests = boundedInteger("LOAD_WEB_REQUESTS", 80, 10, 120);

function boundedInteger(name, fallback, min, max) {
  const parsed = Number.parseInt(process.env[name] ?? "", 10);
  return Number.isInteger(parsed) ? Math.max(min, Math.min(max, parsed)) : fallback;
}

function percentile(sorted, ratio) {
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * ratio) - 1)] ?? 0;
}

async function runScenario(name, count, urlForRequest, expectedStatus) {
  const latencies = [];
  const statuses = new Map();
  const failures = [];
  let next = 0;
  const started = performance.now();

  async function worker() {
    while (true) {
      const index = next++;
      if (index >= count) return;
      const requestStarted = performance.now();
      try {
        const response = await fetch(urlForRequest(index), { signal: AbortSignal.timeout(8_000) });
        await response.arrayBuffer();
        latencies.push(performance.now() - requestStarted);
        statuses.set(response.status, (statuses.get(response.status) ?? 0) + 1);
        if (!expectedStatus.includes(response.status)) failures.push(`request ${index + 1}: HTTP ${response.status}`);
      } catch (error) {
        latencies.push(performance.now() - requestStarted);
        failures.push(`request ${index + 1}: ${error instanceof Error ? error.name : "request error"}`);
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, count) }, () => worker()));
  const elapsedMs = performance.now() - started;
  const sorted = [...latencies].sort((a, b) => a - b);
  const statusSummary = [...statuses].sort(([a], [b]) => a - b).map(([status, amount]) => `${status}:${amount}`).join(", ") || "none";
  console.log(`${name}: ${count} requests, ${((count * 1000) / elapsedMs).toFixed(1)} req/s, p50 ${percentile(sorted, 0.5).toFixed(1)} ms, p95 ${percentile(sorted, 0.95).toFixed(1)} ms, statuses ${statusSummary}`);
  for (const failure of failures.slice(0, 5)) console.error(`  ${failure}`);
  if (failures.length > 5) console.error(`  and ${failures.length - 5} more failures`);
  return failures.length;
}

const readinessRequests = Math.floor(apiRequests / 2);
const publicReadRequests = apiRequests - readinessRequests;
let failures = 0;
failures += await runScenario("API readiness (MySQL ping)", readinessRequests, () => `${apiOrigin}/api/v1/health/ready`, [200]);
failures += await runScenario("Public review lookup (random invalid links)", publicReadRequests, () => `${apiOrigin}/api/v1/public/review/${randomBytes(36).toString("base64url")}`, [404, 429]);
failures += await runScenario("Web login page", webRequests, () => `${webOrigin}/admin/login`, [200]);

console.log(`Completed with ${failures} unexpected responses. API requests capped at ${apiRequests}; API global limit is 300 requests/minute.`);
if (failures > 0) process.exitCode = 1;
