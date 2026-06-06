type Env = {
  APPS_SCRIPT_BASE?: string;
};

const DEFAULT_APPS_SCRIPT_BASE = "";

export default {
  async fetch(request: Request, env: Env) {
    const origin = request.headers.get("Origin") || "";

    if (request.method === "OPTIONS") {
      return new Response("", { headers: cors(origin) });
    }

    if (request.method === "GET") {
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
    const upstream = await fetch(`${appsScriptBase}/exec`, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body
    });

    const text = await upstream.text();
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

function normalizeAppsScriptBase(value: string) {
  return String(value || "")
    .trim()
    .replace(/\/exec\/?$/i, "")
    .replace(/\/+$/, "");
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
