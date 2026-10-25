import assert from "node:assert/strict";
import test from "node:test";
import { localizeApiError } from "./api-error-locale.ts";

test("authentication and common API failures are localized for all supported languages", () => {
  assert.equal(localizeApiError("INVALID_CREDENTIALS", "en"), "Email, password, or workspace is incorrect.");
  assert.equal(localizeApiError("INVALID_CREDENTIALS", "fr"), "L’adresse e-mail, le mot de passe ou l’espace de travail est incorrect.");
  assert.match(localizeApiError("INVALID_CREDENTIALS", "ar"), /البريد الإلكتروني/);
  assert.notEqual(localizeApiError("FORM_NOT_FOUND", "fr"), localizeApiError("FORM_NOT_FOUND", "en"));
});

test("unknown API errors use a localized generic message", () => {
  assert.equal(localizeApiError("NEW_SERVER_CODE", "fr"), "Une erreur s’est produite. Veuillez réessayer.");
  assert.equal(localizeApiError("NEW_SERVER_CODE", "ar"), "حدث خطأ. يرجى المحاولة مرة أخرى.");
});
