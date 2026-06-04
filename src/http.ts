import { getGoogleClientId } from "./auth";
import { rpc } from "./rpc";

declare const global: { __REQUEST_AUTH_TOKEN__?: string };

function include(filename: string) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

export function doGet() {
  const tpl = HtmlService.createTemplateFromFile("index");
  tpl.googleClientId = getGoogleClientId();
  tpl.scriptBaseUrl = (() => {
    try {
      return ScriptApp.getService().getUrl() || "";
    } catch (_) {
      return "";
    }
  })();
  tpl.include = include;
  return tpl.evaluate().setTitle("Hope & Caleb Planner");
}

export function doPost(e?: GoogleAppsScript.Events.DoPost) {
  const body = e?.postData?.contents || "";
  let parsed: { method?: string; payload?: unknown; authToken?: string } = {};

  try {
    parsed = body ? JSON.parse(body) : {};
  } catch (_) {
    return jsonResponse({ ok: false, error: "Invalid JSON payload." });
  }

  global.__REQUEST_AUTH_TOKEN__ = String(parsed.authToken || "").trim();

  try {
    const method = String(parsed.method || "").trim();
    if (!method) {
      throw new Error("Missing RPC method.");
    }
    const data = rpc({ method, payload: parsed.payload });
    return jsonResponse({ ok: true, data }, e);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse({ ok: false, error: message }, e);
  } finally {
    global.__REQUEST_AUTH_TOKEN__ = "";
  }
}

export function doOptions(e?: GoogleAppsScript.Events.DoPost) {
  return jsonResponse("", e);
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
}).doOptions = doOptions;
