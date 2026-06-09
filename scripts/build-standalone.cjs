const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const OUT_DIR = path.join(ROOT, "dist-standalone");
const INDEX_TEMPLATE = path.join(ROOT, "src", "html", "index.html");
const LOCAL_ENV_FILE = path.join(ROOT, ".env.standalone.local");
const VERSION_FILE = path.join(ROOT, "src", "version.ts");

const INCLUDE_FILES = ["util", "apps-planner"];
const LEGACY_FILES = [
  "index.html",
  "site.css",
  "site.js",
  "slideshow.html",
  "styles.css",
  "script.js",
  "slideshow.css",
  "slideshow.js",
  "favicon.svg",
  "robots.txt",
  "CNAME"
];
const LEGACY_DIRECTORIES = ["images"];

const readFile = (filePath) => fs.readFileSync(filePath, "utf8");

function readLocalEnvFile() {
  if (!fs.existsSync(LOCAL_ENV_FILE)) {
    return {};
  }

  return readFile(LOCAL_ENV_FILE)
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) {
        return acc;
      }

      const separatorIndex = trimmed.indexOf("=");
      if (separatorIndex === -1) {
        return acc;
      }

      const key = trimmed.slice(0, separatorIndex).trim();
      const value = trimmed.slice(separatorIndex + 1).trim();
      if (key) {
        acc[key] = value;
      }
      return acc;
    }, {});
}

const replaceInclude = (buffer, name, content) => {
  const tokens = [
    `<?!= include("${name}"); ?>`,
    `<?!= include("${name}") ?>`
  ];

  for (const token of tokens) {
    const index = buffer.indexOf(token);
    if (index >= 0) {
      return `${buffer.slice(0, index)}${content}${buffer.slice(index + token.length)}`;
    }
  }

  return buffer;
};

function copyFileToOut(relativePath) {
  const sourcePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(sourcePath)) {
    return;
  }

  const targetPath = path.join(OUT_DIR, relativePath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.copyFileSync(sourcePath, targetPath);
}

function copyDirectoryToOut(relativePath) {
  const sourcePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(sourcePath)) {
    return;
  }

  fs.cpSync(sourcePath, path.join(OUT_DIR, relativePath), { recursive: true });
}

function main() {
  if (!fs.existsSync(DIST)) {
    throw new Error('dist/ not found. Run "npm run build" first.');
  }

  const localEnv = readLocalEnvFile();
  const plannerBuildVersion = readPlannerBuildVersion();
  let html = readFile(INDEX_TEMPLATE);

  INCLUDE_FILES.forEach((name) => {
    const filePath = path.join(DIST, `${name}.html`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Standalone build missing dist/${name}.html.`);
    }
    html = replaceInclude(html, name, readFile(filePath));
  });

  const rsvpFeedUrl = process.env.PUBLIC_RSVP_FEED_URL || localEnv.PUBLIC_RSVP_FEED_URL || "";
  const plannerScriptBaseUrl = process.env.PLANNER_PROXY_URL || localEnv.PLANNER_PROXY_URL || rsvpFeedUrl;
  const dashboardPassword = process.env.DASHBOARD_PASSWORD || localEnv.DASHBOARD_PASSWORD || "";
  const dashboardPasswordHash = (process.env.DASHBOARD_PASSWORD_HASH || localEnv.DASHBOARD_PASSWORD_HASH || hashPassword(dashboardPassword)).trim();

  html = html.replace(
    /content="<\?= dashboardPasswordHash \?>"/g,
    `content="${escapeHtml(dashboardPasswordHash)}"`
  );
  html = html.replace(
    /content="<\?= rsvpFeedUrl \?>"/g,
    `content="${escapeHtml(rsvpFeedUrl)}"`
  );
  html = html.replace(
    /content="<\?= scriptBaseUrl \?>"/g,
    `content="${escapeHtml(plannerScriptBaseUrl)}"`
  );
  html = html.replace(
    /content="<\?= plannerBuildVersion \?>"/g,
    `content="${escapeHtml(plannerBuildVersion)}"`
  );

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "dashboard.html"), html);
  LEGACY_FILES.forEach(copyFileToOut);
  // Keep the root landing-page script available in dist-standalone for local/mobile testing.
  copyFileToOut("site.js");
  LEGACY_DIRECTORIES.forEach(copyDirectoryToOut);

  console.log("Copied root static site files into dist-standalone/.");
  console.log("Built standalone dashboard shell at dist-standalone/dashboard.html from src/html/index.html.");
  if (!dashboardPasswordHash) {
    console.warn("[standalone] DASHBOARD_PASSWORD is empty. The dashboard will render, but it will not unlock until you set a password or hash.");
  }
  if (!rsvpFeedUrl) {
    console.warn("[standalone] PUBLIC_RSVP_FEED_URL is empty. The dashboard can still work, but the RSVP panel will stay disconnected.");
  }
  if (!plannerScriptBaseUrl) {
    console.warn("[standalone] PLANNER_PROXY_URL is empty. Planner RPC calls will use the same URL as the RSVP feed.");
  }
}

function readPlannerBuildVersion() {
  const source = readFile(VERSION_FILE);
  const match = source.match(/PLANNER_BUILD_VERSION\s*=\s*"([^"]+)"/);
  return match?.[1] || "dev";
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function hashPassword(value) {
  const normalized = String(value || "").trim();
  if (!normalized) {
    return "";
  }

  return crypto.createHash("sha256").update(normalized).digest("hex");
}

try {
  main();
} catch (error) {
  console.error("[standalone] build failed:", error);
  process.exitCode = 1;
}
