// Run after local migrations and API/contracts builds, with the API on port 4000.
// Default: remove fixtures even on failure. --keep retains a successful browser fixture;
// --cleanup removes that fixture and verifies the original database rows again.
import assert from "node:assert/strict";
import { createHash, randomBytes, randomUUID as uuid } from "node:crypto";
import fs from "node:fs";
import { prisma } from "../apps/api/dist/db/client.js";
import { mysqlConnection, env } from "../apps/api/dist/env.js";
import { hashPassword } from "../apps/api/dist/modules/auth/password.js";
import { hashToken, createCsrfToken } from "../apps/api/dist/modules/auth/session.js";
import {
  memberListResponseSchema, reviewerMemberListResponseSchema, memberUpdateResponseSchema,
  progressSummarySchema, reviewerGroupListResponseSchema, publicReviewReadResponseSchema,
  submissionReceiptSchema,
} from "../packages/contracts/dist/index.js";

assert.equal(mysqlConnection.host, "127.0.0.1", "Verification requires mysqlConnection.host=127.0.0.1.");
const origin = "http://127.0.0.1:4000";
const fixturePath = "output/group-workflows-local-fixture.json";
const prefix = "group-workflows-qa-";
const models = ["organization", "user", "membership", "session", "form", "formVersion", "reviewTarget", "reviewerGroup", "reviewerGroupFormGrant", "reviewerFormGrant", "assignment", "reviewLink", "submission", "progressConfig", "organizationTheme", "invitation", "passwordResetToken", "auditEvent"];
const digest = (value) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
let checks = 0;
const equal = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };

async function snapshot() {
  const result = {};
  for (const model of models) {
    const rows = await prisma[model].findMany({ orderBy: { id: "asc" } });
    result[model] = Object.fromEntries(rows.map((row) => [row.id, digest(row)]));
  }
  return result;
}
async function verifyBaseline(baseline, exact) {
  const current = await snapshot();
  for (const model of models) {
    for (const [id, hash] of Object.entries(baseline[model])) equal(current[model][id], hash, `Original ${model} row ${id} changed or disappeared.`);
    if (exact) equal(current[model], baseline[model], `${model} rows/count did not return to baseline.`);
  }
}
async function cleanup(fixture) {
  for (const organizationId of fixture.organizations) {
    const org = await prisma.organization.findUnique({ where: { id: organizationId } });
    if (!org) continue;
    assert.ok(org.slug.startsWith(prefix), "Refusing to remove a non-fixture workspace.");
    await prisma.membership.updateMany({ where: { organizationId }, data: { groupId: null } });
    await prisma.submission.deleteMany({ where: { organizationId } });
    await prisma.reviewLink.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
  }
  for (const id of fixture.userIds) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) continue;
    assert.ok(user.email.startsWith(prefix) && user.email.endsWith("@reviewroom.test"), "Refusing to remove a non-fixture user.");
    await prisma.user.delete({ where: { id } });
  }
}
async function request(actor, path, { method = "GET", body, status = 200, version = 2, headers = {} } = {}) {
  const response = await fetch(`${origin}/api/v${version}${path}`, {
    method, headers: { "Content-Type": "application/json", Origin: env.WEB_ORIGIN,
      ...(actor ? { Cookie: `reviewroom-${actor.audience}=${actor.token}`, "X-Reviewroom-Audience": actor.audience, "X-CSRF-Token": actor.csrf } : {}), ...headers },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30_000),
  });
  const raw = await response.text();
  let result;
  try { result = raw ? JSON.parse(raw) : null; } catch { throw new Error(`${method} v${version}${path}: non-JSON ${response.status}: ${raw.slice(0, 200)}`); }
  equal(response.status, status, `${method} v${version}${path}: ${JSON.stringify(result)}`);
  return result;
}
const patch = (actor, path, body, status = 200, version = 2) => request(actor, path, { method: "PATCH", body, status, version });
const post = (actor, path, body = {}, status = 200, version = 2) => request(actor, path, { method: "POST", body, status, version });
const tokenFrom = (link) => new URL(link.shareUrl).pathname.split("/").at(-1);
const readLink = async (token, version = 2) => publicReviewReadResponseSchema.parse(await request(null, `/public/review/${token}`, { version })).data;

