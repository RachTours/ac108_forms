import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../dist/app.js";
import { markDraining } from "../dist/http/service-state.js";

test("readiness fails promptly during graceful shutdown without querying the database", async () => {
  markDraining();
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const response = await fetch(`http://127.0.0.1:${address.port}/api/v1/health/ready`);
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { status: "draining" });
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
