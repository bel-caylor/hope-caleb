# Build Workflow

This repo has two different frontend paths.

## 1. Root Static Site

Source files:

- `index.html`
- `site.css`
- `site.js`
- `celebration.html`
- `styles.css`
- `script.js`
- `slideshow.html`
- `slideshow.css`
- `slideshow.js`

Use this path when changing:

- the root landing page at `/`
- the preserved celebration page
- the slideshow page

These files are served directly. No standalone rebuild is required unless you also need them copied into `dist-standalone/`.

## 2. Standalone Dashboard/Public Shell

Source files:

- `src/html/index.html`
- `src/html/js/util.html`
- `src/html/js/apps-planner.html`
- `src/**/*.ts`

Generated outputs:

- `dist/` from `npm run build`
- `dist-standalone/dashboard.html` from `npm run build:standalone`

Use this path when changing:

- `dashboard.html`
- the local standalone app served at `http://localhost:5173`
- planner/dashboard UI
- the Apps Script backend deployed with `clasp`

Apps Script source of truth:

- `src/http.ts` builds to `dist/Code.js`
- `src/features/feed.ts` contains the public RSVP/comments/Guests feed
- `src/features/planner.ts` contains planner RPC methods
- `src/appsscript.json` is the Apps Script manifest

## Dist vs Dist-Standalone

- `dist/` is an intermediate build folder
- `dist-standalone/` is the final standalone frontend folder

`build:standalone` depends on `dist/`, then assembles the standalone output.

## Safe Editing Checklist

Before editing:

1. Identify the URL or file you are actually changing.
2. Match it to the correct source file.
3. Rebuild the correct output if needed.

If viewing `dashboard.html` or `http://localhost:5173`:

1. Edit `src/html/index.html`
2. Run `npm run build:standalone`
3. Refresh the page

If changing Apps Script behavior:

1. Edit `src/**/*.ts`
2. Run `npm run build`
3. Run `npm run deploy`
4. Update the Apps Script web app deployment to the latest version if needed

If viewing `/`:

1. Edit `index.html`
2. Refresh the page
