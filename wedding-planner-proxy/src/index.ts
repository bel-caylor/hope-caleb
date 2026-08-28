type SessionRecord = { email: string; sub: string; expires: number };

type Env = {
  APPS_SCRIPT_BASE?: string;
  AMAZON_REGISTRY_URL?: string;
  GOOGLE_CLIENT_ID?: string;
  PLANNER_ORIGIN?: string;
  PLANNER_ORIGINS?: string;
  SESSION_SIGNING_SECRET?: string;
  PLANNER_SESSIONS: KVNamespace;
};

const DEFAULT_APPS_SCRIPT_BASE = "";
const DEFAULT_AMAZON_REGISTRY_URL = "";
const LOCAL_DEVELOPMENT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];
const SESSION_COOKIE = "hope_caleb_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 30;

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";
    const allowedOrigin = getAllowedOrigin(origin, env);
    if (!allowedOrigin) return jsonResponse({ ok: false, error: "This planner endpoint is not available from this site." }, defaultOrigin(env), 403);
    if (request.method === "OPTIONS") return new Response("", { headers: cors(allowedOrigin) });
    if (request.method === "GET") {
      if (url.pathname === "/session/validate") {
        const validated = await validateSessionAssertion(String(url.searchParams.get("token") || ""), env);
        return validated
          ? jsonResponse({ ok: true, email: validated.email, sub: validated.sub, expires: validated.expires, sessionId: validated.sessionId }, allowedOrigin)
          : jsonResponse({ ok: false }, allowedOrigin, 401);
      }
      if (url.pathname === "/amazon-registry") return proxyAmazonRegistry(env, allowedOrigin);
      return jsonResponse({ ok: true, service: "wedding-planner-proxy" }, allowedOrigin);
    }
    const appsScriptBase = normalizeAppsScriptBase(env.APPS_SCRIPT_BASE || DEFAULT_APPS_SCRIPT_BASE);
    if (!appsScriptBase) return jsonResponse({ ok: false, error: "APPS_SCRIPT_BASE is not configured in the worker." }, allowedOrigin, 500);
    let body: { method?: string; payload?: unknown; authToken?: string };
    try { body = JSON.parse(await request.text()); } catch { return jsonResponse({ ok: false, error: "Invalid JSON payload." }, allowedOrigin, 400); }

    let sessionId = getCookie(request.headers.get("Cookie") || "", SESSION_COOKIE) || getSessionToken(String(body.authToken || ""));
    let session = sessionId ? await getSession(env, sessionId) : null;
    let setCookie = "";
    if (!session) {
      const identity = await verifyGoogleToken(String(body.authToken || ""), env);
      if (!identity) return jsonResponse({ ok: false, error: "Please sign in with Google first." }, allowedOrigin, 401);
      sessionId = crypto.randomUUID();
      session = { ...identity, expires: Date.now() + SESSION_TTL_SECONDS * 1000 };
      await env.PLANNER_SESSIONS.put(`session:${sessionId}`, JSON.stringify(session), { expirationTtl: SESSION_TTL_SECONDS });
      setCookie = `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; Max-Age=${SESSION_TTL_SECONDS}; HttpOnly; Secure; SameSite=Lax`;
    }
    body.authToken = await createSessionAssertion(sessionId!, session, env);
    const serialized = JSON.stringify(body);
    // Apps Script answers its /exec POST with a redirect to a short-lived
    // script.googleusercontent.com URL. Follow it ourselves: the Worker
    // runtime can otherwise surface Google's redirect target as a 404 even
    // though a direct browser/API call succeeds.
    const initialUpstream = await fetch(`${appsScriptBase}/exec`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: serialized,
      redirect: "manual"
    });
    const redirectLocation = initialUpstream.headers.get("Location");
    const upstream = initialUpstream.status >= 300 && initialUpstream.status < 400 && redirectLocation
      ? await fetch(new URL(redirectLocation, appsScriptBase).toString(), { method: "GET" })
      : initialUpstream;
    const text = await upstream.text();
    const contentType = upstream.headers.get("Content-Type") || "application/json";
    if (!upstream.ok) return jsonResponse({ ok: false, error: `Apps Script upstream returned ${upstream.status}.`, upstreamStatus: upstream.status, upstreamSnippet: text.slice(0, 200) }, allowedOrigin, upstream.status);
    if (!contentType.toLowerCase().includes("json")) return jsonResponse({ ok: false, error: "Apps Script upstream did not return JSON.", upstreamSnippet: text.slice(0, 200) }, allowedOrigin, 502);
    const responsePayload = newSessionCookiePayload(text, sessionId!, Boolean(setCookie));
    return new Response(responsePayload, { status: upstream.status, headers: { ...cors(allowedOrigin), "Content-Type": contentType, ...(setCookie ? { "Set-Cookie": setCookie } : {}) } });
  }
};

async function getSession(env: Env, id: string): Promise<SessionRecord | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const session = await env.PLANNER_SESSIONS.get(`session:${id}`, "json") as SessionRecord | null;
  return session && session.email && session.sub && Number(session.expires || 0) > Date.now() ? session : null;
}

