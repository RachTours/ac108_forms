import assert from "node:assert/strict";
import test from "node:test";
import { formatDate, formatDateTime } from "./date-format.ts";

test("date and date-time formatting use an explicit stable timezone", () => {
  assert.equal(formatDate("2026-10-22T00:30:00.000Z"), "22 Oct 2026");
  assert.equal(formatDateTime("2026-10-22T00:30:00.000Z"), "22 Oct 2026, 00:30 UTC");
});

test("Arabic date labels keep Western digits", () => {
  assert.equal(formatDate("2026-10-22T00:30:00.000Z", "ar"), "22 أكتوبر 2026");
});
