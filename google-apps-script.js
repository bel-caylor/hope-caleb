const RSVP_SHEET_NAME = "RSVPs";
const NOTE_SHEET_NAME = "Notes";

function doPost(e) {
  const data = e.parameter;

  if (data.formType === "note") {
    const media = saveMediaFile(data);

    getSheet(NOTE_SHEET_NAME, ["Submitted At", "Name", "Comment", "Media Url", "Media Type", "Media Name"]).appendRow([
      data.submittedAt || new Date().toISOString(),
      data.name || "",
      data.comment || "",
      media.url || "",
      media.type || "",
      media.name || ""
    ]);
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
  const noteRows = getSheet(NOTE_SHEET_NAME, ["Submitted At", "Name", "Comment", "Media Url", "Media Type", "Media Name"]).getDataRange().getValues().slice(1);

  const responses = rsvpRows
    .filter(function(row) {
      return row[1] || row[3];
    })
    .map(function(row) {
      return {
        name: row[1] || "",
        attending: row[3] || ""
      };
    })
    .reverse();

  const notes = noteRows
    .filter(function(row) {
      return row[1] || row[2];
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

function saveMediaFile(data) {
  if (!data.mediaData || !data.mediaType) {
    return {};
  }

  const bytes = Utilities.base64Decode(data.mediaData);
  const name = data.mediaName || "note-upload";
  const blob = Utilities.newBlob(bytes, data.mediaType, name);
  const file = DriveApp.createFile(blob);

  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  return {
    url: file.getUrl(),
    type: data.mediaType,
    name: name
  };
}

function getSheet(sheetName, headers) {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(sheetName);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(sheetName);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }

  return sheet;
}
