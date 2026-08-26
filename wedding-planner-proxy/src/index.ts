type Env = {
  APPS_SCRIPT_BASE?: string;
  AMAZON_REGISTRY_URL?: string;
};

const DEFAULT_APPS_SCRIPT_BASE = "";
const DEFAULT_AMAZON_REGISTRY_URL = "";

export default {
  async fetch(request: Request, env: Env) {
    const url = new URL(request.url);
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response("", { headers: cors(origin) });
    }

    if (request.method === "GET") {
      if (url.pathname === "/amazon-registry") {
        return proxyAmazonRegistry(env, origin);
      }

      return new Response(JSON.stringify({
        ok: true,
        service: "wedding-planner-proxy"
      }), {
        headers: {
          ...cors(origin),
          "Content-Type": "application/json"
        }
      });
    }

    const appsScriptBase = normalizeAppsScriptBase(env.APPS_SCRIPT_BASE || DEFAULT_APPS_SCRIPT_BASE);
    if (!appsScriptBase) {
      return new Response(JSON.stringify({
        ok: false,
        error: "APPS_SCRIPT_BASE is not configured in the worker."
      }), {
        status: 500,
        headers: {
          ...cors(origin),
          "Content-Type": "application/json"
        }
      });
    }

    const body = await request.text();
    const retryableRead = isRetryablePlannerRead(body);
    let upstream: Response | undefined;
    let text = "";

    // A newly published Apps Script web app can briefly return 404/502 while
    // Google's edge routing catches up. Retry only read-only RPC calls so a
    // save/delete request is never repeated.
    for (let attempt = 0; attempt < (retryableRead ? 3 : 1); attempt += 1) {
      upstream = await fetch(`${appsScriptBase}/exec`, {
        method: "POST",
        headers: { "Content-Type": "text/plain;charset=utf-8" },
        body
      });
      text = await upstream.text();
      const transientStatus = [404, 502, 503, 504].includes(upstream.status);
      if (!transientStatus || attempt === 2) break;
      await new Promise((resolve) => setTimeout(resolve, 450 * (attempt + 1)));
    }

    if (!upstream) {
      return new Response(JSON.stringify({ ok: false, error: "Apps Script upstream did not respond." }), {
        status: 502,
        headers: { ...cors(origin), "Content-Type": "application/json" }
      });
    }
    const contentType = upstream.headers.get("Content-Type") || "application/json";

    if (!upstream.ok) {
      return new Response(JSON.stringify({
        ok: false,
        error: `Apps Script upstream returned ${upstream.status}.`,
        upstreamStatus: upstream.status,
        upstreamSnippet: text.slice(0, 200)
      }), {
        status: upstream.status,
        headers: {
          ...cors(origin),
          "Content-Type": "application/json"
        }
      });
    }

    if (!contentType.toLowerCase().includes("json")) {
      return new Response(JSON.stringify({
        ok: false,
        error: "Apps Script upstream did not return JSON.",
        upstreamContentType: contentType,
        upstreamSnippet: text.slice(0, 200)
      }), {
        status: 502,
        headers: {
          ...cors(origin),
          "Content-Type": "application/json"
        }
      });
    }

    return new Response(text, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        "Content-Type": contentType
      }
    });
  }
};

async function proxyAmazonRegistry(env: Env, origin: string) {
  const registryUrl = normalizeAbsoluteUrl(env.AMAZON_REGISTRY_URL || DEFAULT_AMAZON_REGISTRY_URL);

  if (!registryUrl) {
    return jsonResponse({
      ok: false,
      error: "AMAZON_REGISTRY_URL is not configured in the worker."
    }, origin, 500);
  }

  const upstream = await fetch(registryUrl, {
    method: "GET",
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; HopeCalebWeddingSite/1.0)",
      "Accept-Language": "en-US,en;q=0.9"
    }
  });

  const html = await upstream.text();
  if (!upstream.ok) {
    return jsonResponse({
      ok: false,
      error: `Amazon registry upstream returned ${upstream.status}.`,
      upstreamStatus: upstream.status,
      upstreamSnippet: html.slice(0, 200)
    }, origin, upstream.status);
  }

  const rewrittenHtml = html
    .replace(/<base\b[^>]*>/gi, "")
    .replace(/(<head[^>]*>)/i, `$1<base href="${registryUrl.endsWith("/") ? registryUrl : `${registryUrl}/`}">`)
    .replace(/Content-Security-Policy/gi, "X-Original-Content-Security-Policy")
    .replace(/X-Frame-Options/gi, "X-Original-X-Frame-Options");

  return new Response(rewrittenHtml, {
    status: 200,
    headers: {
      ...cors(origin),
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "public, max-age=300"
    }
  });
}

function normalizeAppsScriptBase(value: string) {
  return String(value || "")
    .trim()
    .replace(/\/exec\/?$/i, "")
    .replace(/\/+$/, "");
}

function isRetryablePlannerRead(body: string) {
  try {
    const method = String(JSON.parse(body)?.method || "").trim();
    return /^(get|list)/i.test(method);
  } catch (_) {
    return false;
  }
}

function normalizeAbsoluteUrl(value: string) {
  const trimmed = String(value || "").trim();
  if (!trimmed) {
    return "";
  }

  try {
    return new URL(trimmed).toString();
  } catch {
    return "";
  }
}

function jsonResponse(payload: unknown, origin: string, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...cors(origin),
      "Content-Type": "application/json"
    }
  });
}

function cors(origin: string) {
  const allow = origin && origin !== "null" ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Vary": "Origin"
  };
}
