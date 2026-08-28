const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const ENV_FILE = path.join(ROOT, ".env.standalone.local");
const SCRIPT_FILE = path.join(ROOT, "script.js");
const SITE_FILE = path.join(ROOT, "site.js");

const inputUrl = String(process.argv[2] || "").trim();

if (!inputUrl) {
  console.error("Usage: node scripts/set-apps-script-url.cjs https://script.google.com/macros/s/DEPLOYMENT_ID/exec");
  process.exit(1);
}

if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/i.test(inputUrl)) {
  console.error("Expected a full Apps Script /exec URL.");
  process.exit(1);
}

updateEnv(inputUrl);
updateScriptJs(inputUrl);
updateSiteJs(inputUrl);

console.log("Updated Apps Script URL in:");
console.log(`- ${path.relative(ROOT, ENV_FILE)}`);
console.log(`- ${path.relative(ROOT, SCRIPT_FILE)}`);
console.log(`- ${path.relative(ROOT, SITE_FILE)}`);
console.log("");
console.log("Next steps:");
console.log("- If localhost uses the proxy, update the Worker secret APPS_SCRIPT_BASE to the same URL without /exec.");
console.log("- Run `npm run build` to refresh dist-standalone/dashboard.html.");

function updateEnv(url) {
  if (!fs.existsSync(ENV_FILE)) {
    console.error(`Missing ${path.relative(ROOT, ENV_FILE)}`);
    process.exit(1);
  }

  const content = fs.readFileSync(ENV_FILE, "utf8");
  const next = replaceOrAppend(content, "PUBLIC_RSVP_FEED_URL", url);
  fs.writeFileSync(ENV_FILE, next);
}

function updateScriptJs(url) {
  const content = fs.readFileSync(SCRIPT_FILE, "utf8");
  const pattern = /(googleScriptUrl:\s*")([^"]+)(")/;
  if (!pattern.test(content)) {
    console.error("Could not find `googleScriptUrl` in script.js.");
    process.exit(1);
  }
  const next = content.replace(pattern, `$1${url}$3`);

  if (next !== content) fs.writeFileSync(SCRIPT_FILE, next);
}

function updateSiteJs(url) {
  const content = fs.readFileSync(SITE_FILE, "utf8");
  const pattern = /(scriptUrl:\s*")([^"]+)(")/;
  if (!pattern.test(content)) {
    console.error("Could not find `scriptUrl` in site.js.");
    process.exit(1);
  }
  const next = content.replace(pattern, `$1${url}$3`);

  if (next !== content) fs.writeFileSync(SITE_FILE, next);
}

function replaceOrAppend(content, key, value) {
  const pattern = new RegExp(`^${escapeRegExp(key)}=.*$`, "m");
  if (pattern.test(content)) {
    return content.replace(pattern, `${key}=${value}`);
  }

  const suffix = content.endsWith("\n") ? "" : "\n";
  return `${content}${suffix}${key}=${value}\n`;
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
