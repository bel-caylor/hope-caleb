const os = require("node:os");
const liveServer = require("live-server");

const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((address) => address && address.family === "IPv4" && !address.internal)
  .map((address) => address.address)
  .filter((address) => !address.startsWith("169.254."));

console.log("Local dashboard: http://localhost:5173/dashboard.html");
for (const address of lanAddresses) {
  console.log(`Tablet URL:      http://${address}:5173/dashboard.html`);
}

liveServer.start({
  root: "dist-standalone",
  host: "0.0.0.0",
  port: 5173,
  open: false,
  watch: ["dist-standalone"],
  logLevel: 2,
});
