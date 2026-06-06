const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.standalone.local");
const SCRIPT_FILE = path.join(ROOT, "script.js");
const DASHBOARD_FILE = path.join(ROOT, "dist-standalone", "dashboard.html");

const env = readEnv(ENV_FILE);
const scriptContent = readFile(SCRIPT_FILE);
const dashboardContent = fs.existsSync(DASHBOARD_FILE) ? readFile(DASHBOARD_FILE) : "";

const envFeedUrl = env.PUBLIC_RSVP_FEED_URL || "";
const envProxyUrl = env.PLANNER_PROXY_URL || "";
const scriptUrl = extract(scriptContent, /googleScriptUrl:\s*"([^"]+)"/);
const builtFeedUrl = extract(dashboardContent, /meta name="planner-rsvp-feed-url" content="([^"]*)"/);
const builtPlannerUrl = extract(dashboardContent, /meta name="planner-script-base-url" content="([^"]*)"/);

console.log("Planner config check");
console.log(`- .env PUBLIC_RSVP_FEED_URL: ${envFeedUrl || "(missing)"}`);
console.log(`- .env PLANNER_PROXY_URL: ${envProxyUrl || "(missing)"}`);
console.log(`- script.js googleScriptUrl: ${scriptUrl || "(missing)"}`);
console.log(`- built dashboard feed URL: ${builtFeedUrl || "(missing)"}`);
console.log(`- built dashboard planner URL: ${builtPlannerUrl || "(missing)"}`);
console.log("");

const findings = [];

if (!envFeedUrl) findings.push("Missing PUBLIC_RSVP_FEED_URL in .env.standalone.local.");
if (!scriptUrl) findings.push("Missing googleScriptUrl in script.js.");
if (envFeedUrl && scriptUrl && envFeedUrl !== scriptUrl) {
  findings.push("PUBLIC_RSVP_FEED_URL and script.js googleScriptUrl do not match.");
}
if (dashboardContent && envFeedUrl && builtFeedUrl && envFeedUrl !== builtFeedUrl) {
  findings.push("Built dashboard is stale. Run `npm run build`.");
}
if (dashboardContent && envProxyUrl && builtPlannerUrl && envProxyUrl !== builtPlannerUrl) {
  findings.push("Built dashboard planner URL is stale. Run `npm run build`.");
}
if (envProxyUrl.includes("script.google.com/macros/s/")) {
  findings.push("PLANNER_PROXY_URL points directly at Apps Script. For localhost, prefer the Worker URL.");
}
if (envProxyUrl.includes("workers.dev")) {
  findings.push("Local planner RPC is using the Worker. If localhost still 404s, re-set `APPS_SCRIPT_BASE` in the Worker and redeploy it.");
}

const feedId = extractDeploymentId(envFeedUrl);
const scriptId = extractDeploymentId(scriptUrl);
if (feedId && scriptId && feedId !== scriptId) {
  findings.push("Apps Script deployment IDs differ between .env and script.js.");
}

if (!findings.length) {
  console.log("No obvious local config mismatches found.");
} else {
  console.log("Findings:");
  findings.forEach((finding) => console.log(`- ${finding}`));
}

if (feedId) {
  console.log("");
  console.log("Worker secret value to use for APPS_SCRIPT_BASE:");
  console.log(`https://script.google.com/macros/s/${feedId}`);
}

function readFile(filePath) {
  return fs.readFileSync(filePath, "utf8");
}

function readEnv(filePath) {
  if (!fs.existsSync(filePath)) {
    return {};
  }

  return readFile(filePath)
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) return acc;
      const idx = trimmed.indexOf("=");
      if (idx === -1) return acc;
      acc[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
      return acc;
    }, {});
}

function extract(content, pattern) {
  const match = String(content || "").match(pattern);
  return match ? match[1] : "";
}

function extractDeploymentId(url) {
  const match = String(url || "").match(/\/macros\/s\/([^/]+)\/exec/i);
  return match ? match[1] : "";
}
