import assert from "node:assert/strict";
import test from "node:test";
import { decryptSecret, encryptSecret } from "../../../dist/modules/secrets/secret-box.js";

test("encrypted secrets can be recovered with the same key", () => {
  const key = Buffer.alloc(32, 7);
  const encrypted = encryptSecret("reviewroom-token", key);
  assert.notEqual(encrypted, "reviewroom-token");
  assert.equal(decryptSecret(encrypted, key), "reviewroom-token");
});

test("encrypted secrets cannot be opened with another key or altered ciphertext", () => {
  const encrypted = encryptSecret("reviewroom-token", Buffer.alloc(32, 7));
  assert.throws(() => decryptSecret(encrypted, Buffer.alloc(32, 8)));
  const parts = encrypted.split(".");
  parts[3] = `${parts[3][0] === "A" ? "B" : "A"}${parts[3].slice(1)}`;
  assert.throws(() => decryptSecret(parts.join("."), Buffer.alloc(32, 7)));
});