if (process.argv.includes("--cleanup")) {
  try {
    const fixture = JSON.parse(fs.readFileSync(fixturePath, "utf8"));
    await cleanup(fixture);
    // A retained browser fixture may coexist with new user sign-ins. Preserve
    // unrelated new rows, while requiring every original row to be unchanged.
    await verifyBaseline(fixture.baseline, false);
    equal(await prisma.organization.count({ where: { id: { in: fixture.organizations } } }), 0);
    equal(await prisma.user.count({ where: { id: { in: fixture.userIds } } }), 0);
    fs.unlinkSync(fixturePath);
    console.log("PASS: retained fixtures removed; every original row preserved; unrelated new user rows left untouched.");
  } finally { await prisma.$disconnect(); }
} else {
  assert.ok(!fs.existsSync(fixturePath), `Retained fixture exists. Run node scripts/verify-group-workflows-local.mjs --cleanup first.`);
  const fixture = { organizations: [], userIds: [], baseline: null };
  let success = false;
  try {
    // Store only hashes, never real row contents, in the optional retained fixture.
    fixture.baseline = await snapshot();
    const passwordHash = await hashPassword(randomBytes(24).toString("base64url"));
    async function member(organizationId, displayName, role = "REVIEWER") {
      const user = await prisma.user.create({ data: { email: `${prefix}${uuid()}@reviewroom.test`, displayName } });
      fixture.userIds.push(user.id);
      const membership = await prisma.membership.create({ data: { organizationId, userId: user.id, role, passwordHash } });
      const token = randomBytes(32).toString("base64url");
      const session = await prisma.session.create({ data: { organizationId, userId: user.id, membershipId: membership.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 8 * 3600_000) } });
      return { id: membership.id, token, csrf: createCsrfToken(session.id), audience: role === "REVIEWER" ? "reviewer" : "admin" };
    }
    for (const name of ["Group workflow verification", "Cross-workspace verification"]) {
      const org = await prisma.organization.create({ data: { name, slug: `${prefix}${uuid()}` } });
      fixture.organizations.push(org.id);
    }
    const [org, otherOrg] = fixture.organizations;
    const admin = await member(org, "Workflow Admin", "OWNER"), otherAdmin = await member(otherOrg, "Other Admin", "OWNER");
    const alice = await member(org, "Amina"), bob = await member(org, "Adam"), outsider = await member(otherOrg, "Other Reviewer");
    await prisma.progressConfig.create({ data: { organizationId: org, targetCount: 50, submissionGoal: 50 } });
    const fieldIds = { name: uuid(), email: uuid(), signature: uuid() };
    const definition = { title: "Workflow form", description: "", language: "en", fields: [
      { id: fieldIds.name, type: "name", label: "Full name", description: "", required: true, minLength: 2, maxLength: 160 },
      { id: fieldIds.email, type: "email", label: "Email", description: "", required: false },
      { id: fieldIds.signature, type: "signature", label: "Signature", description: "", required: true },
    ] };
    async function form(organizationId, title) {
      const value = await prisma.form.create({ data: { organizationId, title, description: "", status: "PUBLISHED", draftDefinition: { ...definition, title } } });
      const version = await prisma.formVersion.create({ data: { formId: value.id, version: 1, definition: { ...definition, title }, publishedAt: new Date() } });
      await prisma.form.update({ where: { id: value.id }, data: { currentPublishedId: version.id } });
      return { id: value.id, versionId: version.id };
    }
    const first = await form(org, "Alpha form"), second = await form(org, "Beta form"), foreignForm = await form(otherOrg, "Other form");
    const target = await prisma.reviewTarget.create({ data: { organizationId: org, displayName: "Workflow respondent" } });
    await prisma.assignment.create({ data: { organizationId: org, reviewerId: alice.id, targetId: target.id } });
    const answers = { [fieldIds.name]: "Local respondent", [fieldIds.signature]: { mode: "drawn", strokes: [{ points: [{ x: 0.1, y: 0.2 }, { x: 0.6, y: 0.8 }] }] } };
    async function submit(token, selected = first, { status = 201, version = 2, answerMap = answers, key = uuid() } = {}) {
      const value = await request(null, `/public/review/${token}/submissions`, { method: "POST", version, status,
        headers: { "Idempotency-Key": key }, body: { formId: selected.id, formVersionId: selected.versionId, targetId: target.id, answers: answerMap } });
      return status < 300 ? submissionReceiptSchema.parse(value).data : value;
    }

    // Issue actual policy-1 credentials while legacy behavior is enabled.
    const specific = tokenFrom((await post(alice, `/review-links/mine/forms/${second.id}/rotate`, {}, 201, 1)).data);
    const allForms = tokenFrom((await post(alice, "/review-links/mine/rotate", {}, 201, 1)).data);
    equal((await prisma.reviewLink.findUnique({ where: { tokenHash: hashToken(specific) } })).accessPolicyVersion, 1);
    const legacyReceipt = await submit(specific, second, { version: 1 });
    equal((await prisma.submission.findUnique({ where: { id: legacyReceipt.id } })).groupId, null);

    const alpha = (await post(admin, "/groups", { name: "Alpha" }, 201)).data;
    const beta = (await post(admin, "/groups", { name: "Beta", submissionGoal: 30, formIds: [second.id] }, 201)).data;
    const foreignGroup = (await post(otherAdmin, "/groups", { name: "Foreign", submissionGoal: 20 }, 201)).data;
    equal((await post(admin, "/groups/config", { enabled: true, confirmed: true }, 409)).error.code, "GROUP_SETUP_INCOMPLETE");
    await patch(admin, `/groups/${alpha.id}`, { submissionGoal: 20, formIds: [first.id], reviewerIds: [alice.id], reviewerGoals: [{ reviewerId: alice.id, goal: 10 }] });
    equal((await post(admin, "/groups/config", { enabled: true, confirmed: true }, 409)).error.code, "GROUP_SETUP_INCOMPLETE");
    equal((await request(admin, "/groups")).data.find((row) => row.id === alpha.id).submissionCount, 1, "Earlier ungrouped submissions must count when the author joins a group.");
    await patch(admin, `/members/${bob.id}`, { groupId: beta.id, submissionGoalOverride: 12, formIds: [first.id] });
    await patch(admin, `/members/${alice.id}`, { formIds: [second.id] });
    // Hold the same policy lock, start issuance against the old disabled state,
    // then activate before releasing it. Issuance must read policy after the lock.
    let issuance;
    await prisma.$transaction(async (transaction) => {
      await transaction.$queryRaw`SELECT id FROM Organization WHERE id = ${org} FOR UPDATE`;
      issuance = post(alice, "/review-links/mine/rotate", {}, 409);
      await new Promise((resolve) => setTimeout(resolve, 120));
      await transaction.organization.update({ where: { id: org }, data: { groupWorkflowsEnabled: true } });
    });
    equal((await issuance).error.code, "GROUP_FORM_REQUIRED");
    await post(admin, "/groups/config", { enabled: true, confirmed: true });
    equal((await request(admin, "/groups/config")).data, { enabled: true, groupGoalTotal: 50, legacySubmissions: 1, ungroupedReviewers: 0, unconfiguredGroups: 0 });

    // v1 DTOs must keep their exact strict schema; v2 adds reviewer settings.
    const legacyMembers = memberListResponseSchema.parse(await request(admin, "/members", { version: 1 }));
    equal("group" in legacyMembers.data.find((row) => row.id === alice.id), false);
    const extended = reviewerMemberListResponseSchema.parse(await request(admin, "/members"));
    equal(extended.data.find((row) => row.id === alice.id).group.id, alpha.id);
    equal(extended.data.find((row) => row.id === alice.id).submissionGoalOverride, 10);
    await patch(admin, `/members/${alice.id}`, { groupId: beta.id }, 400, 1);
    memberUpdateResponseSchema.parse(await patch(admin, `/members/${bob.id}`, { status: "ACTIVE" }, 200, 1));
    progressSummarySchema.parse((await request(admin, "/progress/summary", { version: 1 })).data);
    const legacyBoard = (await request(admin, "/progress/reviewer-board", { version: 1 })).data;
    for (const row of legacyBoard) equal(Object.keys(row).sort(), ["assigned", "completed", "displayName", "reviewerId"]);
    await patch(admin, "/progress/config", { submissionGoal: 80, completionRule: "ONE_RESPONSE" }, 400, 1);
    equal((await request(alice, "/progress/summary")).data.reviewerSubmissionGoal, 10);
    equal((await request(admin, "/progress/reviewer-board")).data.find((row) => row.reviewerId === alice.id).reviewerSubmissionGoal, 10);
    const listed = (await request(alice, "/review-links/mine/forms")).data;
    equal(listed.find((row) => row.id === first.id).canGenerate, true);
    equal(listed.find((row) => row.id === second.id).canGenerate, false);
    await post(alice, `/review-links/mine/forms/${second.id}/rotate`, {}, 404);
    await post(alice, "/review-links/mine/rotate", {}, 409);
    equal((await readLink(specific)).forms.map((row) => row.id), [second.id]);
    equal((await readLink(allForms, 1)).forms.length, 2);
    const currentLink = (await post(alice, `/review-links/mine/forms/${first.id}/rotate`, {}, 201)).data;
    const currentToken = tokenFrom(currentLink);
    equal((await prisma.reviewLink.findUnique({ where: { id: currentLink.id } })).accessPolicyVersion, 2);
    equal((await prisma.reviewLink.findUnique({ where: { id: currentLink.id } })).groupId, alpha.id);
    const validation = await submit(currentToken, first, { answerMap: {}, status: 422 });
    equal(validation.error.fieldId, fieldIds.name);
    equal("fieldId" in (await submit(specific, second, { answerMap: {}, status: 422, version: 1 })).error, false);
    const key = uuid(), alphaReceipt = await submit(currentToken, first, { key });
    equal((await submit(currentToken, first, { key, status: 200 })).replay, true);
    await submit(allForms, second);
    await submit(specific, second);
    equal((await prisma.submission.findUnique({ where: { id: alphaReceipt.id } })).groupId, alpha.id);
    await submit(currentToken, second, { status: 404 });

    // Invalid late-stage grant validation must roll back preceding member/goal updates.
    async function groupState() {
      return { group: await prisma.reviewerGroup.findUnique({ where: { id: alpha.id } }),
        members: await prisma.membership.findMany({ where: { organizationId: org }, orderBy: { id: "asc" } }),
        grants: await prisma.reviewerGroupFormGrant.findMany({ where: { organizationId: org }, orderBy: { id: "asc" } }),
        audits: await prisma.auditEvent.count({ where: { organizationId: org } }) };
    }
    const beforeInvalid = await groupState();
    await patch(admin, `/groups/${alpha.id}`, { name: "Must roll back", submissionGoal: 999, reviewerIds: [bob.id], reviewerGoals: [{ reviewerId: bob.id, goal: 99 }], formIds: [foreignForm.id] }, 400);
    equal(await groupState(), beforeInvalid, "Invalid group save mutated data.");
    await patch(admin, `/groups/${alpha.id}`, { name: "Stale", expectedUpdatedAt: "2000-01-01T00:00:00.000Z" }, 409);
    equal(await groupState(), beforeInvalid);
    await patch(admin, `/groups/${alpha.id}`, { reviewerIds: [outsider.id] }, 400);
    await patch(admin, `/members/${alice.id}`, { groupId: foreignGroup.id, submissionGoalOverride: 99 }, 404);
    await patch(admin, `/groups/${foreignGroup.id}`, { name: "Forbidden" }, 404);
    await request(admin, `/groups/${foreignGroup.id}/submissions`, { status: 404 });
    await request(alice, "/groups", { status: 403 });
    await assert.rejects(prisma.membership.update({ where: { id: alice.id }, data: { groupId: foreignGroup.id } }));
    equal((await prisma.membership.findUnique({ where: { id: alice.id } })).submissionGoalOverride, 10);

    let groups = reviewerGroupListResponseSchema.parse(await request(admin, "/groups")).data;
    equal(groups.find((row) => row.id === alpha.id).memberCount, 1);
    equal(groups.find((row) => row.id === beta.id).memberCount, 1);
    equal(groups.find((row) => row.id === alpha.id).submissionCount, 4);
    equal(groups.find((row) => row.id === beta.id).submissionCount, 0);
    equal((await request(admin, "/progress/summary")).data.groupSubmissionCount, 4);
    const page = (await request(admin, `/groups/${alpha.id}/submissions?limit=2`)).data;
    equal(page.total, 4); equal(page.submissions.length, 2); assert.ok(page.nextCursor);
    equal(page.submissions.some((row) => "answers" in row), false);
    const next = (await request(admin, `/groups/${alpha.id}/submissions?limit=2&cursor=${page.nextCursor}`)).data;
    equal(next.submissions.length, 2); equal(new Set([...page.submissions, ...next.submissions].map((row) => row.id)).size, 4);

    equal(groups.reduce((sum, row) => sum + row.submissionCount, 0), 4, "Group totals must count each review once.");
    await prisma.submission.update({ where: { id: legacyReceipt.id }, data: { archivedAt: new Date() } });
    equal((await request(admin, "/groups")).data.find((row) => row.id === alpha.id).submissionCount, 3, "Archived answers must not count.");
    equal((await request(admin, `/groups/${alpha.id}/submissions`)).data.total, 3);
    await prisma.submission.update({ where: { id: legacyReceipt.id }, data: { archivedAt: null } });
    const sourceBeforeMemberMove = groups.find((row) => row.id === alpha.id);
    await patch(admin, `/members/${alice.id}`, { groupId: beta.id });
    equal((await patch(admin, `/groups/${alpha.id}`, { name: "Stale member-move save", reviewerIds: [alice.id], expectedUpdatedAt: sourceBeforeMemberMove.updatedAt }, 409)).error.code, "GROUP_CHANGED");
    equal((await prisma.membership.findUnique({ where: { id: alice.id } })).groupId, beta.id);
    equal((await request(admin, "/groups")).data.find((row) => row.id === alpha.id).submissionCount, 0, "Moving a reviewer removes all their past reviews from the old group.");
    equal((await request(admin, `/groups/${beta.id}/submissions`)).data.total, 4, "The new group history includes earlier ungrouped submissions.");
    await request(admin, `/groups/${alpha.id}/submissions?cursor=${page.nextCursor}`, { status: 400 });
    // Moving through a group editor must also invalidate the source group's dialog.
    const sourceBeforeGroupMove = (await request(admin, "/groups")).data.find((row) => row.id === beta.id);
    await patch(admin, `/groups/${alpha.id}`, { reviewerIds: [alice.id] });
    equal((await patch(admin, `/groups/${beta.id}`, { name: "Stale group-move save", reviewerIds: [alice.id, bob.id], expectedUpdatedAt: sourceBeforeGroupMove.updatedAt }, 409)).error.code, "GROUP_CHANGED");
    equal((await prisma.membership.findUnique({ where: { id: alice.id } })).groupId, alpha.id);
    await patch(admin, `/members/${alice.id}`, { groupId: beta.id });
    equal((await prisma.submission.findUnique({ where: { id: alphaReceipt.id } })).groupId, alpha.id, "Submission group snapshot moved with reviewer.");
    equal((await readLink(specific)).forms[0].id, second.id);
    equal((await readLink(allForms)).forms.length, 2);
    // Existing credentials survive moves; new receipts use the group at submission time.
    const movedReceipt = await submit(specific, second);
    await submit(allForms, first);
    await submit(currentToken, first);
    equal((await prisma.submission.findUnique({ where: { id: movedReceipt.id } })).groupId, beta.id);
    await post(alice, `/review-links/mine/forms/${first.id}/rotate`, {}, 404);
    const betaLink = (await post(bob, `/review-links/mine/forms/${second.id}/rotate`, {}, 201)).data;
    equal((await prisma.reviewLink.findUnique({ where: { id: betaLink.id } })).groupId, beta.id);
    // Bob has no policy-1 all-form credential that could accidentally keep this
    // row visible. A live policy-2 credential alone must preserve its controls.
    await patch(admin, `/groups/${beta.id}`, { formIds: [] });
    let retained = (await request(bob, "/review-links/mine/forms")).data.find((row) => row.id === second.id);
    assert.ok(retained, "Removing group grants hid an active policy-2 link.");
    equal(retained.canGenerate, false); equal(retained.link.id, betaLink.id); equal(retained.link.active, true);
    equal(tokenFrom((await post(bob, `/review-links/mine/forms/${second.id}/reveal`)).data), tokenFrom(betaLink));
    await patch(admin, `/groups/${beta.id}`, { formIds: [second.id] });
    await patch(admin, `/members/${bob.id}`, { groupId: alpha.id });
    retained = (await request(bob, "/review-links/mine/forms")).data.find((row) => row.id === second.id);
    assert.ok(retained, "Moving groups hid an active policy-2 link.");
    equal(retained.canGenerate, false); equal(retained.link.id, betaLink.id); equal(retained.link.active, true);
    equal((await readLink(tokenFrom(betaLink))).forms[0].id, second.id);
    await patch(admin, `/members/${bob.id}`, { groupId: beta.id });
    groups = (await request(admin, "/groups")).data;
    equal(groups.find((row) => row.id === alpha.id).memberCount, 0);
    equal(groups.find((row) => row.id === beta.id).memberCount, 2);
    equal(groups.find((row) => row.id === alpha.id).submissionCount, 0);
    equal(groups.find((row) => row.id === beta.id).submissionCount, 7);
    equal((await request(alice, "/progress/summary")).data.responseCount, 7);
    equal((await request(alice, "/progress/summary")).data.reviewerSubmissionGoal, 10);

    equal(groups.reduce((sum, row) => sum + row.submissionCount, 0), 7);
    equal((await request(admin, `/groups/${beta.id}/submissions`)).data.total, 7);
    const updatedBoard = (await request(admin, "/progress/reviewer-board")).data.find((row) => row.reviewerId === alice.id);
    equal(updatedBoard.submissionCount, 7); equal(updatedBoard.submissionPercent, 70);
    equal((await request(alice, "/progress/summary")).data.reviewerSubmissionPercent, 70);
    await patch(admin, `/members/${alice.id}`, { groupId: null });
    equal((await request(admin, "/groups")).data.find((row) => row.id === beta.id).submissionCount, 0);
    equal((await request(admin, "/progress/summary")).data.groupSubmissionCount, 0);
    const ungroupedHistory = (await request(alice, "/progress/summary")).data;
    equal(ungroupedHistory.lifetimeResponseCount, 7, "Leaving a group must preserve the reviewer's full history.");
    equal((await request(alice, "/submissions?limit=100")).data.length, 7);
    await patch(admin, `/members/${alice.id}`, { groupId: beta.id });
    equal((await request(admin, `/groups/${beta.id}/submissions`)).data.total, 7);
    // DELETE assignment explicitly pauses a person; reviewer lifecycle auto-balance
    // must still assign ordinary unassigned people while leaving that person paused.
    const pausedTarget = await prisma.reviewTarget.create({ data: { organizationId: org, displayName: "Paused person" } });
    const pauseAssignment = await prisma.assignment.create({ data: { organizationId: org, targetId: pausedTarget.id, reviewerId: bob.id } });
    await request(admin, `/assignments/${pausedTarget.id}`, { method: "DELETE", body: { expectedUpdatedAt: pauseAssignment.updatedAt.toISOString() } });
    equal((await prisma.reviewTarget.findUnique({ where: { id: pausedTarget.id } })).assignmentPaused, true);
    const waitingTarget = await prisma.reviewTarget.create({ data: { organizationId: org, displayName: "Auto-assign control" } });
    await patch(admin, `/members/${bob.id}`, { status: "ACTIVE" });
    equal(await prisma.assignment.count({ where: { targetId: pausedTarget.id } }), 0);
    equal(await prisma.assignment.count({ where: { targetId: waitingTarget.id } }), 1, "Control target proves auto-assignment actually ran.");
    await patch(admin, `/members/${bob.id}`, { status: "ARCHIVED" });
    equal(await prisma.assignment.count({ where: { targetId: pausedTarget.id } }), 0);
    equal((await prisma.reviewTarget.findUnique({ where: { id: pausedTarget.id } })).assignmentPaused, true);
    await patch(admin, `/members/${bob.id}`, { status: "ACTIVE" });
    equal(await prisma.assignment.count({ where: { targetId: pausedTarget.id } }), 0);

    await patch(admin, `/members/${bob.id}`, { groupId: alpha.id });
    await request(admin, `/groups/${alpha.id}`, { method: "DELETE", status: 204 });
    equal((await prisma.membership.findUnique({ where: { id: bob.id } })).groupId, null);
    const archived = reviewerGroupListResponseSchema.parse(await request(admin, "/groups?state=archived")).data.find((row) => row.id === alpha.id);
    assert.ok(archived.archivedAt); equal(archived.submissionCount, 3);
    equal((await request(admin, `/groups/${alpha.id}/submissions`)).data.total, 3);
    equal((await prisma.submission.findUnique({ where: { id: alphaReceipt.id } })).groupId, alpha.id);
    equal((await prisma.submission.findUnique({ where: { id: legacyReceipt.id } })).groupId, null);
    await patch(admin, `/members/${alice.id}`, { groupId: alpha.id }, 404);
    await patch(admin, `/groups/${alpha.id}`, { name: "Archived edit" }, 404);
    equal((await request(admin, "/progress/summary")).data.groupSubmissionCount, 7);
    equal((await request(admin, "/progress/summary")).data.groupGoalTotal, 30);
    progressSummarySchema.parse((await request(alice, "/progress/summary", { version: 1 })).data);
    await verifyBaseline(fixture.baseline, false);
    fixture.admin = admin; fixture.reviewer = alice; fixture.fieldIds = fieldIds;
    fixture.publicUrl = `${env.WEB_ORIGIN}/r/${specific}`;
    fixture.browserOrigin = env.WEB_ORIGIN;
    success = true;
  } finally {
    try {
      if (success && process.argv.includes("--keep")) {
        fs.mkdirSync("output", { recursive: true });
        fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
        console.log(`PASS: ${checks} checks. Isolated browser fixture retained in ${fixturePath}. Run with --cleanup afterward.`);
      } else {
        await cleanup(fixture);
        if (fixture.baseline) await verifyBaseline(fixture.baseline, true);
        if (success) console.log(`PASS: ${checks} checks; fixtures removed and every original row/count preserved.`);
      }
    } finally { await prisma.$disconnect(); }
  }
}
