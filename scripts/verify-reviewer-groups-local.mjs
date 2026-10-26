import assert from "node:assert/strict";
import { randomBytes, randomUUID } from "node:crypto";
import fs from "node:fs";
import { prisma } from "../apps/api/dist/db/client.js";
import { mysqlConnection, env } from "../apps/api/dist/env.js";
import { hashPassword } from "../apps/api/dist/modules/auth/password.js";
import { hashToken, createCsrfToken } from "../apps/api/dist/modules/auth/session.js";

if (!["127.0.0.1", "localhost", "::1"].includes(mysqlConnection.host)) throw new Error("This verification is restricted to the local database.");
const origin = "http://127.0.0.1:4000";
const fixturePath = "output/groups-local-fixture.json";

async function cleanup(fixture) {
  for (const organizationId of fixture.organizations) {
    const organization = await prisma.organization.findUnique({ where: { id: organizationId }, select: { slug: true } });
    if (!organization?.slug.startsWith("groups-qa-")) throw new Error("Refusing to remove a workspace outside the verification fixture.");
    await prisma.membership.updateMany({ where: { organizationId }, data: { groupId: null } });
    await prisma.submission.deleteMany({ where: { organizationId } });
    await prisma.organization.delete({ where: { id: organizationId } });
  }
  await prisma.user.deleteMany({ where: { id: { in: fixture.userIds } } });
}

