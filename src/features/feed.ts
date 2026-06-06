import {
  COMMENT_HEADERS,
  COMMENT_SHEET,
  GUESTS_SHEET,
  MEDIA_FOLDER_NAME,
  RSVP_HEADERS,
  RSVP_NOTIFICATION_EMAILS_PROPERTY_KEY,
  RSVP_SHEET,
  RSVP_TAB_SHEET,
  TABLE_NUMBER_SHEET
} from "../constants";
import { requirePlannerAccess } from "../auth";
import { ensureSheet, getSheetByName, readRows } from "../util/sheets";

type PublicSubmissionParams = Record<string, string | undefined>;

function toStringRecord(source: Record<string, unknown> | undefined): PublicSubmissionParams {
  return Object.entries(source || {}).reduce((acc, [key, value]) => {
    acc[key] = value == null ? "" : String(value);
    return acc;
  }, {} as PublicSubmissionParams);
}

export function listPublicFeed() {
  ensureSheet(RSVP_SHEET, RSVP_HEADERS);
  ensureSheet(COMMENT_SHEET, COMMENT_HEADERS);

  const responses = readRows(RSVP_SHEET)
    .filter((row) => String(row.Name || row.Attending || row.Comment || "").trim())
    .map((row) => ({
      submittedAt: String(row["Submitted At"] || ""),
      name: String(row.Name || ""),
      email: String(row.Email || ""),
      attending: String(row.Attending || ""),
      guests: String(row.Guests || ""),
      comment: String(row.Comment || "")
    }))
    .reverse();

  const notes = readRows(COMMENT_SHEET)
    .filter((row) => String(row.Name || row.Comment || row["Media Url"] || "").trim())
    .map((row) => ({
      name: String(row.Name || ""),
      comment: String(row.Comment || ""),
      mediaUrl: String(row["Media Url"] || ""),
      mediaType: String(row["Media Type"] || ""),
      mediaName: String(row["Media Name"] || "")
    }))
    .reverse();

  return {
    responses,
    notes,
    guests: readSheetObjects(GUESTS_SHEET)
  };
}

export function savePublicSubmission(rawParams: Record<string, unknown> | undefined) {
  const data = toStringRecord(rawParams);

  if (isCommentSubmission(data)) {
    const sheet = ensureSheet(COMMENT_SHEET, COMMENT_HEADERS);
    sheet.appendRow([
      data.submittedAt || new Date().toISOString(),
      data.name || "",
      data.comment || "",
      "",
      data.mediaType || "",
      data.mediaName || "",
      ""
    ]);

    const row = sheet.getLastRow();
    SpreadsheetApp.flush();

    const media = saveMediaFile(data);
    sheet.getRange(row, 4, 1, 4).setValues([[
      media.url || "",
      media.type || data.mediaType || "",
      media.name || data.mediaName || "",
      media.error || ""
    ]]);
  } else {
    const submittedAt = data.submittedAt || new Date().toISOString();
    ensureSheet(RSVP_SHEET, RSVP_HEADERS).appendRow([
      submittedAt,
      data.name || "",
      data.email || "",
      data.attending || "",
      data.guests || "",
      data.comment || ""
    ]);

    sendRsvpNotification({
      submittedAt,
      name: data.name || "",
      email: data.email || "",
      attending: data.attending || "",
      guests: data.guests || "",
      comment: data.comment || ""
    });
  }

  return { ok: true };
}

export function syncGuestSummarySheets() {
  requirePlannerAccess();
  const guestsSheet = getSheetByName(GUESTS_SHEET);

  if (!guestsSheet || guestsSheet.getLastRow() < 2) {
    ensureSheet(RSVP_TAB_SHEET, ["Name", "RSVP", "Plus 1 RSVP"]);
    ensureSheet(TABLE_NUMBER_SHEET, ["Name", "Table Number"]);

    return {
      ok: true,
      guestRowCount: 0,
      rsvpRowCount: 0,
      tableNumberRowCount: 0,
      matchedHeaders: {}
    };
  }

  const values = guestsSheet.getDataRange().getDisplayValues();
  const headers = values[0].map((header) => String(header || "").trim());
  const rows = values
    .slice(1)
    .filter((row) => row.some((value) => String(value || "").trim()));

  const nameIndex = findHeaderIndex(headers, [
    /^name$/i,
    /guest\s*name/i,
    /full\s*name/i
  ]);
  const rsvpIndex = findHeaderIndex(headers, [
    /^rsvp$/i,
    /^attending$/i,
    /attendance/i,
    /response/i
  ], ["plus 1"]);
  const plusOneIndex = findHeaderIndex(headers, [
    /plus\s*1.*rsvp/i,
    /rsvp.*plus\s*1/i,
    /plus\s*one.*rsvp/i,
    /^plus\s*1$/i
  ]);
  const tableNumberIndex = findHeaderIndex(headers, [
    /^table\s*number$/i,
    /^table\s*#$/i,
    /^table$/i,
    /table\s*(assignment|assigned)/i
  ]);

  const rsvpRows = rows
    .map((row) => ([
      getCell(row, nameIndex),
      getCell(row, rsvpIndex),
      getCell(row, plusOneIndex)
    ]))
    .filter((row) => row.some((value) => value));

  const tableRows = rows
    .map((row) => ([
      getCell(row, nameIndex),
      getCell(row, tableNumberIndex)
    ]))
    .filter((row) => row.some((value) => value));

  overwriteSheet(RSVP_TAB_SHEET, ["Name", "RSVP", "Plus 1 RSVP"], rsvpRows);
  overwriteSheet(TABLE_NUMBER_SHEET, ["Name", "Table Number"], tableRows);

  return {
    ok: true,
    guestRowCount: rows.length,
    rsvpRowCount: rsvpRows.length,
    tableNumberRowCount: tableRows.length,
    matchedHeaders: {
      name: headers[nameIndex] || "",
      rsvp: headers[rsvpIndex] || "",
      plusOneRsvp: headers[plusOneIndex] || "",
      tableNumber: headers[tableNumberIndex] || ""
    }
  };
}

