import {
  COMMENT_HEADERS,
  COMMENT_SHEET,
  GUESTS_SHEET,
  MEDIA_FOLDER_NAME,
  RSVP_HEADERS,
  RSVP_NOTIFICATION_EMAILS_PROPERTY_KEY,
  RSVP_SHEET
} from "../constants";
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
    .filter((row) => row.some((value) => String(value || "").trim()))
    .map((row) => headers.reduce((record, header, index) => {
      record[header] = String(row[index] || "");
      return record;
    }, {} as Record<string, string>))
    .reverse();
}