async function verifyGoogleToken(token: string, env: Env): Promise<Omit<SessionRecord, "expires"> | null> {
  const clientId = String(env.GOOGLE_CLIENT_ID || "").trim();
  if (!token || !clientId) return null;
  const response = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(token)}`);
  if (!response.ok) return null;
  const data = await response.json() as { aud?: string; email?: string; email_verified?: boolean | string; sub?: string };
  const email = String(data.email || "").trim().toLowerCase();
  const sub = String(data.sub || "").trim();
  const verified = data.email_verified === true || String(data.email_verified || "").toLowerCase() === "true";
  return String(data.aud || "") === clientId && verified && email && sub ? { email, sub } : null;
}

async function createSessionAssertion(id: string, session: SessionRecord, env: Env) {
  const secret = String(env.SESSION_SIGNING_SECRET || "").trim();
  if (!secret) throw new Error("SESSION_SIGNING_SECRET is not configured in the worker.");
  const payload = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ sid: id, email: session.email, sub: session.sub, exp: session.expires })));
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const signature = base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
  return `hcs1.${payload}.${signature}`;
}

async function validateSessionAssertion(token: string, env: Env): Promise<(SessionRecord & { sessionId: string }) | null> {
  const [version, payload, signature] = String(token || "").split(".");
  const secret = String(env.SESSION_SIGNING_SECRET || "").trim();
  if (version !== "hcs1" || !payload || !signature || !secret) return null;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const expected = base64UrlEncode(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload))));
  if (!safeEqual(expected, signature)) return null;
  try {
    const claim = JSON.parse(new TextDecoder().decode(base64UrlDecode(payload))) as { sid?: string; email?: string; sub?: string; exp?: number };
    const sessionId = String(claim.sid || "");
    const stored = await getSession(env, sessionId);
    if (!stored || stored.email !== String(claim.email || "").toLowerCase() || stored.sub !== String(claim.sub || "") || stored.expires !== Number(claim.exp || 0)) return null;
    return { ...stored, sessionId };
  } catch { return null; }
}

function base64UrlEncode(bytes: Uint8Array) { return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, ""); }
function base64UrlDecode(value: string) { const padded = value.replace(/-/g, "+").replace(/_/g, "/") + "=".repeat((4 - value.length % 4) % 4); return Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)); }
function safeEqual(left: string, right: string) { if (left.length !== right.length) return false; let difference = 0; for (let index = 0; index < left.length; index += 1) difference |= left.charCodeAt(index) ^ right.charCodeAt(index); return difference === 0; }
function getCookie(cookies: string, name: string) { const pair = cookies.split(";").map((item) => item.trim()).find((item) => item.startsWith(`${name}=`)); return pair ? decodeURIComponent(pair.slice(name.length + 1)) : ""; }
function getSessionToken(value: string) { const match = String(value || "").match(/^session\.([0-9a-f-]{36})$/i); return match ? match[1] : ""; }
function newSessionCookiePayload(body: string, sessionId: string, created: boolean) { if (!created) return body; try { return JSON.stringify({ ...JSON.parse(body), sessionToken: `session.${sessionId}` }); } catch { return body; } }
function normalizeAppsScriptBase(value: string) { return String(value || "").trim().replace(/\/exec\/?$/i, "").replace(/\/+$/, ""); }
function configuredOrigins(env: Env) {
  return [env.PLANNER_ORIGIN, env.PLANNER_ORIGINS, "https://hope-caleb.site", ...LOCAL_DEVELOPMENT_ORIGINS]
    .flatMap((value) => String(value || "").split(","))
    .map((value) => value.trim())
    .filter(Boolean);
}
function defaultOrigin(env: Env) { return configuredOrigins(env)[0] || "https://hope-caleb.site"; }
function getAllowedOrigin(requestOrigin: string, env: Env) {
  const origins = configuredOrigins(env);
  return requestOrigin ? (origins.includes(requestOrigin) ? requestOrigin : "") : defaultOrigin(env);
}
function cors(origin: string) { return { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Methods": "GET,POST,OPTIONS", "Access-Control-Allow-Headers": "Content-Type,Authorization", "Access-Control-Allow-Credentials": "true", "Vary": "Origin" }; }
function jsonResponse(payload: unknown, origin: string, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...cors(origin), "Content-Type": "application/json" } }); }

async function proxyAmazonRegistry(env: Env, origin: string) {
  const registryUrl = normalizeAbsoluteUrl(env.AMAZON_REGISTRY_URL || DEFAULT_AMAZON_REGISTRY_URL);
  if (!registryUrl) return jsonResponse({ ok: false, error: "AMAZON_REGISTRY_URL is not configured in the worker." }, origin, 500);
  const upstream = await fetch(registryUrl, { headers: { "User-Agent": "Mozilla/5.0 (compatible; HopeCalebWeddingSite/1.0)", "Accept-Language": "en-US,en;q=0.9" } });
  const html = await upstream.text();
  if (!upstream.ok) return jsonResponse({ ok: false, error: `Amazon registry upstream returned ${upstream.status}.`, upstreamStatus: upstream.status, upstreamSnippet: html.slice(0, 200) }, origin, upstream.status);
  const rewrittenHtml = html.replace(/<base\b[^>]*>/gi, "").replace(/(<head[^>]*>)/i, `$1<base href="${registryUrl.endsWith("/") ? registryUrl : `${registryUrl}/`}">`).replace(/Content-Security-Policy/gi, "X-Original-Content-Security-Policy").replace(/X-Frame-Options/gi, "X-Original-X-Frame-Options");
  return new Response(rewrittenHtml, { status: 200, headers: { ...cors(origin), "Content-Type": "text/html; charset=utf-8", "Cache-Control": "public, max-age=300" } });
}

function normalizeAbsoluteUrl(value: string) { try { return new URL(String(value || "").trim()).toString(); } catch { return ""; } }
