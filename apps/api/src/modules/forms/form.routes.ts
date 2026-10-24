import { Router } from "express";
import { z } from "zod";
import { formDefinitionSchema } from "@reviewroom/contracts/forms";
import { requireCsrf, requireSession } from "../../middleware/require-session.js";
import { requirePermission } from "../../middleware/require-permission.js";
import { archiveForm, createForm, getForm, listForms, permanentlyDeleteArchivedForm, publishForm, restoreArchivedForm, updateForm } from "./form.service.js";

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
    response.status(201).json({ data: form });
  } catch (error) { next(error); }
});
formRouter.get("/:formId", requirePermission("forms", "read"), async (request, response, next) => {
  try { response.json({ data: await getForm(request.auth!.organizationId, idSchema.parse(request.params.formId)) }); } catch (error) { next(error); }
});
formRouter.patch("/:formId", requirePermission("forms", "update"), requireCsrf, async (request, response, next) => {
  try {
    const formId = idSchema.parse(request.params.formId);
    const definition = formDefinitionSchema.parse(request.body);
    response.json({ data: await updateForm(request.auth!.organizationId, request.auth!.userId, formId, definition) });
  } catch (error) { next(error); }
});
formRouter.post("/:formId/publish", requirePermission("forms", "publish"), requireCsrf, async (request, response, next) => {
  try {
    const version = await publishForm(request.auth!.organizationId, request.auth!.userId, idSchema.parse(request.params.formId));
    response.status(201).json({ data: version });
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

