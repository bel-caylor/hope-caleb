const SHEET_NAME = "RSVPs";

function doPost(e) {
  const sheet = getSheet();
  const data = e.parameter;

  sheet.appendRow([
    data.submittedAt || new Date().toISOString(),
    data.name || "",
    data.email || "",
    data.attending || "",
    data.guests || "",
    data.comment || ""
  ]);

  return ContentService
    .createTextOutput(JSON.stringify({ ok: true }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doGet(e) {
  const rows = getSheet().getDataRange().getValues().slice(1);
  const responses = rows
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

  const output = JSON.stringify({ responses: responses });
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

function getSheet() {
  const spreadsheet = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = spreadsheet.getSheetByName(SHEET_NAME);

  if (!sheet) {
    sheet = spreadsheet.insertSheet(SHEET_NAME);
  }

  if (sheet.getLastRow() === 0) {
    sheet.appendRow(["Submitted At", "Name", "Email", "Attending", "Guests", "Comment"]);
  }

  return sheet;
}
