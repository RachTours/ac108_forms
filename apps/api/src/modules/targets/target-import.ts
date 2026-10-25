import { z } from "zod";
import { HttpError } from "../../http/errors.js";

const MAX_ROWS = 500;
const MAX_CSV_LENGTH = 512_000;
const emailSchema = z.string().email().max(254);

export type TargetImportRow = { rowNumber: number; displayName: string; email: string };
export type TargetImportError = { rowNumber: number | null; message: string };
export type TargetImportResult = { rows: TargetImportRow[]; errors: TargetImportError[] };

function readCsv(input: string): { cells: string[][]; malformed: boolean } {
  const cells: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  let afterQuote = false;
  for (let index = 0; index < input.length; index += 1) {
    const character = input[index]!;
    if (quoted) {
      if (character === '"' && input[index + 1] === '"') { cell += '"'; index += 1; }
      else if (character === '"') { quoted = false; afterQuote = true; }
      else cell += character;
      continue;
    }
    if (afterQuote && character !== "," && character !== "\n" && character !== "\r") return { cells, malformed: true };
    if (character === '"') {
      if (cell.length !== 0) return { cells, malformed: true };
      quoted = true;
    } else if (character === ",") { row.push(cell); cell = ""; afterQuote = false; }
    else if (character === "\n") { row.push(cell); cells.push(row); row = []; cell = ""; afterQuote = false; }
    else if (character !== "\r") cell += character;
  }
  if (quoted) return { cells, malformed: true };
  if (cell.length !== 0 || row.length !== 0) { row.push(cell); cells.push(row); }
  return { cells, malformed: false };
}

export function normalizeImportEmail(email: string) { return email.trim().toLocaleLowerCase(); }

export function parseTargetImport(csv: string): TargetImportResult {
  if (csv.length > MAX_CSV_LENGTH) return { rows: [], errors: [{ rowNumber: null, message: "CSV file is too large." }] };
  const { cells, malformed } = readCsv(csv.replace(/^\uFEFF/, ""));
  if (malformed) return { rows: [], errors: [{ rowNumber: null, message: "CSV contains an unterminated or malformed quoted field." }] };
  if (!cells.length || cells[0]!.length !== 2 || cells[0]![0]!.trim().toLocaleLowerCase() !== "name" || cells[0]![1]!.trim().toLocaleLowerCase() !== "email") {
    return { rows: [], errors: [{ rowNumber: 1, message: "CSV headers must be exactly name,email." }] };
  }
  const data = cells.slice(1).filter((row) => row.some((cell) => cell.trim() !== ""));
  if (data.length > MAX_ROWS) return { rows: [], errors: [{ rowNumber: null, message: "CSV import is limited to 500 people." }] };
  const errors: TargetImportError[] = [];
  const rows: TargetImportRow[] = [];
  const seenEmails = new Set<string>();
  for (const [offset, row] of cells.slice(1).entries()) {
    const rowNumber = offset + 2;
    if (!row.some((cell) => cell.trim() !== "")) continue;
    if (row.length !== 2) { errors.push({ rowNumber, message: "Each row must contain exactly name and email." }); rows.push({ rowNumber, displayName: row[0]?.trim() ?? "", email: normalizeImportEmail(row[1] ?? "") }); continue; }
    const displayName = row[0]!.trim();
    const email = normalizeImportEmail(row[1]!);
    if (!displayName || displayName.length > 160) errors.push({ rowNumber, message: "Name is required and must be 160 characters or fewer." });
    if (email && !emailSchema.safeParse(email).success) errors.push({ rowNumber, message: "Email must be a valid address or blank." });
    if (email && seenEmails.has(email)) errors.push({ rowNumber, message: "Duplicate email in this CSV upload." });
    if (email) seenEmails.add(email);
    rows.push({ rowNumber, displayName, email });
  }
  return { rows, errors };
}

export const targetImportRequestSchema = z.object({ csv: z.string().min(1).max(MAX_CSV_LENGTH) }).strict();

export async function validateTargetImport(reader: { reviewTarget: { findMany(input: unknown): Promise<Array<{ email: string | null }>> } }, organizationId: string, csv: string): Promise<TargetImportResult> {
  const result = parseTargetImport(csv);
  if (result.errors.length) return result;
  const emails = [...new Set(result.rows.map(({ email }) => email).filter(Boolean))];
  if (!emails.length) return result;
  const active = await reader.reviewTarget.findMany({
    where: { organizationId, status: "ACTIVE", archivedAt: null, email: { in: emails } },
    select: { email: true },
  });
  const existing = new Set(active.flatMap(({ email }) => email ? [normalizeImportEmail(email)] : []));
  return { ...result, errors: result.rows.filter(({ email }) => email && existing.has(email)).map(({ rowNumber }) => ({ rowNumber, message: "Email already belongs to an active person." })) };
}

export async function commitTargetImport(transaction: {
  reviewTarget: { findMany(input: unknown): Promise<Array<{ email: string | null }>>; create(input: unknown): Promise<{ id: string }> };
  auditEvent: { create(input: unknown): Promise<unknown> };
}, input: { organizationId: string; actorId: string; csv: string }, assign: (targetIds: string[]) => Promise<Array<unknown>>) {
  const validated = await validateTargetImport(transaction, input.organizationId, input.csv);
  if (validated.errors.length) throw new HttpError(422, "TARGET_IMPORT_INVALID", "CSV import has validation errors.");
  const created: Array<{ id: string }> = [];
  for (const row of validated.rows) created.push(await transaction.reviewTarget.create({ data: { organizationId: input.organizationId, displayName: row.displayName, email: row.email || null }, select: { id: true } }));
  const assigned = await assign(created.map(({ id }) => id));
  await transaction.auditEvent.create({ data: { organizationId: input.organizationId, actorId: input.actorId, action: "TARGETS_IMPORTED", entityType: "ReviewTarget", entityId: null, metadata: { importedCount: created.length, assignedCount: assigned.length } } });
  return { importedCount: created.length, assignedCount: assigned.length };
}
