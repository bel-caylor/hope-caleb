import { build } from "esbuild";

await build({
  entryPoints: ["src/http.ts"],
  outfile: "dist/Code.js",
  bundle: true,
  format: "iife",
  target: "es2020",
  platform: "browser",
  sourcemap: false,
  logLevel: "info"
});
