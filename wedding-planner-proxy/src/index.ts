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

    const appsScriptBase = String(env.APPS_SCRIPT_BASE || DEFAULT_APPS_SCRIPT_BASE).replace(/\/+$/, "");
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
    return new Response(text, {
      status: upstream.status,
      headers: {
        ...cors(origin),
        "Content-Type": upstream.headers.get("Content-Type") || "application/json"
      }
    });
  }
};

function cors(origin: string) {
  const allow = origin && origin !== "null" ? origin : "*";
  return {
    "Access-Control-Allow-Origin": allow,
    "Access-Control-Allow-Methods": "POST,OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type,Authorization",
    "Vary": "Origin"
  };
}
