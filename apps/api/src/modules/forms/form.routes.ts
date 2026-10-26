import { Router } from "express";
import { z } from "zod";
import { formDefinitionSchema } from "@reviewroom/contracts/forms";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { archiveForm, createForm, duplicateForm, getForm, listForms, permanentlyDeleteArchivedForm, publishForm, restoreArchivedForm, updateForm } from "./form.service.js";

import { preserveLegacyDraftMetadata, toLegacyFormRecord } from "./legacy-definition.js";

export const formRouter = Router();
const idSchema = z.string().uuid();
const createSchema = z.object({ title: z.string().trim().min(1).max(160), description: z.string().max(2000) }).strict();

formRouter.use(requireSession);
formRouter.get("/", requirePermission("forms", "read"), async (request, response, next) => {
  try {
    const state = z.enum(["active", "archived"]).default("active").parse(request.query.state);
    response.json({ data: await listForms(request.auth!.organizationId, state) });
  } catch (error) { next(error); }
});
formRouter.post("/", requirePermission("forms", "create"), requireCsrf, async (request, response, next) => {
  try {
    const input = createSchema.parse(request.body);
    const form = await createForm(request.auth!.organizationId, request.auth!.userId, input);
    response.status(201).json({ data: request.originalUrl.startsWith("/api/v2/") ? form : toLegacyFormRecord(form) });
  } catch (error) { next(error); }
});
formRouter.post("/:formId/duplicate", requirePermission("forms", "create"), requireCsrf, async (request, response, next) => {
  try {
    const { title } = z.object({ title: z.string().trim().min(1).max(160) }).strict().parse(request.body);
    const form = await duplicateForm(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.formId), title);
    response.status(201).json({ data: request.originalUrl.startsWith("/api/v2/") ? form : toLegacyFormRecord(form) });
  } catch (error) { next(error); }
});
formRouter.get("/:formId", requirePermission("forms", "read"), async (request, response, next) => {
  try { const form = await getForm(request.auth!.organizationId, idSchema.parse(request.params.formId)); response.json({ data: request.originalUrl.startsWith("/api/v2/") ? form : toLegacyFormRecord(form) }); } catch (error) { next(error); }
});
formRouter.patch("/:formId", requirePermission("forms", "update"), requireCsrf, async (request, response, next) => {
  try {
    const formId = idSchema.parse(request.params.formId);
    const definition = request.originalUrl.startsWith("/api/v2/") ? formDefinitionSchema.parse(request.body) : preserveLegacyDraftMetadata(request.body, (await getForm(request.auth!.organizationId, formId)).draftDefinition);
    const form = await updateForm(request.auth!.organizationId, request.auth!.userId, formId, definition);
    response.json({ data: request.originalUrl.startsWith("/api/v2/") ? form : toLegacyFormRecord(form) });
  } catch (error) { next(error); }
});
formRouter.post("/:formId/publish", requirePermission("forms", "publish"), requireCsrf, async (request, response, next) => {
  try {
    const version = await publishForm(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.formId));
    response.status(201).json({ data: request.originalUrl.startsWith("/api/v2/") ? version : toLegacyFormRecord(version) });
  } catch (error) { next(error); }
});
formRouter.post("/:formId/restore", requirePermission("forms", "update"), requireCsrf, async (request, response, next) => {
  try { await restoreArchivedForm(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.formId)); response.status(204).end(); } catch (error) { next(error); }
});
formRouter.delete("/:formId/permanent", requirePermission("forms", "archive"), requireCsrf, async (request, response, next) => {
  try { await permanentlyDeleteArchivedForm(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.formId)); response.status(204).end(); } catch (error) { next(error); }
});
formRouter.delete("/:formId", requirePermission("forms", "archive"), requireCsrf, async (request, response, next) => {
  try { await archiveForm(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.formId)); response.status(204).end(); } catch (error) { next(error); }
});

