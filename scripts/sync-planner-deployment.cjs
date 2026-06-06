const { spawnSync } = require("child_process");
const path = require("path");

const ROOT = process.cwd();
const PROXY_DIR = path.join(ROOT, "wedding-planner-proxy");
const execUrl = String(process.argv[2] || "").trim();

if (!execUrl) {
  console.error("Usage: node scripts/sync-planner-deployment.cjs https://script.google.com/macros/s/DEPLOYMENT_ID/exec");
  process.exit(1);
}

if (!/^https:\/\/script\.google\.com\/macros\/s\/[^/]+\/exec$/i.test(execUrl)) {
  console.error("Expected a full Apps Script /exec URL.");
  process.exit(1);
}

const baseUrl = execUrl.replace(/\/exec\/?$/i, "");

run(rootCommand("npm"), ["run", "planner:set-url", "--", execUrl], ROOT);
run(proxyCommand("npx"), ["wrangler", "secret", "put", "APPS_SCRIPT_BASE"], PROXY_DIR, `${baseUrl}\n`);
run(proxyCommand("npm"), ["run", "deploy"], PROXY_DIR);
run(rootCommand("npm"), ["run", "build"], ROOT);
run(rootCommand("npm"), ["run", "planner:check"], ROOT);

console.log("");
console.log("Planner deployment sync complete.");

function rootCommand(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function proxyCommand(name) {
  return process.platform === "win32" ? `${name}.cmd` : name;
}

function run(command, args, cwd, input) {
  const result = spawnSync(command, args, {
    cwd,
    input,
    stdio: input ? ["pipe", "inherit", "inherit"] : "inherit",
    encoding: "utf8"
  });

  if (result.error) {
    console.error(`Failed to run ${command} ${args.join(" ")}`);
    console.error(result.error.message);
    process.exit(1);
  }

  if (typeof result.status === "number" && result.status !== 0) {
    process.exit(result.status);
  }
}
