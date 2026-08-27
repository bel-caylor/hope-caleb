# Hope & Caleb Site

Static GitHub Pages site for Hope Caylor and Caleb Montes. This repo contains two parallel frontends:

- A root static site built from the top-level HTML/CSS/JS files
- A standalone wedding dashboard/public shell built from `src/` into `dist-standalone/`

## Start Here

Use this table before editing anything:

| What you want to change | Edit this source file | Rebuild / serve from |
| --- | --- | --- |
| Root wedding landing page at `/` | `index.html`, `site.css`, `site.js` | Root files directly |
| Dashboard/public shell at `/dashboard.html` or local standalone dev | `src/html/index.html` and `src/html/js/*` | `dist-standalone/` via `npm run build` |
| Preserved celebration page | `celebration.html`, `styles.css`, `script.js` | Root files directly |
| TV slideshow | `slideshow.html`, `slideshow.css`, `slideshow.js` | Root files directly |

For a focused version of this workflow, see [docs/build-workflow.md](/C:/Users/belin/Local%20Sites/hope-caleb/docs/build-workflow.md).

## Build Outputs

These two folders are not interchangeable:

- `dist/`
  - Intermediate build output
  - Produced by `npm run build:core`
  - Contains copied `src/html/**/*.html`, built Apps Script code from `src/http.ts`, and JSON assets
  - Used as an input to the standalone assembly step
- `dist-standalone/`
  - Final standalone frontend output
  - Produced by `npm run build`
  - Contains the files you actually serve for local standalone/dashboard work
  - Most important generated file: `dist-standalone/dashboard.html`

## Recommended Workflow

For dashboard or planner work:

1. Edit `src/html/index.html` or `src/html/js/*`
2. Run `npm run build`
3. Open or refresh the page served from `dist-standalone/`

For Apps Script backend work:

1. Edit `src/**/*.ts` or `src/appsscript.json`
2. Run `npm run build:core`
3. Run `npm run deploy`
4. Update the Apps Script web app deployment to the latest version if your `/exec` URL is versioned

For local dashboard development with auto-rebuild:

```powershell
npm run dev:standalone
```

That watches source files, rebuilds `dist-standalone`, and serves the local frontend on `http://localhost:5173`. It also listens on your local network, so devices on the same Wi-Fi can use `http://YOUR-COMPUTER-IP:5173/dashboard.html`.

For root static site work:

1. Edit the top-level files like `index.html`, `site.css`, `site.js`
2. Refresh the root-served page

## Common Mistake To Avoid

If the page you are viewing is `dashboard.html` or coming from `http://localhost:5173`, do not edit the top-level `index.html` and expect that page to change. In that case, the source of truth is `src/html/index.html`, and the rendered output lives in `dist-standalone/dashboard.html`.

The default `npm run build` now regenerates that standalone dashboard output automatically so the served page stays in sync.

## Edit Party Details

Open `script.js` and update:

```js
const EVENT = {
  date: "Coming soon",
  time: "Coming soon",
  location: "Coming soon",
  googleScriptUrl: ""
};
```

## Add An Amazon Registry To The Landing Page

The root wedding page supports a direct Amazon registry link by default. Open [site.js](/C:/Users/belin/Local%20Sites/hope-caleb/site.js:1) and set:

```js
const AMAZON_REGISTRY = {
  publicUrl: "https://www.amazon.com/registries/...",
  embedUrl: "https://your-worker.your-subdomain.workers.dev/amazon-registry"
};
```

After `publicUrl` is filled in, the `#registry` section on the root page will show a live button that opens the Amazon registry directly.

If you also want to experiment with an embedded proxy view, use the existing Cloudflare Worker:

1. Set your public Amazon registry URL as a Worker secret:

```powershell
cd wedding-planner-proxy
npx wrangler secret put AMAZON_REGISTRY_URL
```

2. Deploy the worker:

```powershell
npm run deploy
```

3. Set `embedUrl` in `site.js` to:

```text
https://your-worker.your-subdomain.workers.dev/amazon-registry
```

## Connect Google Sheets

1. Create a Google Spreadsheet.
2. Go to **Extensions > Apps Script**.
3. Set the `SPREADSHEET_ID` script property to the spreadsheet ID you want the web app to read.
4. Run `npm run deploy` from this repo.
5. In Apps Script, update the **Web app** deployment to the latest version.
6. Copy the `/exec` URL.
7. Paste that URL into `googleScriptUrl` in `script.js`.

### Optional RSVP Email Notifications

If you want an email whenever someone submits an RSVP:

1. In your Apps Script project, go to **Project Settings**.
2. Under **Script Properties**, add a property named `RSVP_NOTIFICATION_EMAILS`.
3. Set the value to one or more email addresses separated by commas.

Example:

```text
RSVP_NOTIFICATION_EMAILS=you@example.com,partner@example.com
```

After that, every new RSVP submission will send an email with the guest name, email, attendance answer, guest count, comment, and submission time.

## Main Pages

- Wedding home: `https://hope-caleb.site/`
- Preserved engagement / graduation site: `https://hope-caleb.site/celebration.html`
- Slideshow: `https://hope-caleb.site/slideshow.html`

## Wedding Dashboard

