# Wedding Planner Proxy

This Cloudflare Worker forwards standalone frontend RPC calls to the Apps Script planner backend.

## Why use it

- avoid browser-to-Apps-Script CORS weirdness
- give the local frontend one stable base URL
- match the proxy pattern already used in `worship-plan-ts`

## Setup

1. Open this folder:

```powershell
cd wedding-planner-proxy
```

2. Install deps:

```powershell
npm install
```

3. Log into Wrangler if needed:

```powershell
npx wrangler login
```

4. Store the Apps Script `/exec` base URL:

```powershell
npx wrangler secret put APPS_SCRIPT_BASE
```

Use a value like:

```text
https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID
```

5. Deploy the worker:

```powershell
npm run deploy
```

## Standalone frontend

Point the standalone frontend at the Worker URL, not the Apps Script URL:

```powershell
$env:APPS_SCRIPT_BASE = "https://hope-caleb-wedding-planner-proxy.your-subdomain.workers.dev"
$env:GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com"
npm run build:standalone
npm run serve:standalone
```
