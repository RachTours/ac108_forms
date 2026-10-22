import assert from "node:assert/strict";
import test from "node:test";
import { app } from "../dist/app.js";

test("every API response disables shared and browser caching", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    for (const path of ["/api/v1/health/live", "/api/v1/unknown-private-route"]) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/i, `${path} must not be cached`);
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
