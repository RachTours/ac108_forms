import { z } from "zod";
import { formAnswersSchema, formDefinitionSchema } from "./forms.js";
import { roles } from "./roles.js";

const uuid = z.string().uuid();
const isoDate = z.iso.datetime({ offset: true });
const email = z.string().email().max(254);
const recordStatus = z.enum(["ACTIVE", "ARCHIVED"]);

export const targetSummarySchema = z.object({
  id: uuid,
  displayName: z.string().min(1).max(160),
  email: email.nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  submissionCount: z.number().int().nonnegative(),
  assignedReviewer: z.object({ membershipId: uuid, displayName: z.string().min(1).max(120), email }).strict().nullable().optional(),
}).strict();

export const targetWriteSchema = z.object({
  displayName: z.string().trim().min(1).max(160),
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
}).strict();
export const targetCreateResponseSchema = z.object({ data: targetSummarySchema }).strict();
export const targetUpdateResponseSchema = z.object({
  data: z.object({ id: uuid, displayName: z.string().min(1).max(160), email: email.nullable() }).strict(),
}).strict();

export const memberSummarySchema = z.object({
  id: uuid,
  organizationId: uuid,
  userId: uuid,
  role: z.enum(roles),
  status: recordStatus,
  createdAt: isoDate,
  user: z.object({ id: uuid, email, displayName: z.string().min(1).max(120), status: recordStatus }).strict(),
  assignedTargetCount: z.number().int().nonnegative(),
  linkCount: z.number().int().nonnegative(),
}).strict();

export const invitationSummarySchema = z.object({
  id: uuid,
  email: email.nullable(),
  displayName: z.string().min(1).max(120).nullable(),
  role: z.enum(["ADMIN", "REVIEWER"]),
  expiresAt: isoDate,
  createdAt: isoDate,
  expired: z.boolean(),
  canReveal: z.boolean(),
}).strict();

export const invitationCreatedSchema = invitationSummarySchema.extend({ inviteUrl: z.url() }).strict();
export const invitationCreateRequestSchema = z.object({ role: z.enum(["ADMIN", "REVIEWER"]) }).strict();
export const invitationAcceptInfoSchema = z.object({ data: z.object({ email: email.nullable(), displayName: z.string().min(1).max(120).nullable(), role: z.enum(["ADMIN", "REVIEWER"]), expiresAt: isoDate }).strict() }).strict();
export const invitationAcceptRequestSchema = z.object({
  email: z.union([z.string().trim().email().max(254), z.literal("")]).optional(),
  displayName: z.string().trim().min(1).max(120).optional(),
  password: z.string().min(14).max(1024),
}).strict();
export const invitationAcceptResponseSchema = z.object({ data: z.object({ accepted: z.literal(true) }).strict() }).strict();

export const memberUpdateRequestSchema = z.object({ role: z.enum(["ADMIN", "REVIEWER"]).optional(), status: recordStatus.optional() })
  .strict().refine((value) => value.role !== undefined || value.status !== undefined);
export const memberUpdateResponseSchema = z.object({ data: z.object({ id: uuid, organizationId: uuid, userId: uuid, role: z.enum(roles), status: recordStatus, createdAt: isoDate }).strict() }).strict();
export const passwordResetTokenSummarySchema = z.object({ id: uuid, expiresAt: isoDate, createdAt: isoDate, consumedAt: isoDate.nullable(), revokedAt: isoDate.nullable(), expired: z.boolean(), active: z.boolean() }).strict();
export const passwordResetTokenCreatedSchema = z.object({ data: z.object({ id: uuid, token: z.string().min(40).max(100), expiresAt: isoDate, createdAt: isoDate }).strict() }).strict();
export const passwordResetTokensResponseSchema = z.object({ data: z.array(passwordResetTokenSummarySchema).max(20) }).strict();
export const emptyRequestSchema = z.object({}).strict();
export const noContentResponseSchema = z.undefined();

export const formSummarySchema = z.object({
  id: uuid,
  title: z.string().min(1).max(160),
  description: z.string().max(2000),
  status: z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]),
  updatedAt: isoDate,
  currentPublishedId: uuid.nullable(),
  submissionCount: z.number().int().nonnegative(),
}).strict();

export const formDraftRequestSchema = formDefinitionSchema;
export const formVersionSummarySchema = z.object({
  id: uuid,
  formId: uuid,
  version: z.number().int().positive(),
  publishedAt: isoDate.nullable(),
  createdAt: isoDate,
}).strict();

export const formVersionDetailSchema = formVersionSummarySchema.extend({ definition: formDefinitionSchema }).strict();