This repo now includes a protected dashboard under `src/`, with public wedding views and a private planner route in the same app.

### Install on a Phone or Tablet

After the site is deployed over HTTPS, open `https://hope-caleb.site/dashboard.html` in the device browser:

- iPhone or iPad: tap **Share**, then **Add to Home Screen**.
- Android: use the browser menu and choose **Install app** or **Add to Home screen**.

The installed dashboard opens in its own app window and keeps the dashboard shell available when a connection is temporarily unavailable. It still needs an internet connection for live RSVP and planner data.

Current dashboard pieces:

- `src/html/index.html` - unified public + planner UI shell
- `src/html/js/apps-planner.html` - Google sign-in gate, RSVP panel, and planning tools
- `src/http.ts` - Apps Script entrypoint bundled to `dist/Code.js`
- `src/features/feed.ts` - public RSVP/comments/Guests feed logic
- `scripts/build-standalone.cjs` - standalone builder with Google client ID injection
- `dist-standalone/dashboard.html` - generated standalone output for the dashboard shell

The dashboard currently includes:

- `RSVPs` loaded from the public RSVP Apps Script feed
- `People` synced through Apps Script to the `People` sheet
- `Events` synced through Apps Script to the `Events` sheet

The public celebration site remains in the root HTML/CSS/JS files and is not replaced by the dashboard scaffold.

### Run Dashboard Locally

For UI development, you can run the dashboard locally without Google Sign-In.

1. Copy `.env.standalone.example` to `.env.standalone.local`
2. Set env vars in PowerShell:

```powershell
$env:GOOGLE_CLIENT_ID = "your-google-oauth-client-id.apps.googleusercontent.com"
$env:PUBLIC_RSVP_FEED_URL = "https://script.google.com/macros/s/YOUR_RSVP_DEPLOYMENT_ID/exec"
$env:PLANNER_PROXY_URL = "https://hope-caleb-wedding-planner-proxy.your-subdomain.workers.dev"
```

Set the same `GOOGLE_CLIENT_ID` value in your Apps Script project under **Script Properties** so the backend can verify the browser's Google ID token.

3. Build the standalone page:

```powershell
npm run build:standalone
```

4. Serve it locally:

```powershell
npm run serve:standalone
```

Then open `http://localhost:5173` on this computer, or `http://YOUR-COMPUTER-IP:5173/dashboard.html` from a tablet on the same Wi-Fi network. When Windows asks, allow Node.js through the firewall on **Private networks**.

### RSVP Feed Setup

The public RSVP form and the dashboard both use the Apps Script project built from [src/http.ts](/C:/Users/belin/Local%20Sites/hope-caleb/src/http.ts:1) and [src/features/feed.ts](/C:/Users/belin/Local%20Sites/hope-caleb/src/features/feed.ts:1).

1. Create a Google Spreadsheet.
2. Go to **Extensions > Apps Script**.
3. In **Project Settings**, set `SPREADSHEET_ID` to the spreadsheet the feed should read.
4. Run `npm run deploy`.
5. Update the web app deployment to the latest version with access set to **Anyone**.
6. Copy the deployment `/exec` URL.
7. Use that URL in both `script.js` and `PUBLIC_RSVP_FEED_URL`.

The dashboard loads RSVPs with JSONP, so it avoids the CORS problem you hit when loading Apps Script directly from `localhost`.

### Source Of Truth

- `src/http.ts` is the Apps Script entrypoint that builds to `dist/Code.js`
- A front-page group RSVP is recorded in three places by `src/features/feed.ts`: the append-only `RSVPs` sheet is the submission history (time, note, event choices, and party details); `Guests` is the current per-person attendance list; and `Groups` is the current invitation-level summary. The planner RSVP panel shows both the submission history and the live guest attendance view.
- `src/features/feed.ts` handles public RSVP submissions, comments, media, and the `Guests` sheet feed
- `src/features/planner.ts` handles planner-only People and Events RPC methods
- `dist/` is generated output for `clasp`, not a file you should edit directly
- The old root-level `google-apps-script.js` file has been removed

## Publish on GitHub Pages

This repo can publish the built standalone site from `dist-standalone/` with GitHub Actions.

1. In GitHub, go to **Settings > Pages**.
2. Set **Source** to **GitHub Actions**.
3. In **Settings > Secrets and variables > Actions > Variables**, add:
   - `PUBLIC_RSVP_FEED_URL`
   - `PLANNER_PROXY_URL`
   - `GOOGLE_CLIENT_ID`
4. Push to the `wedding` branch.

The workflow at `.github/workflows/deploy-pages.yml` builds `dist-standalone/` and deploys it, so `/dashboard.html` is published even though the generated file is gitignored locally.

## Share Links

- Out-of-town / congratulations version: `https://hope-caleb.site/celebration.html`
- Party RSVP version: `https://hope-caleb.site/celebration.html?view=party`
- Potluck RSVP version: `https://hope-caleb.site/celebration.html?view=potluck`
- Save the Date version: `https://hope-caleb.site/celebration.html?view=save`
- Out-of-town Save the Date version: `https://hope-caleb.site/celebration.html?view=oot-save`
- TV slideshow: `https://hope-caleb.site/slideshow.html`
