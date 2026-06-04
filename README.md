# Hope & Caleb Site

Static GitHub Pages site for Hope Caylor and Caleb Montes. The root page is the wedding landing page, the original engagement and graduation site is preserved separately, and a new Google Apps Script planner scaffold now lives alongside the public site.

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

## Connect Google Sheets

1. Create a Google Spreadsheet.
2. Go to **Extensions > Apps Script**.
3. Paste the contents of `google-apps-script.js` into the Apps Script editor.
4. Save the project.
5. Click **Deploy > New deployment**.
6. Choose **Web app**.
7. Set **Execute as** to **Me**.
8. Set **Who has access** to **Anyone**.
9. Deploy and copy the Web app URL.
10. Paste that URL into `googleScriptUrl` in `script.js`.

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

## Wedding Planner Scaffold

This repo now also includes a `worship-plan-ts` style Google Apps Script frontend shell under `src/`, with public wedding views and a protected planner view in the same app.

Current planner pieces:

- `src/http.ts` - Apps Script web app entrypoint
- `src/rpc.ts` - RPC router
- `src/auth.ts` - Google ID token verification + admin check
- `src/features/planner.ts` - people/events CRUD against Sheets
- `src/html/index.html` - unified public + planner UI shell

Planner sheets created automatically:

- `Admins`
- `People`
- `Events`

### Planner setup

1. Run `npm install`
2. Copy `.clasp.json.example` to `.clasp.json`
3. Add your Apps Script project ID to `.clasp.json`
4. In Apps Script Script Properties, add `GOOGLE_CLIENT_ID`
5. Add your admin email to the `Admins` sheet after first deploy
6. Run `npm run build`
7. Run `npm run deploy`

The public celebration site remains in the root HTML/CSS/JS files and is not replaced by the planner scaffold.

### Run Planner Frontend Locally

For UI development, you can run the planner frontend locally while still using the Apps Script backend.

1. Deploy the Apps Script web app and copy its `/exec` URL
2. Set env vars in PowerShell:

```powershell
$env:APPS_SCRIPT_BASE = "https://script.google.com/macros/s/YOUR_DEPLOYMENT_ID/exec"
$env:GOOGLE_CLIENT_ID = "your-client-id.apps.googleusercontent.com"
```

3. Build the standalone page:

```powershell
npm run build:standalone
```

4. Serve it locally:

```powershell
npm run serve:standalone
```

Then open `http://localhost:5173`.

If you want Google sign-in to work on localhost, add `http://localhost:5173` as an authorized JavaScript origin in your Google OAuth client.

For auto-rebuilding local development, use:

```powershell
npm run dev:standalone
```

That watches `src/**/*`, rebuilds `dist-standalone`, and serves the local frontend on `http://localhost:5173`.

### Proxy Option

If you want the same setup pattern as `worship-plan-ts`, use the Worker in [wedding-planner-proxy/README.md](</C:/Users/belin/Local Sites/hope-caleb/wedding-planner-proxy/README.md:1>).

That lets the standalone frontend talk to a Cloudflare Worker URL instead of hitting Apps Script directly. In practice, that is the setup I would use for ongoing local development.

## Publish on GitHub Pages

Upload these files to the repository hosted at `https://bel-caylor.github.io/hope-caleb/` and enable GitHub Pages for the branch that contains `index.html`.

## Share Links

- Out-of-town / congratulations version: `https://hope-caleb.site/celebration.html`
- Party RSVP version: `https://hope-caleb.site/celebration.html?view=party`
- Potluck RSVP version: `https://hope-caleb.site/celebration.html?view=potluck`
- Save the Date version: `https://hope-caleb.site/celebration.html?view=save`
- Out-of-town Save the Date version: `https://hope-caleb.site/celebration.html?view=oot-save`
- TV slideshow: `https://hope-caleb.site/slideshow.html`
