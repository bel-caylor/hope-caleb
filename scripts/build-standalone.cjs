const fs = require("fs");
const path = require("path");
const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, "dist-standalone");
const DIST = path.join(ROOT, "dist");
const SOURCE_HTML = path.join(ROOT, "src", "html", "js");
const LOCAL_ENV_FILE = path.join(ROOT, ".env.standalone.local");
const VERSION_FILE = path.join(ROOT, "src", "version.ts");
const INCLUDE_FILES = ["util", "apps-planner"];
const LEGACY_FILES = [
  "index.html", "privacy-policy.html", "sms-opt-in-proof.html", "story.html",
  "terms-and-conditions.html", "travel.html", "site.css", "site.js", "slideshow.html",
  "rehearsal-slideshow-manager.html", "rehearsal-slideshow.html", "styles.css", "script.js",
  "slideshow.css", "rehearsal-slideshow-manager.css", "slideshow.js",
  "rehearsal-slideshow-manager.js", "rehearsal-slideshow.js", "favicon.svg",
  "manifest.webmanifest", "service-worker.js", "robots.txt", "CNAME"
];

function injectIncludes(html) {
  for (const name of INCLUDE_FILES) {
    const distSource = path.join(DIST, `${name}.html`);
    const source = fs.readFileSync(fs.existsSync(distSource) ? distSource : path.join(SOURCE_HTML, `${name}.html`), "utf8");
    const includePattern = new RegExp(`<\\?!= include\\("${name}"\\);? \\?>`);
    html = html.replace(includePattern, () => source);
  }
  return html;
}
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
function configurePlanner(html) {
  const local = readLocalEnv();
  const feed = process.env.PUBLIC_RSVP_FEED_URL || local.PUBLIC_RSVP_FEED_URL || "";
  const planner = process.env.PLANNER_PROXY_URL || local.PLANNER_PROXY_URL || feed;
  const clientId = process.env.GOOGLE_CLIENT_ID || local.GOOGLE_CLIENT_ID || "";
  const versionSource = fs.readFileSync(VERSION_FILE, "utf8");
  const version = versionSource.match(/PLANNER_BUILD_VERSION\s*=\s*"([^"]+)"/)?.[1] || "dev";
  return html.replace(/content="<\?= googleClientId \?>"/g, `content="${escapeHtml(clientId)}"`)
    .replace(/content="<\?= rsvpFeedUrl \?>"/g, `content="${escapeHtml(feed)}"`)
    .replace(/content="<\?= scriptBaseUrl \?>"/g, `content="${escapeHtml(planner)}"`)
    .replace(/content="<\?= plannerBuildVersion \?>"/g, `content="${escapeHtml(version)}"`);
}
function copy(relativePath) {
  const source = path.join(ROOT, relativePath);
  if (!fs.existsSync(source)) return;
  const target = path.join(OUT_DIR, relativePath);
  fs.mkdirSync(path.dirname(target), { recursive: true });
  fs.copyFileSync(source, target);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });
const template = fs.readFileSync(path.join(ROOT, "src", "html", "index.html"), "utf8");
const html = configurePlanner(injectIncludes(template));
fs.writeFileSync(path.join(OUT_DIR, "dashboard.html"), html);
fs.writeFileSync(path.join(OUT_DIR, "Dashboard.html"), html);
for (const file of LEGACY_FILES) copy(file);
fs.cpSync(path.join(ROOT, "images"), path.join(OUT_DIR, "images"), { recursive: true });
console.log("Built standalone planner and local site at dist-standalone/.");
