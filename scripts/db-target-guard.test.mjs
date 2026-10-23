import assert from "node:assert/strict";
import test from "node:test";
import { assertDatabaseIsNotProduction } from "./db-target-guard.mjs";

test("refuses database operations when configured host and name match production markers", () => {
  assert.throws(() => assertDatabaseIsNotProduction({
    DB_HOST: "127.0.0.1",
    DB_NAME: "reviewroom_prod",
    PRODUCTION_DB_HOST: "127.0.0.1",
    PRODUCTION_DB_NAME: "reviewroom_prod",
  }), /refusing database operation/i);
});

test("compares host and database name case-insensitively and trims whitespace", () => {
  assert.throws(() => assertDatabaseIsNotProduction({
    DB_HOST: " DB.EXAMPLE.COM ",
    DB_NAME: " ReviewRoom ",
    PRODUCTION_DB_HOST: "db.example.com",
    PRODUCTION_DB_NAME: "reviewroom",
  }), /refusing database operation/i);
});

test("allows a configured staging database that differs from production markers", () => {
  assert.doesNotThrow(() => assertDatabaseIsNotProduction({
    DB_HOST: "127.0.0.1",
    DB_NAME: "reviewroom_staging",
    PRODUCTION_DB_HOST: "127.0.0.1",
    PRODUCTION_DB_NAME: "reviewroom_prod",
  }));
});

test("does not block when no production markers are configured", () => {
  assert.doesNotThrow(() => assertDatabaseIsNotProduction({
    DB_HOST: "127.0.0.1",
    DB_NAME: "reviewroom_test",
  }));
});

test("protects the production target when the app uses DATABASE_URL", () => {
  assert.throws(() => assertDatabaseIsNotProduction({
    DATABASE_URL: "mysql://app:password@db.example.com:3306/reviewroom",
    PRODUCTION_DB_HOST: "db.example.com",
    PRODUCTION_DB_NAME: "reviewroom",
  }), /refusing database operation/i);
});

test("fails closed when only one production marker is set", () => {
  assert.throws(() => assertDatabaseIsNotProduction({
    DB_HOST: "127.0.0.1",
    DB_NAME: "reviewroom_test",
    PRODUCTION_DB_HOST: "127.0.0.1",
  }), /both PRODUCTION_DB_HOST and PRODUCTION_DB_NAME/i);
});
