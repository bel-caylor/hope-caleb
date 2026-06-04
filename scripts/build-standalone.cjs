const fs = require("fs");
const path = require("path");

const ROOT = process.cwd();
const DIST = path.join(ROOT, "dist");
const OUT_DIR = path.join(ROOT, "dist-standalone");
const INDEX_TEMPLATE = path.join(ROOT, "src", "html", "index.html");

const INCLUDE_FILES = ["util", "apps-planner"];
const LEGACY_FILES = [
  "celebration.html",
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

const replaceInclude = (buffer, name, content) => {
  const pattern = new RegExp(`<\\?!=\\s*include\\("${name}"\\);?\\s*\\?>`, "g");
  return buffer.replace(pattern, content);
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

  let html = readFile(INDEX_TEMPLATE);

  INCLUDE_FILES.forEach((name) => {
    const filePath = path.join(DIST, `${name}.html`);
    if (!fs.existsSync(filePath)) {
      throw new Error(`Standalone build missing dist/${name}.html.`);
    }
    html = replaceInclude(html, name, readFile(filePath));
  });

  const appsScriptBase = process.env.APPS_SCRIPT_BASE || "";
  const googleClientId = process.env.GOOGLE_CLIENT_ID || "";

  html = html.replace(
    /content="<\?= googleClientId \?>"/g,
    `content="${escapeHtml(googleClientId)}"`
  );
  html = html.replace(
    /content="<\?= scriptBaseUrl \?>"/g,
    `content="${escapeHtml(appsScriptBase)}"`
  );

  fs.rmSync(OUT_DIR, { recursive: true, force: true });
  fs.mkdirSync(OUT_DIR, { recursive: true });
  fs.writeFileSync(path.join(OUT_DIR, "index.html"), html);
  LEGACY_FILES.forEach(copyFileToOut);
  LEGACY_DIRECTORIES.forEach(copyDirectoryToOut);

  console.log("Standalone planner written to dist-standalone/index.html");
  if (!appsScriptBase) {
    console.warn("[standalone] APPS_SCRIPT_BASE is empty. Local frontend will load, but RPC calls will fail until you set it.");
  }
  if (!googleClientId) {
    console.warn("[standalone] GOOGLE_CLIENT_ID is empty. Google sign-in will not render until you set it.");
  }
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
