# Release workflow

## Frontend-only changes

For changes limited to browser UI, HTML, CSS, client-side JavaScript, copy, or static-site assets:

1. Build the public site with `npm run build:public`, then commit and push the static-site change to the `wedding` branch.
2. Do **not** run `npm run deploy`, `clasp push`, create an Apps Script deployment, request a new `/exec` URL, or update/deploy the Cloudflare Worker.

### Local preview

- The root files (`index.html`, `site.css`, `site.js`, etc.) are the source files. `npm run serve:live` serves `dist-public`, not the root, so source edits will not appear in that preview until `npm run build:public` copies them there.
- After every frontend change, run `npm run build:public` and verify the changed file in `dist-public` (or reload the preview after building). Do not assume a successful source edit or build has updated the browser's displayed page.
- HTML links to versioned assets such as `site.css?v=...`. Browsers may retain a cached copy at a given version URL, even after the generated file changes. When a style change still does not appear after rebuilding, bump the asset's query-string version in the relevant source HTML, rebuild, and hard-refresh the preview.
- `npm run dev:standalone` starts a watcher that rebuilds `dist-public` when watched source files change; `npm run serve:live` by itself does not watch the root source files.

## Backend changes

For changes to Apps Script server behavior, RPCs, spreadsheet reads/writes, authentication, or other backend TypeScript:

1. Run `npm run deploy` to build and push the local Apps Script source with `clasp push -f`. This synchronizes source only; it does not create an Apps Script web-app deployment.
2. Stop. The user creates the Apps Script deployment manually and provides its new `/exec` URL.
3. Update the configured Apps Script URL, update the Cloudflare Worker `APPS_SCRIPT_BASE` secret, and deploy the Worker.
4. Commit and push the resulting source/configuration changes to the `wedding` branch.

Never run `clasp deploy` or otherwise create/version an Apps Script deployment. The user always performs that step.
