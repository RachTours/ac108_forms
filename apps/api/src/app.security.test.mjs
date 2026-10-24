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
    for (const path of ["/health", "/api/v1/health/live", "/api/v1/unknown-private-route"]) {
      const response = await fetch(`http://127.0.0.1:${address.port}${path}`);
      assert.match(response.headers.get("cache-control") ?? "", /no-store/i, `${path} must not be cached`);
      if (path === "/health") {
        assert.equal(response.status, 200);
        assert.deepEqual(await response.json(), { status: "ok" });
      }
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test("assignment listing and mutations are not publicly accessible", async () => {
  const server = app.listen(0, "127.0.0.1");
  await new Promise((resolve, reject) => {
    server.once("listening", resolve);
    server.once("error", reject);
  });

  try {
    const address = server.address();
    assert.ok(address && typeof address === "object");
    const base = `http://127.0.0.1:${address.port}/api/v1/assignments`;
    const list = await fetch(base);
    assert.equal(list.status, 401);
    assert.equal((await list.json()).error.code, "UNAUTHENTICATED");

    const targetId = "8bd11f59-87b2-4ac2-8450-adf0e5e8094d";
    for (const method of ["PUT", "DELETE"]) {
      const response = await fetch(`${base}/${targetId}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewerId: targetId, expectedUpdatedAt: null }),
      });
      assert.equal(response.status, 401, `${method} must require a session`);
      assert.equal((await response.json()).error.code, "UNAUTHENTICATED");
    }
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
