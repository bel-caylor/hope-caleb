import type { PlannerRow } from "../constants";

export function ensureSheet(name: string, headers: string[]) {
  const ss = SpreadsheetApp.getActive();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), headers.length)).getValues()[0].map(String);
    headers.forEach((header, index) => {
      if (existing[index] !== header) {
        sheet!.getRange(1, index + 1).setValue(header);
      }
    });
  }

  return sheet;
}

export function readRows(sheetName: string): PlannerRow[] {
  const sheet = SpreadsheetApp.getActive().getSheetByName(sheetName);
  if (!sheet || sheet.getLastRow() < 2) return [];

  const values = sheet.getDataRange().getValues();
  const headers = values.shift()!.map((header) => String(header || "").trim());

  return values.map((row) => {
    const record: PlannerRow = {};
    headers.forEach((header, index) => {
      record[header] = row[index];
    });
    return record;
  });
}

export function upsertRow(sheetName: string, headers: string[], id: string, values: PlannerRow) {
  const sheet = ensureSheet(sheetName, headers);
  const rows = sheet.getDataRange().getValues();
  const idIndex = headers.indexOf("Id");
  const targetRow = rows.findIndex((row, index) => index > 0 && String(row[idIndex] || "").trim() === id);
  const normalized = headers.map((header) => values[header] ?? "");

  if (targetRow >= 0) {
    sheet.getRange(targetRow + 1, 1, 1, headers.length).setValues([normalized]);
    return targetRow + 1;
  }

  sheet.appendRow(normalized);
  return sheet.getLastRow();
}

export function toIsoString(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString();
  }
  const raw = String(value || "").trim();
  if (!raw) return "";
  const date = new Date(raw);
  return Number.isNaN(date.getTime()) ? raw : date.toISOString();
}

export function createId(prefix: string) {
  return `${prefix}_${Utilities.getUuid().slice(0, 8)}`;
}
