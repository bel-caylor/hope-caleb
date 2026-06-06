function runSyncGuestSummarySheets() {
  if (typeof globalThis.syncGuestSummarySheets !== "function") {
    throw new Error("syncGuestSummarySheets is not available in the bundled script.");
  }

  return globalThis.syncGuestSummarySheets();
}
