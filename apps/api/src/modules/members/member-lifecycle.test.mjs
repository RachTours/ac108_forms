import test from "node:test";
import assert from "node:assert/strict";
import { assertMemberCanBePermanentlyDeleted } from "../../../dist/modules/members/member-lifecycle.js";

test("permanent membership delete requires an already removed member with no submission history", () => {
  assert.doesNotThrow(() => assertMemberCanBePermanentlyDeleted({ role: "REVIEWER", status: "ARCHIVED", submissionCount: 0 }));
  assert.throws(() => assertMemberCanBePermanentlyDeleted({ role: "OWNER", status: "ARCHIVED", submissionCount: 0 }), (error) => error.code === "OWNER_PROTECTED");
  assert.throws(() => assertMemberCanBePermanentlyDeleted({ role: "REVIEWER", status: "ACTIVE", submissionCount: 0 }), (error) => error.code === "MEMBER_MUST_BE_REMOVED");
  assert.throws(() => assertMemberCanBePermanentlyDeleted({ role: "REVIEWER", status: "ARCHIVED", submissionCount: 1 }), (error) => error.code === "MEMBER_HAS_SUBMISSIONS");
});
