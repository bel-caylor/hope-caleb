function runSyncGuestSummarySheets() {
  if (typeof globalThis.syncGuestSummarySheets !== "function") {
    throw new Error("syncGuestSummarySheets is not available in the bundled script.");
  }

  return globalThis.syncGuestSummarySheets();
}

function runSyncGroupsSheet() {
  if (typeof globalThis.syncGroupsSheetForEditor !== "function") {
    throw new Error("syncGroupsSheetForEditor is not available in the bundled script.");
  }

  return globalThis.syncGroupsSheetForEditor();
}
