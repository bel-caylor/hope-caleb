const RSVP_SHEET_NAME = "RSVPs";
const COMMENT_SHEET_NAME = "Comments";
const MEDIA_FOLDER_NAME = "H&C Grad";

function doPost(e) {
  const data = e.parameter;

  if (isCommentSubmission(data)) {
    const sheet = getSheet(COMMENT_SHEET_NAME, ["Submitted At", "Name", "Comment", "Media Url", "Media Type", "Media Name", "Media Error"]);
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
    getSheet(RSVP_SHEET_NAME, ["Submitted At", "Name", "Email", "Attending", "Guests", "Comment"]).appendRow([
      data.submittedAt || new Date().toISOString(),
      data.name || "",
      data.email || "",
      data.attending || "",
      data.guests || "",
      data.comment || ""
    ]);
  }

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const rsvpRows = getSheet(RSVP_SHEET_NAME, ["Submitted At", "Name", "Email", "Attending", "Guests", "Comment"]).getDataRange().getValues().slice(1);
  const commentRows = getSheet(COMMENT_SHEET_NAME, ["Submitted At", "Name", "Comment", "Media Url", "Media Type", "Media Name", "Media Error"]).getDataRange().getValues().slice(1);

  const responses = rsvpRows
    .filter(function(row) {
      return row[1] || row[3] || row[5];
    })
    .map(function(row) {
      return {
        name: row[1] || "",
        attending: row[3] || "",
        comment: row[5] || ""
      };
    })
    .reverse();

  const notes = commentRows
    .filter(function(row) {
      return row[1] || row[2] || row[3];
    })
    .map(function(row) {
      return {
        name: row[1] || "",
        comment: row[2] || "",
        mediaUrl: row[3] || "",
        mediaType: row[4] || "",
        mediaName: row[5] || ""
      };
    })
    .reverse();

  const output = JSON.stringify({ responses: responses, notes: notes });
  const callback = e && e.parameter && e.parameter.callback;

  if (callback) {
    return ContentService
      .createTextOutput(callback + "(" + output + ");")
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function isCommentSubmission(data) {
  if (data.formType === "note" || data.formType === "comment") {
    return true;
  }

  if (data.mediaData || data.mediaType || data.mediaName) {
    return true;
  }

  return Boolean(data.comment) && !data.attending && !data.guests;
}

function saveMediaFile(data) {
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
      name: name
    };
  } catch (error) {
    return {
      type: data.mediaType || "",
      name: data.mediaName || "",
      error: error && error.message ? error.message : String(error)
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

function getSheet(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  } else if (sheet.getLastColumn() < headers.length) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
  }

  return sheet;
}
