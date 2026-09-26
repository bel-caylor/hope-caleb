const liveServer = require("live-server");

liveServer.start({
  root: "dist-public",
  host: "0.0.0.0",
  port: 5173,
  open: false,
  watch: ["dist-public"],
  logLevel: 2,
});
