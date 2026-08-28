# Deployment policy

- The user, not Codex, creates and updates Google Apps Script deployments. Do not run `clasp deploy`, `clasp push`, `npm run deploy`, or any command that creates, versions, pushes, or deploys the Apps Script project unless the user explicitly asks in that turn.
- When an Apps Script deployment is needed, ask the user to create it and provide its `/exec` URL. Use the URL they provide for any requested configuration updates, but do not attempt to create a replacement deployment.
- Cloudflare Worker deployments are separate. Deploy the Worker only when the user explicitly requests a Cloudflare Worker deployment.
