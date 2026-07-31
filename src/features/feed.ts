import {
  COMMENT_HEADERS,
  COMMENT_SHEET,
  GROUP_HEADERS,
  GROUPS_SHEET,
  GUESTS_SHEET,
  MEDIA_FOLDER_NAME,
  RSVP_HEADERS,
  RSVP_NOTIFICATION_EMAILS_PROPERTY_KEY,
  RSVP_SHEET,
  RSVP_TAB_SHEET,
  TABLE_NUMBER_SHEET
} from "../constants";
import { requirePlannerAccess, requireScriptEditorAccess } from "../auth";
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
    guests: readPublicGuestLookupRows(),
    groups: readPublicGroupLookupRows()
  };
}

export function lookupPublicRsvpGroups(firstNameRaw: string | undefined, lastNameRaw: string | undefined) {
  const firstName = normalizeLookupNamePart(firstNameRaw || "");
  const lastName = normalizeLookupNamePart(lastNameRaw || "");

  if (!firstName || !lastName) {
    return { matches: [] };
  }

  const guests = readPublicGuestLookupRows().map((guest) => ({
    ...guest,
    firstName: normalizeLookupNamePart(guest.firstName || extractFirstName(guest.name || "")),
    lastName: normalizeLookupNamePart(guest.lastName || extractLastName(guest.name || ""))
  }));
  const groups = readPublicGroupLookupRows();
  const matches = buildLookupMatchesForName(firstName, lastName, guests, groups);

  return { matches };
}

