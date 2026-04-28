# Hope & Caleb Party RSVP

Static GitHub Pages site for Hope Caylor and Caleb Montes' engagement and graduation party.

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

## Publish on GitHub Pages

Upload these files to the repository hosted at `https://bel-caylor.github.io/hope-caleb/` and enable GitHub Pages for the branch that contains `index.html`.
