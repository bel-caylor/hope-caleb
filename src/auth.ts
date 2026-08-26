import {
  ADMIN_HEADERS,
  ADMIN_SHEET,
  GOOGLE_CLIENT_ID_PROPERTY_KEY,
  PLANNER_USERS_SHEET,
  SPREADSHEET_ID_PROPERTY_KEY
} from "./constants";
import { ensureSheet, readRows } from "./util/sheets";

type RequestState = {
  __REQUEST_AUTH_TOKEN__?: string;
};

const GOOGLE_TOKENINFO_URL = "https://oauth2.googleapis.com/tokeninfo?id_token=";

function getRequestState(): RequestState {
  return globalThis as typeof globalThis & RequestState;
}

type VerifiedUser = {
  email: string;
  sub: string;
  expires: number;
};

export function getGoogleClientId() {
  return String(PropertiesService.getScriptProperties().getProperty(GOOGLE_CLIENT_ID_PROPERTY_KEY) || "").trim();
}

function getSpreadsheetId() {
  const spreadsheetId = String(PropertiesService.getScriptProperties().getProperty(SPREADSHEET_ID_PROPERTY_KEY) || "").trim();
  if (!spreadsheetId) {
    throw new Error("Spreadsheet access is not configured. Add SPREADSHEET_ID to Script Properties.");
  }
  return spreadsheetId;
}

function decodeJwtPayload(token: string) {
  try {
    const parts = String(token || "").split(".");
    if (parts.length < 2) return null;
    const payloadJson = Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[1])).getDataAsString();
    return JSON.parse(payloadJson);
  } catch (_) {
    return null;
  }
}

function verifyGoogleIdToken(token: string): VerifiedUser | null {
  const raw = String(token || "").trim();
  if (!raw) return null;

  const clientId = getGoogleClientId();
  if (!clientId) {
    throw new Error("Google sign-in is not configured. Add GOOGLE_CLIENT_ID to Script Properties.");
  }

  const cache = CacheService.getScriptCache();
  const payload = decodeJwtPayload(raw);
  const cacheKey = payload?.sub ? `planner-google-id-token:${payload.sub}:${payload.exp || ""}` : "";
  if (cacheKey) {
    const cached = cache.get(cacheKey);
    if (cached) {
      try {
        return JSON.parse(cached) as VerifiedUser;
      } catch (_) {}
    }
  }

  const response = UrlFetchApp.fetch(`${GOOGLE_TOKENINFO_URL}${encodeURIComponent(raw)}`, {
    muteHttpExceptions: true
  });
  if (response.getResponseCode() !== 200) return null;

  const data = JSON.parse(response.getContentText() || "{}") as {
    aud?: string;
    email?: string;
    email_verified?: string | boolean;
    exp?: string;
    sub?: string;
  };

  const emailVerified = typeof data.email_verified === "boolean"
    ? data.email_verified
    : String(data.email_verified || "").toLowerCase() === "true";

  if (String(data.aud || "").trim() !== clientId || !emailVerified) return null;

  const verified = {
    email: String(data.email || "").trim().toLowerCase(),
    sub: String(data.sub || "").trim(),
    expires: Number(data.exp || 0) * 1000
  };
  if (!verified.email) return null;

  if (cacheKey) {
    const nowSec = Math.floor(Date.now() / 1000);
    const expSec = Number(data.exp || 0);
    const ttl = Math.max(1, Math.min(300, expSec - nowSec));
    cache.put(cacheKey, JSON.stringify(verified), ttl);
  }

  return verified;
}

function readPlannerAccessEmails() {
  const spreadsheetId = getSpreadsheetId();
  const cache = CacheService.getScriptCache();
  const cacheKey = `planner-admin-access:${spreadsheetId}`;
  const cached = cache.get(cacheKey);
  if (cached) {
    try {
      return new Set(JSON.parse(cached) as string[]);
    } catch (_) {}
  }

  const file = DriveApp.getFileById(spreadsheetId);
  const emails = new Set<string>();
  const ownerEmail = String(file.getOwner()?.getEmail?.() || "").trim().toLowerCase();
  if (ownerEmail) {
    emails.add(ownerEmail);
  }

  ensureSheet(ADMIN_SHEET, ADMIN_HEADERS);
  readRows(ADMIN_SHEET).forEach((row) => {
    const email = String(row.Email || "").trim().toLowerCase();
    if (email) emails.add(email);
  });

  // New full-planner invitations are explicit records, not a side effect of
  // sharing the underlying spreadsheet with someone.
  readRows(PLANNER_USERS_SHEET).forEach((row) => {
    const email = String(row.Email || "").trim().toLowerCase();
    const accessLevel = String(row.AccessLevel || "").trim().toLowerCase();
    const active = String(row.Active || "TRUE").trim().toLowerCase() !== "false";
    if (email && active && accessLevel === "full_planner") emails.add(email);
  });

  cache.put(cacheKey, JSON.stringify([...emails]), 300);
  return emails;
}

function getViewerName(email: string) {
  ensureSheet(ADMIN_SHEET, ADMIN_HEADERS);
  const adminRows = readRows(ADMIN_SHEET);
  const admin = adminRows.find((row) => String(row.Email || "").trim().toLowerCase() === email);
  if (admin?.Name) return String(admin.Name).trim();
  const workspaceUser = readRows(PLANNER_USERS_SHEET)
    .find((row) => String(row.Email || "").trim().toLowerCase() === email);
  return String(workspaceUser?.Name || "").trim();
}

export function getViewerProfile() {
  const token = String(getRequestState().__REQUEST_AUTH_TOKEN__ || "").trim();
  if (!token) {
    return {
      signedIn: false,
      email: "",
      name: "",
      isAdmin: false
    };
  }

  const verified = verifyGoogleIdToken(token);
  if (!verified) {
    return {
      signedIn: false,
      email: "",
      name: "",
      isAdmin: false
    };
  }

  const allowedEmails = readPlannerAccessEmails();
  const isSharedOnSheet = allowedEmails.has(verified.email);

  return {
    signedIn: true,
    email: verified.email,
    name: getViewerName(verified.email),
    isAdmin: isSharedOnSheet
  };
}

export function requireAdmin() {
  const viewer = getViewerProfile();
  if (!viewer.signedIn) {
    throw new Error("Please sign in with Google first.");
  }
  if (!viewer.isAdmin) {
    throw new Error("Your Google account has not been granted full planner access.");
  }
  return viewer;
}

export function requirePlannerAccess() {
  return requireAdmin();
}

export function requireScriptEditorAccess() {
  const email = String(Session.getActiveUser().getEmail() || "").trim().toLowerCase();
  if (!email) {
    throw new Error("Apps Script could not determine your Google account email in the editor.");
  }

  const allowedEmails = readPlannerAccessEmails();
  if (!allowedEmails.has(email)) {
    throw new Error("Your Google account has not been granted full planner access.");
  }

  return {
    signedIn: true,
    email,
    name: getViewerName(email),
    isAdmin: true
  };
}
