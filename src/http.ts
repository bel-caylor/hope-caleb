import { getGoogleClientId } from "./auth";
import { listPublicFeed, lookupPublicRsvpGroups, savePublicSubmission, syncGroupsSheet, syncGroupsSheetForEditor, syncGuestSummarySheets } from "./features/feed";
import { initializeBedsSheet, listPublicRehearsalSlides } from "./features/planner";
import { rpc } from "./rpc";
import { withSpreadsheetWriteLock } from "./util/sheets";
import { PLANNER_BUILD_VERSION } from "./version";

type RequestState = {
  __REQUEST_AUTH_TOKEN__?: string;
};

function getRequestState(): RequestState {
  return globalThis as typeof globalThis & RequestState;
}

function include(filename: string) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

export function doGet(e?: GoogleAppsScript.Events.DoGet) {
  if (isRpcGetRequest(e)) {
    return handleRpcGet(e);
  }

  if (isPublicLookupRequest(e)) {
    return publicFeedResponse(
      lookupPublicRsvpGroups(e?.parameter?.firstName, e?.parameter?.lastName),
      e
    );
  }

  if (shouldServePublicFeed(e)) {
    if (String(e?.parameter?.feed || "").trim().toLowerCase() === "rehearsal-slideshow") {
      return publicFeedResponse({ slides: listPublicRehearsalSlides() }, e);
    }
    return publicFeedResponse(listPublicFeed(), e);
  }

  const tpl = HtmlService.createTemplateFromFile("index");
  const scriptBaseUrl = (() => {
    try {
      return ScriptApp.getService().getUrl() || "";
    } catch (_) {
      return "";
    }
  })();
  tpl.googleClientId = getGoogleClientId();
  tpl.rsvpFeedUrl = scriptBaseUrl;
  tpl.scriptBaseUrl = scriptBaseUrl;
  tpl.plannerBuildVersion = PLANNER_BUILD_VERSION;
  tpl.include = include;
  return tpl.evaluate().setTitle("Hope & Caleb Planner");
}

export function doPost(e?: GoogleAppsScript.Events.DoPost) {
  if (!isRpcRequest(e)) {
    return jsonResponse(savePublicSubmission(e?.parameter), e);
  }

  const body = e?.postData?.contents || "";
  let parsed: { method?: string; payload?: unknown; authToken?: string } = {};

  try {
    parsed = body ? JSON.parse(body) : {};
  } catch (_) {
    return jsonResponse({ ok: false, error: "Invalid JSON payload." });
  }

  getRequestState().__REQUEST_AUTH_TOKEN__ = String(parsed.authToken || "").trim();

  try {
    const method = String(parsed.method || "").trim();
    if (!method) {
      throw new Error("Missing RPC method.");
    }
    const data = isWriteRpcMethod(method)
      ? withSpreadsheetWriteLock(() => rpc({ method, payload: parsed.payload }))
      : rpc({ method, payload: parsed.payload });
    return jsonResponse({ ok: true, data }, e);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, error: message }, e);
  } finally {
    getRequestState().__REQUEST_AUTH_TOKEN__ = "";
  }
}

export function doOptions(e?: GoogleAppsScript.Events.DoPost) {
  return jsonResponse("", e);
}

function handleRpcGet(e?: GoogleAppsScript.Events.DoGet) {
  const method = String(e?.parameter?.method || "").trim();
  const payload = parseRpcPayload(String(e?.parameter?.payload || ""));

  getRequestState().__REQUEST_AUTH_TOKEN__ = String(e?.parameter?.authToken || "").trim();

  try {
    if (!method) {
      throw new Error("Missing RPC method.");
    }
    if (isWriteRpcMethod(method)) {
      throw new Error("Planner changes must use POST requests.");
    }
    const data = rpc({ method, payload });
    return publicFeedResponse({ ok: true, data }, e);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return publicFeedResponse({ ok: false, error: message }, e);
  } finally {
    getRequestState().__REQUEST_AUTH_TOKEN__ = "";
  }
}

function jsonResponse(payload: unknown, e?: GoogleAppsScript.Events.DoPost) {
  const output = ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);

  const setter = (output as GoogleAppsScript.Content.TextOutput & {
    setHeader?: (key: string, value: string) => GoogleAppsScript.Content.TextOutput;
  }).setHeader;

  if (typeof setter === "function") {
    const origin = getOrigin(e) || "*";
    setter.call(output, "Access-Control-Allow-Origin", origin);
    setter.call(output, "Access-Control-Allow-Methods", "POST,OPTIONS");
    setter.call(output, "Access-Control-Allow-Headers", "Content-Type");
    setter.call(output, "Vary", "Origin");
  }

  return output;
}