export function savePublicSubmission(rawParams: Record<string, unknown> | undefined) {
  const data = toStringRecord(rawParams);

  if (isGroupRsvpSubmission(data)) {
    return saveGroupRsvpSubmission(data);
  }

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
      data.formType || "rsvp",
      data.name || "",
      data.email || "",
      data.attending || "",
      data.guests || "",
      data.comment || "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      ""
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

export function syncGroupsSheet() {
  requirePlannerAccess();
  return syncGroupsSheetInternal();
}

export function syncGroupsSheetForEditor() {
  requireScriptEditorAccess();
  return syncGroupsSheetInternal();
}

function syncGroupsSheetInternal() {
  const guestsSheet = getSheetByName(GUESTS_SHEET);

  if (!guestsSheet || guestsSheet.getLastRow() < 2) {
    ensureSheet(GROUPS_SHEET, GROUP_HEADERS);
    overwriteSheet(GROUPS_SHEET, GROUP_HEADERS, []);
    return {
      ok: true,
      guestRowCount: 0,
      groupRowCount: 0
    };
  }

  const values = guestsSheet.getDataRange().getDisplayValues();
  const headers = values[0].map((header) => String(header || "").trim());
  const rows = values
    .slice(1)
    .filter((row) => row.some((value) => String(value || "").trim()));

  const groupIndex = findHeaderIndex(headers, [/^group$/i, /group\s*(name|id)/i]);
  if (groupIndex < 0) {
    throw new Error("Guests sheet is missing the Group column.");
  }

  const nameIndex = findHeaderIndex(headers, [/^wedding\s*guest$/i, /^name$/i, /guest\s*name/i, /full\s*name/i]);
  const emailIndex = findHeaderIndex(headers, [/^email$/i, /e-?mail/i]);
  const phoneIndex = findHeaderIndex(headers, [/^phone/i, /cell/i, /mobile/i]);
  const typeIndex = findHeaderIndex(headers, [/^type$/i, /guest\s*type/i]);
  const plusOneIndex = findHeaderIndex(headers, [/^#\s*of\s*plu/i, /plus\s*one/i], ["rsvp"]);
  const childrenIndex = findHeaderIndex(headers, [/^#\s*children$/i, /^#\s*o$/i, /^#\s*of\s*(chi|kid)/i, /children/i], ["policy"]);

  const groups = new Map<string, {
    groupName: string;
    displayName: string;
    primaryContact: string;
    email: string;
    phone: string;
    invitedRehearsal: boolean;
    invitedOpenHouse: boolean;
    childrenCount: number;
    maxPlusOnes: number;
  }>();

  rows.forEach((row) => {
    const rawGroup = getCell(row, groupIndex);
    if (!rawGroup) {
      return;
    }

    const name = getCell(row, nameIndex);
    const email = getCell(row, emailIndex);
    const phone = getCell(row, phoneIndex);
    const type = getCell(row, typeIndex);
    const plusOneCount = normalizeWholeNumber(getCell(row, plusOneIndex));
    const childrenCount = normalizeWholeNumber(getCell(row, childrenIndex));
    const existing = groups.get(rawGroup);

    if (!existing) {
      groups.set(rawGroup, {
        groupName: rawGroup,
        displayName: buildDisplayName(rawGroup, name),
        primaryContact: name,
        email,
        phone,
        invitedRehearsal: isSpecialEventInviteType(type),
        invitedOpenHouse: isSpecialEventInviteType(type),
        childrenCount,
        maxPlusOnes: plusOneCount
      });
      return;
    }

    if (!existing.primaryContact && name) {
      existing.primaryContact = name;
    }
    if (!existing.email && email) {
      existing.email = email;
    }
    if (!existing.phone && phone) {
      existing.phone = phone;
    }
    if ((!existing.displayName || existing.displayName === existing.groupName) && name) {
      existing.displayName = buildDisplayName(rawGroup, name);
    }

    existing.invitedRehearsal = existing.invitedRehearsal || isSpecialEventInviteType(type);
    existing.invitedOpenHouse = existing.invitedOpenHouse || isSpecialEventInviteType(type);
    existing.childrenCount += childrenCount;
    existing.maxPlusOnes += plusOneCount;
  });

  const now = new Date().toISOString();
  const groupRows = Array.from(groups.values())
    .sort((a, b) => a.groupName.localeCompare(b.groupName))
    .map((group) => ([
      group.groupName,
      group.displayName,
      group.primaryContact,
      group.email,
      group.phone,
      group.invitedRehearsal ? "Yes" : "No",
      group.invitedOpenHouse ? "Yes" : "No",
      String(group.childrenCount),
      String(group.maxPlusOnes),
      buildLookupCode(group.groupName),
      "Pending",
      group.invitedRehearsal ? "Pending" : "",
      group.invitedOpenHouse ? "Pending" : "",
      "",
      now
    ]));

  overwriteSheet(GROUPS_SHEET, GROUP_HEADERS, groupRows);

  return {
    ok: true,
    guestRowCount: rows.length,
    groupRowCount: groupRows.length
  };
}

type ParsedGroupRsvpSubmission = {
  submittedAt: string;
  groupName: string;
  lookupGuestFirstName: string;
  lookupGuestLastName: string;
  contactName: string;
  email: string;
  weddingSelections: Record<string, string>;
  weddingAttendingCount: number;
  plusOneCount: number;
  plusOneName: string;
  childrenCount: number;
  childrenNote: string;
  rehearsalRsvp: string;
  openHouseRsvp: string;
  comment: string;
};

function isGroupRsvpSubmission(data: PublicSubmissionParams) {
  return String(data.formType || "").trim().toLowerCase() === "group-rsvp";
}

function saveGroupRsvpSubmission(data: PublicSubmissionParams) {
  const submission = parseGroupRsvpSubmission(data);
  const guestsSheet = getSheetByName(GUESTS_SHEET);
  const groupsSheet = ensureSheet(GROUPS_SHEET, GROUP_HEADERS);

  if (!guestsSheet || guestsSheet.getLastRow() < 2) {
    throw new Error("Guests sheet not found.");
  }

  if (!groupsSheet || groupsSheet.getLastRow() < 2) {
    throw new Error("Groups sheet not found.");
  }

  const guestResult = updateGuestRowsForGroupRsvp(guestsSheet, submission);
  const groupResult = updateGroupRowForRsvp(groupsSheet, submission, guestResult);
  appendStructuredRsvpRow(submission, guestResult);
  sendRsvpNotification({
    submittedAt: submission.submittedAt,
    name: submission.contactName || submission.groupName,
    email: submission.email,
    attending: groupResult.weddingRsvpSummary,
    guests: String(guestResult.weddingAttendingCount + submission.plusOneCount + submission.childrenCount),
    comment: buildGroupRsvpNotificationComment(submission, guestResult),
    group: submission.groupName,
    rehearsalRsvp: submission.rehearsalRsvp,
    openHouseRsvp: submission.openHouseRsvp
  });

  return {
    ok: true,
    group: submission.groupName,
    weddingAttendingCount: guestResult.weddingAttendingCount,
    plusOneCount: submission.plusOneCount,
    childrenCount: submission.childrenCount
  };
}

function parseGroupRsvpSubmission(data: PublicSubmissionParams): ParsedGroupRsvpSubmission {
  const groupName = String(data.group || "").trim();
  if (!groupName) {
    throw new Error("Missing group name.");
  }

  const weddingSelections = parseJsonRecord(data.weddingSelections);
  const weddingAttendingCount = Object.values(weddingSelections).filter((value) => normalizeRsvpAnswer(value) === "attending").length;

  return {
    submittedAt: String(data.submittedAt || new Date().toISOString()).trim(),
    groupName,
    lookupGuestFirstName: String(data.lookupFirstName || "").trim(),
    lookupGuestLastName: String(data.lookupLastName || "").trim(),
    contactName: String(data.contactName || "").trim(),
    email: String(data.email || "").trim(),
    weddingSelections,
    weddingAttendingCount,
    plusOneCount: normalizeWholeNumber(String(data.plusOneCount || "")),
    plusOneName: String(data.plusOneName || "").trim(),
    childrenCount: normalizeWholeNumber(String(data.childrenCount || "")),
    childrenNote: String(data.childrenNote || "").trim(),
    rehearsalRsvp: normalizeRsvpAnswer(String(data.rehearsalRsvp || "")),
    openHouseRsvp: normalizeRsvpAnswer(String(data.openHouseRsvp || "")),
    comment: String(data.comment || "").trim()
  };
}

function parseJsonRecord(rawValue: string | undefined) {
  const raw = String(rawValue || "").trim();
  if (!raw) {
    return {} as Record<string, string>;
  }

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    return Object.entries(parsed).reduce((acc, [key, value]) => {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey) {
        return acc;
      }

      acc[normalizedKey] = String(value || "").trim();
      return acc;
    }, {} as Record<string, string>);
  } catch (_) {
    throw new Error("Wedding selections could not be read.");
  }
}

function updateGuestRowsForGroupRsvp(
  guestsSheet: GoogleAppsScript.Spreadsheet.Sheet,
  submission: ParsedGroupRsvpSubmission
) {
  const values = guestsSheet.getDataRange().getDisplayValues();
  const headers = values[0].map((header) => String(header || "").trim());
  const rows = values.slice(1);

  const groupIndex = findHeaderIndex(headers, [/^group$/i, /group\s*(name|id)/i]);
  const nameIndex = findHeaderIndex(headers, [/^wedding\s*guest$/i, /^name$/i, /guest\s*name/i, /full\s*name/i]);
  const rsvpIndex = findHeaderIndex(headers, [/^rsvp$/i, /^attending$/i, /attendance/i, /response/i], ["plus 1"]);
  const plusAllowedIndex = findHeaderIndex(headers, [/^#\s*of\s*plu/i, /plus\s*one/i], ["rsvp"]);
  const plusRsvpIndex = findHeaderIndex(headers, [/plus\s*1.*rsvp/i, /rsvp.*plus\s*1/i, /plus\s*one.*rsvp/i, /^plus\s*1$/i]);

  if (groupIndex < 0 || nameIndex < 0 || rsvpIndex < 0) {
    throw new Error("Guests sheet is missing Group, Wedding Guest, or RSVP columns.");
  }

  let remainingPlusOnes = submission.plusOneCount;
  let weddingAttendingCount = 0;
  let matchedGuestCount = 0;

  rows.forEach((row, rowIndex) => {
    if (getCell(row, groupIndex) !== submission.groupName) {
      return;
    }

    const rowNumber = rowIndex + 2;
    const guestName = getCell(row, nameIndex);
    matchedGuestCount += 1;
    const selectedAnswer = normalizeRsvpAnswer(submission.weddingSelections[guestName] || "");
    const guestRsvpValue = selectedAnswer === "attending"
      ? "Attending"
      : selectedAnswer === "not-attending"
        ? "Not Attending"
        : "Pending";

    guestsSheet.getRange(rowNumber, rsvpIndex + 1).setValue(guestRsvpValue);

    if (selectedAnswer === "attending") {
      weddingAttendingCount += 1;
    }

    if (plusRsvpIndex >= 0 && plusAllowedIndex >= 0) {
      const allowedPlusOnes = normalizeWholeNumber(getCell(row, plusAllowedIndex));
      if (allowedPlusOnes > 0) {
        const assignedPlusOnes = Math.min(remainingPlusOnes, allowedPlusOnes);
        const plusRsvpValue = assignedPlusOnes > 0 ? "Attending" : "No Plus 1";
        guestsSheet.getRange(rowNumber, plusRsvpIndex + 1).setValue(plusRsvpValue);
        remainingPlusOnes -= assignedPlusOnes;
      } else {
        guestsSheet.getRange(rowNumber, plusRsvpIndex + 1).setValue("No Plus 1");
      }
    }
  });

  if (!matchedGuestCount) {
    throw new Error("Could not find that group in the Guests sheet.");
  }

  return {
    weddingAttendingCount,
    matchedGuestCount
  };
}

function updateGroupRowForRsvp(
  groupsSheet: GoogleAppsScript.Spreadsheet.Sheet,
  submission: ParsedGroupRsvpSubmission,
  guestResult: { weddingAttendingCount: number; matchedGuestCount: number }
) {
  const values = groupsSheet.getDataRange().getDisplayValues();
  const headers = values[0].map((header) => String(header || "").trim());
  const groupIndex = findHeaderIndex(headers, [/^group$/i, /group\s*(name|id)/i]);
  const weddingRsvpIndex = findHeaderIndex(headers, [/^wedding\s*rsvp$/i, /^rsvp$/i]);
  const rehearsalRsvpIndex = findHeaderIndex(headers, [/^rehearsal\s*rsvp$/i]);
  const openHouseRsvpIndex = findHeaderIndex(headers, [/^open\s*house\s*rsvp$/i]);
  const notesIndex = findHeaderIndex(headers, [/^notes$/i, /comment/i]);
  const updatedIndex = findHeaderIndex(headers, [/^last\s*updated$/i, /^updated/i]);
  const emailIndex = findHeaderIndex(headers, [/^email$/i, /e-?mail/i]);

  if (groupIndex < 0 || weddingRsvpIndex < 0) {
    throw new Error("Groups sheet is missing Group or Wedding RSVP columns.");
  }

  const targetRowIndex = values.findIndex((row, index) => index > 0 && getCell(row, groupIndex) === submission.groupName);
  if (targetRowIndex < 0) {
    throw new Error("Could not find that group in the Groups sheet.");
  }

  const rowNumber = targetRowIndex + 1;
  const weddingRsvpSummary = guestResult.weddingAttendingCount === 0
    ? "Not Attending"
    : guestResult.weddingAttendingCount === guestResult.matchedGuestCount
      ? "Attending"
      : "Partial";

  groupsSheet.getRange(rowNumber, weddingRsvpIndex + 1).setValue(weddingRsvpSummary);

  if (rehearsalRsvpIndex >= 0 && submission.rehearsalRsvp) {
    groupsSheet.getRange(rowNumber, rehearsalRsvpIndex + 1).setValue(formatRsvpLabel(submission.rehearsalRsvp));
  }

  if (openHouseRsvpIndex >= 0 && submission.openHouseRsvp) {
    groupsSheet.getRange(rowNumber, openHouseRsvpIndex + 1).setValue(formatRsvpLabel(submission.openHouseRsvp));
  }

  if (notesIndex >= 0) {
    groupsSheet.getRange(rowNumber, notesIndex + 1).setValue(buildGroupNotesSummary(submission, guestResult));
  }

  if (updatedIndex >= 0) {
    groupsSheet.getRange(rowNumber, updatedIndex + 1).setValue(submission.submittedAt);
  }

  if (emailIndex >= 0 && submission.email) {
    groupsSheet.getRange(rowNumber, emailIndex + 1).setValue(submission.email);
  }

  return {
    weddingRsvpSummary
  };
}

function appendStructuredRsvpRow(
  submission: ParsedGroupRsvpSubmission,
  guestResult: { weddingAttendingCount: number; matchedGuestCount: number }
) {
  ensureSheet(RSVP_SHEET, RSVP_HEADERS).appendRow([
    submission.submittedAt,
    "group-rsvp",
    submission.contactName || submission.groupName,
    submission.email,
    guestResult.weddingAttendingCount > 0 ? "Yes" : "No",
    String(guestResult.weddingAttendingCount + submission.plusOneCount + submission.childrenCount),
    submission.comment,
    submission.groupName,
    Object.keys(submission.weddingSelections)
      .map((guestName) => `${guestName}: ${formatRsvpLabel(submission.weddingSelections[guestName])}`)
      .join(" | "),
    guestResult.weddingAttendingCount === 0
      ? "Not Attending"
      : guestResult.weddingAttendingCount === guestResult.matchedGuestCount
        ? "Attending"
        : "Partial",
    formatRsvpLabel(submission.rehearsalRsvp),
    formatRsvpLabel(submission.openHouseRsvp),
    String(submission.plusOneCount),
    submission.plusOneName,
    String(submission.childrenCount),
    submission.childrenNote
  ]);
}

function buildGroupNotesSummary(
  submission: ParsedGroupRsvpSubmission,
  guestResult: { weddingAttendingCount: number; matchedGuestCount: number }
) {
  const parts = [
    `Lookup: ${[submission.lookupGuestFirstName, submission.lookupGuestLastName].filter(Boolean).join(" ").trim() || submission.groupName}`,
    `Wedding attending: ${guestResult.weddingAttendingCount}/${guestResult.matchedGuestCount}`
  ];

  if (submission.plusOneCount > 0) {
    parts.push(`Plus one count: ${submission.plusOneCount}${submission.plusOneName ? ` (${submission.plusOneName})` : ""}`);
  }

  if (submission.childrenCount > 0) {
    parts.push(`Children attending: ${submission.childrenCount}${submission.childrenNote ? ` (${submission.childrenNote})` : ""}`);
  }

  if (submission.rehearsalRsvp) {
    parts.push(`Rehearsal: ${formatRsvpLabel(submission.rehearsalRsvp)}`);
  }

  if (submission.openHouseRsvp) {
    parts.push(`Open house: ${formatRsvpLabel(submission.openHouseRsvp)}`);
  }

  if (submission.comment) {
    parts.push(`Note: ${submission.comment}`);
  }

  return parts.join(" | ");
}

function buildGroupRsvpNotificationComment(
  submission: ParsedGroupRsvpSubmission,
  guestResult: { weddingAttendingCount: number; matchedGuestCount: number }
) {
  return buildGroupNotesSummary(submission, guestResult);
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

function readPublicGuestLookupRows() {
  const rows = readSheetObjects(GUESTS_SHEET);

  return rows.map((row) => ({
    rowNumber: String(row.__rowNumber || ""),
    name: firstNonEmptyValue(row, [/^wedding\s*guest$/i, /^name$/i, /guest\s*name/i, /full\s*name/i]),
    firstName: extractFirstName(firstNonEmptyValue(row, [/^wedding\s*guest$/i, /^name$/i, /guest\s*name/i, /full\s*name/i])),
    lastName: firstNonEmptyValue(row, [/^last\s*name$/i]),
    group: firstNonEmptyValue(row, [/^group$/i, /group\s*(name|id)/i]),
    type: firstNonEmptyValue(row, [/^type$/i, /guest\s*type/i]),
    plusOnesAllowed: firstNonEmptyValue(row, [/^#\s*of\s*plu/i, /plus\s*one/i], ["rsvp"]),
    childrenAllowed: firstNonEmptyValue(row, [/^#\s*o$/i, /^#\s*of\s*(chi|kid)/i, /children/i], ["policy"]),
    rsvp: firstNonEmptyValue(row, [/^rsvp$/i, /^attending$/i, /attendance/i, /response/i], ["plus 1"]),
    plusOneRsvp: firstNonEmptyValue(row, [/plus\s*1.*rsvp/i, /rsvp.*plus\s*1/i, /plus\s*one.*rsvp/i, /^plus\s*1$/i])
  }));
}

function readPublicGroupLookupRows() {
  const rows = readSheetObjects(GROUPS_SHEET);
  const latestGroupRsvps = readLatestGroupRsvpMap();

  return rows.map((row) => ({
    ...latestGroupRsvps.get(firstNonEmptyValue(row, [/^group$/i, /group\s*(name|id)/i])) || {},
    rowNumber: String(row.__rowNumber || ""),
    group: firstNonEmptyValue(row, [/^group$/i, /group\s*(name|id)/i]),
    displayName: firstNonEmptyValue(row, [/^display\s*name$/i, /invitation/i]),
    primaryContact: firstNonEmptyValue(row, [/^primary\s*contact$/i, /^contact$/i]),
    email: firstNonEmptyValue(row, [/^email$/i, /e-?mail/i]),
    phone: firstNonEmptyValue(row, [/^phone/i, /mobile/i, /cell/i]),
    invitedRehearsal: firstNonEmptyValue(row, [/^invited\s*rehearsal$/i]),
    invitedOpenHouse: firstNonEmptyValue(row, [/^invited\s*open\s*house$/i]),
    childrenCount: firstNonEmptyValue(row, [/^(invited\s*)?#\s*(of\s*)?(children|child|kids?)$/i, /^children$/i, /children\s*count/i, /invited.*children/i]),
    maxPlusOnes: firstNonEmptyValue(row, [/^max\s*plus\s*ones$/i, /plus\s*ones/i]),
    weddingRsvp: firstNonEmptyValue(row, [/^wedding\s*rsvp$/i, /^rsvp$/i]),
    rehearsalRsvp: firstNonEmptyValue(row, [/^rehearsal\s*rsvp$/i]),
    openHouseRsvp: firstNonEmptyValue(row, [/^open\s*house\s*rsvp$/i]),
    notes: firstNonEmptyValue(row, [/^notes$/i, /comment/i]),
    lookupCode: firstNonEmptyValue(row, [/^lookup\s*code$/i])
  }));
}

function buildLookupMatchesForName(
  firstName: string,
  lastName: string,
  guests: Array<Record<string, string>>,
  groups: Array<Record<string, string>>
) {
  const exactGuests = guests.filter((guest) => (
    String(guest.group || "").trim()
    && String(guest.lastName || "").trim() === lastName
    && String(guest.firstName || "").trim() === firstName
  ));

  const fallbackGuests = exactGuests.length
    ? []
    : guests.filter((guest) => String(guest.group || "").trim() && String(guest.lastName || "").trim() === lastName);

  const sourceGuests = exactGuests.length ? exactGuests : fallbackGuests;
  const uniqueGroups = new Map<string, Record<string, unknown>>();

  sourceGuests.forEach((guest) => {
    const groupName = String(guest.group || "").trim();
    if (!groupName || uniqueGroups.has(groupName)) {
      return;
    }

    const groupRecord = getPublicLookupGroupRecord(groupName, guests, groups);
    if (!groupRecord) {
      return;
    }

    uniqueGroups.set(groupName, groupRecord);
  });

  return Array.from(uniqueGroups.values());
}

function getPublicLookupGroupRecord(
  groupName: string,
  guests: Array<Record<string, string>>,
  groups: Array<Record<string, string>>
) {
  const members = guests
    .filter((guest) => String(guest.group || "").trim() === groupName)
    .sort((a, b) => String(a.name || "").localeCompare(String(b.name || "")));

  if (!members.length) {
    return null;
  }

  const fromSheet = groups.find((group) => String(group.group || "").trim() === groupName);
  if (fromSheet) {
    return {
      ...fromSheet,
      members
    };
  }

  return {
    group: groupName,
    displayName: String(groupName || "").replace(/[_-]+/g, " "),
    primaryContact: String(members[0]?.name || "").trim(),
    email: "",
    phone: "",
    invitedRehearsal: "No",
    invitedOpenHouse: "No",
    childrenCount: String(members.reduce((sum, member) => sum + normalizeWholeNumber(String(member.childrenAllowed || "")), 0)),
    maxPlusOnes: String(members.reduce((sum, member) => sum + normalizeWholeNumber(String(member.plusOnesAllowed || "")), 0)),
    weddingRsvp: "",
    rehearsalRsvp: "",
    openHouseRsvp: "",
    savedEmail: "",
    savedComment: "",
    savedPlusOneCount: "0",
    savedPlusOneName: "",
    savedChildrenCount: "0",
    savedChildrenNote: "",
    notes: "",
    lookupCode: "",
    members
  };
}

function readLatestGroupRsvpMap() {
  const rows = readRows(RSVP_SHEET);
  const latestByGroup = new Map<string, Record<string, string>>();

  rows.forEach((row) => {
    const formType = String(row["Form Type"] || "").trim().toLowerCase();
    const groupName = String(row.Group || "").trim();
    if (formType !== "group-rsvp" || !groupName) {
      return;
    }

    latestByGroup.set(groupName, {
      savedEmail: String(row.Email || "").trim(),
      savedComment: String(row.Comment || "").trim(),
      savedWeddingRsvp: String(row["Wedding RSVP Summary"] || "").trim(),
      savedRehearsalRsvp: String(row["Rehearsal RSVP"] || "").trim(),
      savedOpenHouseRsvp: String(row["Open House RSVP"] || "").trim(),
      savedPlusOneCount: String(row["Plus One Count"] || "").trim(),
      savedPlusOneName: String(row["Plus One Name"] || "").trim(),
      savedChildrenCount: String(row["Children Count"] || "").trim(),
      savedChildrenNote: String(row["Children Note"] || "").trim()
    });
  });

  return latestByGroup;
}

function firstNonEmptyValue(record: Record<string, string>, patterns: RegExp[], exclusions: string[] = []) {
  const entries = Object.entries(record);
  const normalizedExclusions = exclusions.map((value) => value.toLowerCase());

  for (const [key, value] of entries) {
    if (key === "__rowNumber") {
      continue;
    }

    const normalizedKey = key.toLowerCase();
    if (normalizedExclusions.some((item) => normalizedKey.includes(item))) {
      continue;
    }

    if (patterns.some((pattern) => pattern.test(key))) {
      return String(value || "").trim();
    }
  }

  return "";
}

function normalizeWholeNumber(value: string) {
  const numericValue = Number(String(value || "").replace(/[^\d.-]/g, ""));
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return 0;
  }

  return Math.floor(numericValue);
}

function isSpecialEventInviteType(type: string) {
  const normalizedType = String(type || "").trim().toLowerCase();
  if (!normalizedType) {
    return false;
  }

  return /wedding\s*party/.test(normalizedType) || /(oot|ott)\s+(caylor|kaler)/.test(normalizedType);
}

function buildDisplayName(groupName: string, contactName: string) {
  const normalizedContact = String(contactName || "").trim();
  if (normalizedContact) {
    return normalizedContact;
  }

  return String(groupName || "")
    .trim()
    .replace(/[_-]+/g, " ");
}

function buildLookupCode(groupName: string) {
  const normalized = String(groupName || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

  return normalized.slice(0, 24);
}

function extractFirstName(fullName: string) {
  return String(fullName || "").trim().split(/\s+/).filter(Boolean)[0] || "";
}

function extractLastName(fullName: string) {
  const parts = String(fullName || "").trim().split(/\s+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : "";
}

function normalizeLookupNamePart(value: string) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9'-]+/g, " ");
}

function normalizeRsvpAnswer(value: string) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return "";
  }

  if (["yes", "y", "attending", "accept", "accepted"].includes(normalized)) {
    return "attending";
  }

  if (["no", "n", "not attending", "declined", "decline"].includes(normalized)) {
    return "not-attending";
  }

  if (["maybe", "pending"].includes(normalized)) {
    return "pending";
  }

  return normalized;
}

function formatRsvpLabel(value: string) {
  const normalized = normalizeRsvpAnswer(value);
  if (normalized === "attending") {
    return "Attending";
  }
  if (normalized === "not-attending") {
    return "Not Attending";
  }
  if (normalized === "pending") {
    return "Pending";
  }

  return String(value || "").trim();
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
