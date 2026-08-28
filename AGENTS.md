# Apps Script and Worker release workflow

For every change that affects Apps Script, use this sequence:

1. Run `npm run deploy` to build and push the local Apps Script source with `clasp push -f`. This synchronizes source only; it does not create an Apps Script web-app deployment.
2. Stop. The user creates the Apps Script deployment manually and provides its new `/exec` URL.
3. Update the configured Apps Script URL, update the Cloudflare Worker `APPS_SCRIPT_BASE` secret, and deploy the Worker.
4. Commit and push the resulting source/configuration changes to the `wedding` branch.

Never run `clasp deploy` or otherwise create/version an Apps Script deployment. The user always performs that step.
