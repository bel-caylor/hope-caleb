import {
  ADMIN_HEADERS,
  ADMIN_SHEET,
  DASHBOARD_PASSWORD_HASH_PROPERTY_KEY,
  GOOGLE_CLIENT_ID_PROPERTY_KEY
} from "./constants";
import { ensureSheet, readRows } from "./util/sheets";

type RequestState = {
  __REQUEST_AUTH_TOKEN__?: string;
  __REQUEST_PASSWORD_HASH__?: string;
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

export function getDashboardPasswordHash() {
  return String(PropertiesService.getScriptProperties().getProperty(DASHBOARD_PASSWORD_HASH_PROPERTY_KEY) || "")
    .trim()
    .toLowerCase();
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

  ensureSheet(ADMIN_SHEET, ADMIN_HEADERS);
  const adminRows = readRows(ADMIN_SHEET);
  const admin = adminRows.find((row) => String(row.Email || "").trim().toLowerCase() === verified.email);

  return {
    signedIn: true,
    email: verified.email,
    name: String(admin?.Name || "").trim(),
    isAdmin: Boolean(admin)
  };
}

export function requireAdmin() {
  const viewer = getViewerProfile();
  if (!viewer.signedIn) {
    throw new Error("Please sign in first.");
  }
  if (!viewer.isAdmin) {
    throw new Error("Your account is not listed in the Admins sheet yet.");
  }
  return viewer;
}

export function requirePlannerAccess() {
  const passwordHash = String(getRequestState().__REQUEST_PASSWORD_HASH__ || "").trim().toLowerCase();
  const expectedHash = getDashboardPasswordHash();

  if (expectedHash && passwordHash === expectedHash) {
    return {
      signedIn: true,
      email: "",
      name: "Dashboard session",
      isAdmin: true
    };
  }

  return requireAdmin();
}
