const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const OUT_DIR = path.join(ROOT, "dist-standalone");
const INDEX_TEMPLATE = path.join(ROOT, "src", "html", "index.html");
const LOCAL_ENV_FILE = path.join(ROOT, ".env.standalone.local");
const VERSION_FILE = path.join(ROOT, "src", "version.ts");

const INCLUDE_FILES = ["util", "apps-planner"];
const LEGACY_FILES = [
  "index.html",
  "privacy-policy.html",
  "story.html",
  "terms-and-conditions.html",
  "travel.html",
  "site.css",
  "site.js",
  "slideshow.html",
  "rehearsal-slideshow-manager.html",
  "rehearsal-slideshow.html",
  "styles.css",
  "script.js",
  "slideshow.css",
  "rehearsal-slideshow-manager.css",
  "slideshow.js",
  "rehearsal-slideshow-manager.js",
  "rehearsal-slideshow.js",
  "favicon.svg",
  "manifest.webmanifest",
  "service-worker.js",
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
  try {
    fs.copyFileSync(sourcePath, targetPath);
  } catch (error) {
    if (error && (error.code === "EPERM" || error.code === "EACCES")) {
      console.warn(`[standalone] skipped locked file: ${relativePath}`);
      return;
    }
    throw error;
  }
}

function copyDirectoryToOut(relativePath) {
  const sourcePath = path.join(ROOT, relativePath);

  if (!fs.existsSync(sourcePath)) {
    return;
  }

  copyDirectoryRecursive(sourcePath, relativePath);
}

function copyDirectoryRecursive(sourcePath, relativePath) {
  const entries = fs.readdirSync(sourcePath, { withFileTypes: true });

  entries.forEach((entry) => {
    const entrySourcePath = path.join(sourcePath, entry.name);
    const entryRelativePath = path.join(relativePath, entry.name);

    if (entry.isDirectory()) {
      copyDirectoryRecursive(entrySourcePath, entryRelativePath);
      return;
    }

    copyFileToOut(entryRelativePath);
  });
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
  const googleClientId = process.env.GOOGLE_CLIENT_ID || localEnv.GOOGLE_CLIENT_ID || "";

  html = html.replace(
    /content="<\?= googleClientId \?>"/g,
    `content="${escapeHtml(googleClientId)}"`
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

  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "dashboard.html"), html);
  fs.writeFileSync(path.join(OUT_DIR, "Dashboard.html"), html);
  LEGACY_FILES.forEach(copyFileToOut);
  // Keep the root landing-page script available in dist-standalone for local/mobile testing.
  copyFileToOut("site.js");
  LEGACY_DIRECTORIES.forEach(copyDirectoryToOut);

  console.log("Copied root static site files into dist-standalone/.");
  console.log("Built standalone dashboard shell at dist-standalone/dashboard.html from src/html/index.html.");
  console.log("Wrote legacy uppercase entry at dist-standalone/Dashboard.html for case-sensitive hosts and old links.");
  if (!googleClientId) {
    console.warn("[standalone] GOOGLE_CLIENT_ID is empty. Google sign-in will not render until you set it in the environment or .env.standalone.local.");
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

try {
  main();
} catch (error) {
  console.error("[standalone] build failed:", error);
  process.exitCode = 1;
}