function publicFeedResponse(payload: unknown, e?: GoogleAppsScript.Events.DoGet) {
  const callback = String(e?.parameter?.callback || "").trim();
  const output = JSON.stringify(payload);

  if (callback) {
    return ContentService
      .createTextOutput(`${callback}(${output});`)
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  return ContentService
    .createTextOutput(output)
    .setMimeType(ContentService.MimeType.JSON);
}

function shouldServePublicFeed(e?: GoogleAppsScript.Events.DoGet) {
  const callback = String(e?.parameter?.callback || "").trim();
  const format = String(e?.parameter?.format || "").trim().toLowerCase();
  const feed = String(e?.parameter?.feed || "").trim().toLowerCase();

  return Boolean(callback) || format === "json" || feed === "public";
}

function isPublicLookupRequest(e?: GoogleAppsScript.Events.DoGet) {
  const lookup = String(e?.parameter?.lookup || "").trim().toLowerCase();
  return lookup === "rsvp";
}

function isRpcGetRequest(e?: GoogleAppsScript.Events.DoGet) {
  return String(e?.parameter?.method || "").trim().length > 0;
}

function parseRpcPayload(payload: string) {
  const raw = String(payload || "").trim();
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch (_) {
    throw new Error("Invalid RPC payload.");
  }
}

function isRpcRequest(e?: GoogleAppsScript.Events.DoPost) {
  const body = String(e?.postData?.contents || "").trim();

  if (!body) {
    return false;
  }

  try {
    const parsed = JSON.parse(body) as { method?: unknown };
    return typeof parsed?.method === "string" && parsed.method.trim().length > 0;
  } catch (_) {
    return false;
  }
}

function isWriteRpcMethod(method: string) {
  return new Set([
    "savePerson", "saveBed", "saveEvent", "saveShot", "deleteShot",
    "saveTodo", "uploadTodoImage", "deleteTodo", "uploadRehearsalSlideImage", "saveRehearsalSlide", "deleteRehearsalSlide", "saveEventList", "deleteEventList",
    "saveTable", "saveTableReservedOpenSeats", "saveGuestTableAssignment", "saveGuestTableAssignments",
    "saveGuestDetails", "syncGuestSummarySheets", "syncGroupsSheet", "savePlannerRsvpCorrection",
    "initializePlannerWorkspace", "saveWorkspaceUser", "importLegacyPeopleToWorkspaceUsers", "syncPlannerUsersToGuests",
    "archiveLegacyPlanningData", "saveWorkspaceEvent", "deleteWorkspaceEvent", "saveWorkspaceTask",
    "setWorkspaceTaskCompleted", "deleteWorkspaceTask", "saveWorkspaceList", "setWorkspaceListItemCompleted",
    "deleteWorkspaceList", "saveWorkspaceAsset", "deleteWorkspaceAsset"
  ]).has(method);
}

function getOrigin(e?: GoogleAppsScript.Events.DoPost) {
  const headers = (e as GoogleAppsScript.Events.DoPost & {
    headers?: { origin?: string };
  } | undefined)?.headers;
  return typeof headers?.origin === "string" ? headers.origin : "";
}

// Apps Script web apps look for global entrypoints by name.
// The bundled build wraps this file, so we re-expose them explicitly.
(globalThis as typeof globalThis & {
  doGet?: typeof doGet;
  doPost?: typeof doPost;
  doOptions?: typeof doOptions;
}).doGet = doGet;

(globalThis as typeof globalThis & {
  doGet?: typeof doGet;
  doPost?: typeof doPost;
  doOptions?: typeof doOptions;
}).doPost = doPost;

(globalThis as typeof globalThis & {
  doGet?: typeof doGet;
  doPost?: typeof doPost;
  doOptions?: typeof doOptions;
  initializeBedsSheet?: typeof initializeBedsSheet;
  syncGroupsSheet?: typeof syncGroupsSheet;
  syncGroupsSheetForEditor?: typeof syncGroupsSheetForEditor;
  syncGuestSummarySheets?: typeof syncGuestSummarySheets;
}).doOptions = doOptions;

(globalThis as typeof globalThis & {
  doGet?: typeof doGet;
  doPost?: typeof doPost;
  doOptions?: typeof doOptions;
  initializeBedsSheet?: typeof initializeBedsSheet;
  syncGroupsSheet?: typeof syncGroupsSheet;
  syncGroupsSheetForEditor?: typeof syncGroupsSheetForEditor;
  syncGuestSummarySheets?: typeof syncGuestSummarySheets;
}).initializeBedsSheet = initializeBedsSheet;

(globalThis as typeof globalThis & {
  doGet?: typeof doGet;
  doPost?: typeof doPost;
  doOptions?: typeof doOptions;
  initializeBedsSheet?: typeof initializeBedsSheet;
  syncGroupsSheet?: typeof syncGroupsSheet;
  syncGroupsSheetForEditor?: typeof syncGroupsSheetForEditor;
  syncGuestSummarySheets?: typeof syncGuestSummarySheets;
}).syncGroupsSheet = syncGroupsSheet;

(globalThis as typeof globalThis & {
  doGet?: typeof doGet;
  doPost?: typeof doPost;
  doOptions?: typeof doOptions;
  initializeBedsSheet?: typeof initializeBedsSheet;
  syncGroupsSheet?: typeof syncGroupsSheet;
  syncGroupsSheetForEditor?: typeof syncGroupsSheetForEditor;
  syncGuestSummarySheets?: typeof syncGuestSummarySheets;
}).syncGroupsSheetForEditor = syncGroupsSheetForEditor;

(globalThis as typeof globalThis & {
  doGet?: typeof doGet;
  doPost?: typeof doPost;
  doOptions?: typeof doOptions;
  initializeBedsSheet?: typeof initializeBedsSheet;
  syncGroupsSheet?: typeof syncGroupsSheet;
  syncGroupsSheetForEditor?: typeof syncGroupsSheetForEditor;
  syncGuestSummarySheets?: typeof syncGuestSummarySheets;
}).syncGuestSummarySheets = syncGuestSummarySheets;