export const reviewLinkSummarySchema = z.object({
  id: uuid,
  reviewerId: uuid.optional(),
  formId: uuid.nullable(),
  createdAt: isoDate,
  expiresAt: isoDate.nullable(),
  revokedAt: isoDate.nullable(),
  active: z.boolean(),
  canReveal: z.boolean().optional(),
}).strict();

export const publicReviewReadResponseSchema = z.object({
  data: z.object({
    reviewerName: z.string().min(1).max(120),
    theme: z.object({ accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/), fontPreset: z.string().max(16), surfacePreset: z.string().max(16), formStyle: z.string().max(16) }).strict(),
    targets: z.array(z.object({ id: uuid, displayName: z.string().min(1).max(160) }).strict()).max(1000),
    forms: z.array(z.object({ id: uuid, title: z.string().min(1).max(160), description: z.string().max(2000), versionId: uuid, definition: formDefinitionSchema }).strict()).max(100),
  }).strict(),
}).strict();

export const submissionCreateRequestSchema = z.object({
  formId: uuid,
  formVersionId: uuid,
  targetId: uuid,
  answers: formAnswersSchema,
}).strict();

export const submissionReceiptSchema = z.object({
  data: z.object({ id: uuid, submittedAt: isoDate, replay: z.boolean() }).strict(),
}).strict();

export const submissionSummarySchema = z.object({
  id: uuid,
  formId: uuid,
  formVersionId: uuid,
  targetId: uuid,
  reviewerId: uuid,
  reviewedAt: isoDate.nullable(),
  archivedAt: isoDate.nullable(),
  submittedAt: isoDate,
  target: z.object({ id: uuid, displayName: z.string().min(1).max(160) }).strict(),
  form: z.object({ id: uuid, title: z.string().min(1).max(160) }).strict(),
  reviewer: z.object({ user: z.object({ displayName: z.string().min(1).max(120) }).strict() }).strict(),
  formVersion: z.object({ version: z.number().int().positive() }).strict(),
  reviewedPersonName: z.string().min(1).max(160),
}).strict();

export const progressSummarySchema = z.object({
  activeTargets: z.number().int().nonnegative(),
  assignedTargets: z.number().int().nonnegative(),
  completedTargets: z.number().int().nonnegative(),
  responseCount: z.number().int().nonnegative(),
  unassignedTargets: z.number().int().nonnegative(),
  targetCount: z.number().int().nonnegative(),
  completionRule: z.literal("ONE_RESPONSE"),
  completionPercent: z.number().min(0).max(100),
}).strict();

export const organizationSummarySchema = z.object({
  id: uuid,
  name: z.string().trim().min(1).max(160),
  slug: z.string().trim().min(1).max(80).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  createdAt: isoDate,
  updatedAt: isoDate,
}).strict();

export const progressConfigSchema = z.object({ targetCount: z.number().int().min(0).max(100_000), completionRule: z.literal("ONE_RESPONSE") }).strict();

export const organizationThemeSchema = z.object({
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fontPreset: z.enum(["sans", "serif", "system"]),
  surfacePreset: z.enum(["mist", "warm", "cool"]),
  formStyle: z.enum(["clean", "soft"]),
}).strict();

export const organizationThemeResponseSchema = organizationThemeSchema.extend({ updatedAt: isoDate.nullable() }).strict();

export const auditEventSummarySchema = z.object({
  id: uuid,
  actorId: uuid.nullable(),
  action: z.string().min(1).max(80),
  entityType: z.string().min(1).max(80),
  entityId: uuid.nullable(),
  createdAt: isoDate,
}).strict();

export const paginatedResponseSchema = <T extends z.ZodType>(itemSchema: T) => z.object({
  data: z.array(itemSchema).max(100),
  nextCursor: uuid.nullable(),
}).strict();

export type TargetSummary = z.infer<typeof targetSummarySchema>;
export type MemberSummary = z.infer<typeof memberSummarySchema>;
export type InvitationSummary = z.infer<typeof invitationSummarySchema>;
export type InvitationCreateRequest = z.infer<typeof invitationCreateRequestSchema>;
export type MemberUpdateRequest = z.infer<typeof memberUpdateRequestSchema>;
export type FormSummary = z.infer<typeof formSummarySchema>;
export type ReviewLinkSummary = z.infer<typeof reviewLinkSummarySchema>;
export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;
export type ProgressSummary = z.infer<typeof progressSummarySchema>;
export type OrganizationSummary = z.infer<typeof organizationSummarySchema>;
export type ProgressConfig = z.infer<typeof progressConfigSchema>;
export type OrganizationTheme = z.infer<typeof organizationThemeSchema>;