function isCommentSubmission(data: PublicSubmissionParams) {
  if (data.formType === "note" || data.formType === "comment") {
    return true;
  }

  if (data.mediaData || data.mediaType || data.mediaName) {
    return true;
  }

  return Boolean(data.comment) && !data.attending && !data.guests;
}

function saveMediaFile(data: PublicSubmissionParams) {
  if (!data.mediaData || !data.mediaType) {
    return {};
  }

  try {
    const bytes = Utilities.base64Decode(data.mediaData);
    const name = data.mediaName || "note-upload";
    const blob = Utilities.newBlob(bytes, data.mediaType, name);
    const file = getMediaFolder().createFile(blob);

    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    return {
      url: file.getUrl(),
      type: data.mediaType,
      name
    };
  } catch (error) {
    return {
      type: data.mediaType || "",
      name: data.mediaName || "",
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

function getMediaFolder() {
  const folders = DriveApp.getFoldersByName(MEDIA_FOLDER_NAME);

  if (folders.hasNext()) {
    return folders.next();
  }

  return DriveApp.createFolder(MEDIA_FOLDER_NAME);
}

function sendRsvpNotification(rsvp: PublicSubmissionParams) {
  const recipients = getNotificationRecipients();

  if (!recipients.length) {
    return;
  }

  MailApp.sendEmail({
    to: recipients.join(","),
    subject: "New RSVP received",
    body: [
      "A new RSVP was submitted.",
      "",
      `Name: ${rsvp.name || "Guest"}`,
      `Email: ${rsvp.email || "Not provided"}`,
      `Attending: ${rsvp.attending || "Not provided"}`,
      `Guests: ${rsvp.guests || "Not provided"}`,
      `Comment: ${rsvp.comment || "None"}`,
      `Submitted At: ${rsvp.submittedAt || new Date().toISOString()}`
    ].join("\n")
  });
}

function getNotificationRecipients() {
  const value = PropertiesService.getScriptProperties().getProperty(RSVP_NOTIFICATION_EMAILS_PROPERTY_KEY) || "";

  return value
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function readSheetObjects(sheetName: string) {
  const sheet = getSheetByName(sheetName);

  if (!sheet || sheet.getLastRow() < 2) {
    return [];
  }

  const values = sheet.getDataRange().getDisplayValues();
  const headers = values[0].map((header, index) => {
    const label = String(header || "").trim();
    return label || `Column ${index + 1}`;
  });

  return values
    .slice(1)
    .map((row, index) => ({ row, rowNumber: index + 2 }))
    .filter(({ row }) => row.some((value) => String(value || "").trim()))
    .map(({ row, rowNumber }) => {
      const record = headers.reduce((nextRecord, header, index) => {
        nextRecord[header] = String(row[index] || "");
        return nextRecord;
      }, {} as Record<string, string>);
      record.__rowNumber = String(rowNumber);
      return record;
    })
    .reverse();
}

function overwriteSheet(sheetName: string, headers: string[], rows: string[][]) {
  const sheet = ensureSheet(sheetName, headers);
  const maxRows = Math.max(sheet.getLastRow(), 1);
  const maxColumns = Math.max(sheet.getLastColumn(), headers.length);

  if (maxRows > 0 && maxColumns > 0) {
    sheet.getRange(1, 1, maxRows, maxColumns).clearContent();
  }

  sheet.getRange(1, 1, 1, headers.length).setValues([headers]);

  if (rows.length) {
    sheet.getRange(2, 1, rows.length, headers.length).setValues(rows);
  }
}

function findHeaderIndex(headers: string[], patterns: RegExp[], exclusions: string[] = []) {
  const normalizedExclusions = exclusions.map((value) => value.toLowerCase());
  const matchedIndex = headers.findIndex((header) => {
    const normalizedHeader = header.toLowerCase();
    if (normalizedExclusions.some((value) => normalizedHeader.includes(value))) {
      return false;
    }
    return patterns.some((pattern) => pattern.test(header));
  });

  return matchedIndex >= 0 ? matchedIndex : -1;
}

function getCell(row: string[], index: number) {
  return index >= 0 ? String(row[index] || "").trim() : "";
}
