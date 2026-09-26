const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dist-public");
const PLANNER_OUT_DIR = path.join(ROOT, "dist-standalone");
const PLANNER_TEMPLATE = path.join(ROOT, "src", "html", "index.html");
const PLANNER_FILES = ["util", "apps-planner"];
const LOCAL_ENV_FILE = path.join(ROOT, ".env.standalone.local");
const VERSION_FILE = path.join(ROOT, "src", "version.ts");
const FILES = [
  "index.html", "privacy-policy.html", "sms-opt-in-proof.html", "story.html",
  "terms-and-conditions.html", "travel.html", "site.css", "site.js",
  "slideshow.html", "rehearsal-slideshow-manager.html", "rehearsal-slideshow.html",
  "styles.css", "script.js", "slideshow.css", "rehearsal-slideshow-manager.css",
  "slideshow.js", "rehearsal-slideshow-manager.js", "rehearsal-slideshow.js",
  "favicon.svg", "manifest.webmanifest", "service-worker.js", "robots.txt", "CNAME"
];

function readLocalEnv() {
  if (!fs.existsSync(LOCAL_ENV_FILE)) return {};
  return fs.readFileSync(LOCAL_ENV_FILE, "utf8").split(/\r?\n/).reduce((values, line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return values;
    const separator = trimmed.indexOf("=");
    if (separator < 0) return values;
    values[trimmed.slice(0, separator).trim()] = trimmed.slice(separator + 1).trim();
    return values;
  }, {});
}

function escapeHtml(value) {
  return String(value || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function buildPlanner() {
  let html = fs.readFileSync(PLANNER_TEMPLATE, "utf8");
  for (const name of PLANNER_FILES) {
    const include = fs.readFileSync(path.join(ROOT, "src", "html", "js", `${name}.html`), "utf8");
    const includePattern = new RegExp(`<\\?!= include\\("${name}"\\);? \\?>`);
    html = html.replace(includePattern, () => include);
  }
  const local = readLocalEnv();
  const feed = process.env.PUBLIC_RSVP_FEED_URL || local.PUBLIC_RSVP_FEED_URL || "";
  const planner = process.env.PLANNER_PROXY_URL || local.PLANNER_PROXY_URL || feed;
  const clientId = process.env.GOOGLE_CLIENT_ID || local.GOOGLE_CLIENT_ID || "";
  const source = fs.readFileSync(VERSION_FILE, "utf8");
  const version = source.match(/PLANNER_BUILD_VERSION\s*=\s*"([^"]+)"/)?.[1] || "dev";
  html = html.replace(/content="<\?= googleClientId \?>"/g, `content="${escapeHtml(clientId)}"`)
    .replace(/content="<\?= rsvpFeedUrl \?>"/g, `content="${escapeHtml(feed)}"`)
    .replace(/content="<\?= scriptBaseUrl \?>"/g, `content="${escapeHtml(planner)}"`)
    .replace(/content="<\?= plannerBuildVersion \?>"/g, `content="${escapeHtml(version)}"`);
  fs.mkdirSync(PLANNER_OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "dashboard.html"), html);
  fs.writeFileSync(path.join(PLANNER_OUT_DIR, "dashboard.html"), html);
  fs.writeFileSync(path.join(PLANNER_OUT_DIR, "Dashboard.html"), html);
  for (const file of ["manifest.webmanifest", "service-worker.js", "favicon.svg"]) {
    fs.copyFileSync(path.join(ROOT, file), path.join(PLANNER_OUT_DIR, file));
  }
  fs.cpSync(path.join(ROOT, "images"), path.join(PLANNER_OUT_DIR, "images"), { recursive: true });
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
for (const file of FILES) fs.copyFileSync(path.join(ROOT, file), path.join(OUT_DIR, file));
fs.cpSync(path.join(ROOT, "images"), path.join(OUT_DIR, "images"), { recursive: true });
for (const file of ["manifest.webmanifest", "service-worker.js", "favicon.svg"]) {
  fs.copyFileSync(path.join(ROOT, file), path.join(PLANNER_OUT_DIR, file));
}
fs.cpSync(path.join(ROOT, "images"), path.join(PLANNER_OUT_DIR, "images"), { recursive: true });
buildPlanner();
console.log("Built public wedding site at dist-public/.");