if (process.argv.includes("--cleanup")) {
  try { await cleanup(JSON.parse(fs.readFileSync(fixturePath, "utf8"))); fs.unlinkSync(fixturePath); console.log("Local verification fixtures removed."); }
  finally { await prisma.$disconnect(); }
  process.exit(0);
}
if (fs.existsSync(fixturePath)) throw new Error("A local fixture already exists; clean it before starting another run.");
const userIds = [], organizations = [];
const fixture = { userIds, organizations };
const uuid = () => randomUUID();
const secretPassword = randomBytes(24).toString("base64url");
const passwordHash = await hashPassword(secretPassword);
let checks = 0;
async function member(organizationId, name, role) {
  const user = await prisma.user.create({ data: { email: `qa-${uuid()}@reviewroom.test`, displayName: name } });
  userIds.push(user.id);
  const membership = await prisma.membership.create({ data: { organizationId, userId: user.id, role, passwordHash } });
  const token = randomBytes(32).toString("base64url");
  const session = await prisma.session.create({ data: { organizationId, userId: user.id, membershipId: membership.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 8 * 3600_000) } });
  return { id: membership.id, token, sessionId: session.id, csrf: createCsrfToken(session.id), audience: role === "REVIEWER" ? "reviewer" : "admin" };
}
async function request(actor, path, method = "GET", body, status = 200) {
  const response = await fetch(`${origin}/api/v1${path}`, { method, headers: { Cookie: `reviewroom-${actor.audience}=${actor.token}`, Origin: env.WEB_ORIGIN, "X-Reviewroom-Audience": actor.audience, "X-CSRF-Token": actor.csrf, "Content-Type": "application/json" }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  const result = response.status === 204 ? null : await response.json();
  assert.equal(response.status, status, `${method} ${path}: ${JSON.stringify(result)}`); checks++;
  return result;
}

try {
  const original = { memberships: await prisma.membership.count(), submissions: await prisma.submission.count(), forms: await prisma.form.count() };
  for (const name of ["Local groups preview", "Isolation verification"]) {
    const org = await prisma.organization.create({ data: { name, slug: `groups-qa-${uuid()}` } }); organizations.push(org.id);
  }
  const org = organizations[0], otherOrg = organizations[1];
  const admin = await member(org, "Preview Admin", "OWNER");
  const otherAdmin = await member(otherOrg, "Other Admin", "OWNER");
  const reviewers = await Promise.all([member(org, "Amina", "REVIEWER"), member(org, "Adam", "REVIEWER"), member(org, "Youssef", "REVIEWER")]);
  await prisma.progressConfig.create({ data: { organizationId: org, submissionGoal: 50, targetCount: 50 } });
  const fieldIds = { name: uuid(), email: uuid(), signature: uuid() };
  const definition = { title: "Local verification form", description: "", language: "en", fields: [
    { id: fieldIds.name, type: "name", label: "Full name", description: "", required: true, minLength: 2, maxLength: 160 },
    { id: fieldIds.email, type: "email", label: "Email", description: "", required: false },
    { id: fieldIds.signature, type: "signature", label: "Signature", description: "", required: true },
  ] };
  const forms = [];
  for (const title of ["Local verification form", "Second published form"]) {
    const form = await prisma.form.create({ data: { organizationId: org, title, description: "", status: "PUBLISHED", draftDefinition: { ...definition, title } } });
    const version = await prisma.formVersion.create({ data: { formId: form.id, version: 1, definition: { ...definition, title }, publishedAt: new Date() } });
    await prisma.form.update({ where: { id: form.id }, data: { currentPublishedId: version.id } });
    forms.push({ ...form, versionId: version.id });
  }
  const groupA = (await request(admin, "/groups", "POST", { name: "Group Alpha" }, 201)).data;
  const groupB = (await request(admin, "/groups", "POST", { name: "Group Beta" }, 201)).data;
  await request(admin, `/groups/${groupB.id}`, "PATCH", { name: "Group Beta renamed" });
  await request(admin, `/groups/${groupB.id}`, "PATCH", { name: "Group Beta" });
  await request(admin, "/groups", "POST", { name: "Group Alpha" }, 409);
  const otherGroup = (await request(otherAdmin, "/groups", "POST", { name: "Other workspace group" }, 201)).data;
  await request(admin, `/groups/${otherGroup.id}`, "PATCH", { name: "Forbidden" }, 404);
  await request(reviewers[0], "/groups", "GET", undefined, 403);
  assert.equal((await request(reviewers[0], "/review-links/mine/forms")).data.length, 2);
  for (let i = 0; i < reviewers.length; i++) await request(admin, `/members/${reviewers[i].id}`, "PATCH", { groupId: i < 2 ? groupA.id : groupB.id, submissionGoalOverride: i === 0 ? 5 : null, formIds: i === 0 ? [forms[0].id] : null });
  const signature = { mode: "drawn", strokes: [{ points: [{ x: 0.1, y: 0.2 }, { x: 0.6, y: 0.8 }] }] };
  const answers = { [fieldIds.name]: "Local respondent", [fieldIds.signature]: signature };
  const targets = [];
  for (let i = 0; i < reviewers.length; i++) {
    const target = await prisma.reviewTarget.create({ data: { organizationId: org, displayName: `Person ${i + 1}` } }); targets.push(target);
    await prisma.assignment.create({ data: { organizationId: org, targetId: target.id, reviewerId: reviewers[i].id } });
    for (let j = 0; j < (i === 0 ? 2 : 1); j++) await prisma.submission.create({ data: { organizationId: org, formId: forms[0].id, formVersionId: forms[0].versionId, targetId: target.id, reviewerId: reviewers[i].id, idempotencyKey: uuid(), payloadHash: "a".repeat(64), answers } });
  }
  let groups = (await request(admin, "/groups")).data;
  let alpha = groups.find((g) => g.id === groupA.id);
  assert.equal(alpha.memberCount, 2); assert.equal(alpha.submissionCount, 3); assert.equal(alpha.submissionGoal, 5 + 50 / 3);
  const detail = (await request(admin, `/groups/${groupA.id}/submissions?limit=2`)).data;
  assert.equal(detail.total, 3); assert.equal(detail.submissions.length, 2); assert.ok(detail.nextCursor);
  assert.ok(detail.submissions.every((s) => s.reviewerName !== "Youssef" && !("answers" in s)));
  assert.equal((await request(admin, `/groups/${groupA.id}/submissions?cursor=${detail.nextCursor}&limit=2`)).data.submissions.length, 1);
  const board = (await request(admin, "/progress/reviewer-board")).data.find((r) => r.reviewerId === reviewers[0].id);
  assert.equal(board.reviewerSubmissionGoal, 5); assert.equal(board.submissionPercent, 40);
  assert.equal((await request(reviewers[0], "/progress/summary")).data.reviewerSubmissionGoal, 5);
  assert.equal((await request(reviewers[0], "/review-links/mine/forms")).data.length, 1);
  await request(reviewers[0], `/review-links/mine/forms/${forms[1].id}/rotate`, "POST", {}, 404);
  await request(admin, `/members/${reviewers[0].id}`, "PATCH", { groupId: otherGroup.id, submissionGoalOverride: 15 }, 404);
  await assert.rejects(prisma.membership.update({ where: { id: reviewers[0].id }, data: { groupId: otherGroup.id } }), "database tenant foreign key must reject cross-workspace group membership");
  assert.equal((await prisma.membership.findUnique({ where: { id: reviewers[0].id } })).submissionGoalOverride, 5);
  const link = (await request(reviewers[0], `/review-links/mine/forms/${forms[0].id}/rotate`, "POST", {}, 201)).data;
  const token = new URL(link.shareUrl).pathname.split("/").at(-1);
  const publicData = await fetch(`${origin}/api/v1/public/review/${token}`).then((r) => r.json());
  assert.equal(publicData.data.forms.length, 1);
  const submit = async (answerMap, expected) => {
    const r = await fetch(`${origin}/api/v1/public/review/${token}/submissions`, { method: "POST", headers: { "Content-Type": "application/json", "Idempotency-Key": uuid() }, body: JSON.stringify({ formId: forms[0].id, formVersionId: forms[0].versionId, targetId: targets[0].id, answers: answerMap }) });
    const result = await r.json(); assert.equal(r.status, expected, JSON.stringify(result)); checks++; return result;
  };
  assert.equal((await submit({}, 422)).error.fieldId, fieldIds.name);
  assert.equal((await submit({ ...answers, [fieldIds.email]: "invalid" }, 422)).error.fieldId, fieldIds.email);
  await submit(answers, 201);
  await request(admin, `/members/${reviewers[0].id}`, "PATCH", { formIds: [] });
  assert.equal((await fetch(`${origin}/api/v1/public/review/${token}`).then((r) => r.json())).data.forms.length, 0);
  await submit(answers, 404);
  await request(admin, `/members/${reviewers[0].id}`, "PATCH", { formIds: [forms[0].id] });
  await request(admin, `/members/${reviewers[1].id}`, "PATCH", { groupId: groupB.id });
  groups = (await request(admin, "/groups")).data;
  assert.equal(groups.find((g) => g.id === groupA.id).submissionCount, 3);
  assert.equal(groups.find((g) => g.id === groupB.id).submissionCount, 2);
  const adminAppearance = { accentColor: "#2457A6", fontPreset: "sans", surfacePreset: "cool", formStyle: "clean" };
  const reviewerAppearance = { accentColor: "#7A3E9D", fontPreset: "sans", surfacePreset: "warm", formStyle: "soft" };
  await request(admin, "/organization/theme?platform=admin", "PUT", adminAppearance);
  await request(admin, "/organization/theme?platform=reviewer", "PUT", reviewerAppearance);
  assert.equal((await request(admin, "/organization/theme")).data.accentColor, adminAppearance.accentColor);
  assert.equal((await request(reviewers[0], "/organization/theme")).data.accentColor, reviewerAppearance.accentColor);
  assert.equal((await fetch(`${origin}/api/v1/public/review/${token}`).then((r) => r.json())).data.theme.accentColor, reviewerAppearance.accentColor);
  await request(reviewers[0], "/organization/theme?platform=admin", "PUT", adminAppearance, 403);
  const disposable = (await request(admin, "/groups", "POST", { name: "Disposable" }, 201)).data;
  await request(admin, `/members/${reviewers[2].id}`, "PATCH", { groupId: disposable.id });
  await request(admin, `/groups/${disposable.id}`, "DELETE", undefined, 204);
  assert.equal((await prisma.membership.findUnique({ where: { id: reviewers[2].id } })).groupId, null);
  assert.equal(await prisma.submission.count({ where: { reviewerId: reviewers[2].id } }), 1);
  fixture.admin = admin; fixture.reviewer = reviewers[0]; fixture.publicUrl = `http://127.0.0.1:5000/r/${token}`; fixture.fieldIds = fieldIds; fixture.originalCounts = original;
  fs.mkdirSync("output", { recursive: true }); fs.writeFileSync(fixturePath, JSON.stringify(fixture, null, 2));
  console.log(`PASS: ${checks} local API requests; group totals, isolation, form grants, goals, errors, themes and preserved history verified.`);
  console.log("Fixtures retained in the isolated QA workspace for browser checks; run with --cleanup afterward.");
} catch (error) {
  await cleanup(fixture).catch(() => {}); throw error;
} finally { await prisma.$disconnect(); }
