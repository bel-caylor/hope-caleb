import { SPREADSHEET_ID_PROPERTY_KEY, type PlannerRow } from "../constants";

function getSpreadsheet() {
  const configuredId = String(
    PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY_KEY) || ""
  ).trim();

  if (configuredId) {
    return SpreadsheetApp.openById(configuredId);
  }

  return SpreadsheetApp.getActive();
}

export function ensureSheet(name: string, headers: string[]) {
  const ss = getSpreadsheet();
  let sheet = ss.getSheetByName(name);

  if (!sheet) {
    sheet = ss.insertSheet(name);
  }

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  } else {
    const existing = sheet
      .getRange(1, 1, 1, Math.max(sheet.getLastColumn(), 1))
      .getValues()[0]
      .map((value) => String(value || "").trim());

    headers.forEach((header) => {
      if (existing.includes(header)) {
        return;
      }

      const nextColumn = sheet!.getLastColumn() + 1;
      sheet!.getRange(1, nextColumn).setValue(header);
      existing.push(header);
    });
  }

  return sheet;
}

export function readRows(sheetName: string): PlannerRow[] {
  const sheet = getSpreadsheet().getSheetByName(sheetName);
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

export function getSheetByName(sheetName: string) {
  return getSpreadsheet().getSheetByName(sheetName);
}

/** Serializes an entire spreadsheet read/validate/write transaction. */
export function withSpreadsheetWriteLock<T>(operation: () => T): T {
  const lock = LockService.getScriptLock();
  try {
    lock.waitLock(25_000);
  } catch (_) {
    throw new Error("Another planner save is still finishing. Please try again in a moment.");
  }

  try {
    return operation();
  } finally {
    lock.releaseLock();
  }
}

export function upsertRow(sheetName: string, headers: string[], id: string, values: PlannerRow) {
  const sheet = ensureSheet(sheetName, headers);
  const rows = sheet.getDataRange().getValues();
  const actualHeaders = rows[0].map((header) => String(header || "").trim());
  const idIndex = actualHeaders.indexOf("Id");
  if (idIndex < 0) {
    throw new Error(`${sheetName} sheet is missing the Id column.`);
  }

  const targetRow = rows.findIndex((row, index) => index > 0 && String(row[idIndex] || "").trim() === id);
  const existingRow = targetRow >= 0 ? rows[targetRow] : null;
  const normalized = actualHeaders.map((header, index) => {
    if (Object.prototype.hasOwnProperty.call(values, header)) {
      return values[header] ?? "";
    }

    return existingRow ? existingRow[index] ?? "" : "";
  });

  if (targetRow >= 0) {
    sheet.getRange(targetRow + 1, 1, 1, actualHeaders.length).setValues([normalized]);
    return targetRow + 1;
  }

  sheet.appendRow(normalized);
  return sheet.getLastRow();
}

export function deleteRowById(sheetName: string, headers: string[], id: string) {
  const sheet = ensureSheet(sheetName, headers);
  const rows = sheet.getDataRange().getValues();
  const actualHeaders = rows[0].map((header) => String(header || "").trim());
  const idIndex = actualHeaders.indexOf("Id");
  if (idIndex < 0) {
    throw new Error(`${sheetName} sheet is missing the Id column.`);
  }

  const targetRow = rows.findIndex((row, index) => index > 0 && String(row[idIndex] || "").trim() === id);
  if (targetRow < 0) {
    throw new Error(`${sheetName} row not found.`);
  }

  sheet.deleteRow(targetRow + 1);
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
