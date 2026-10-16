# Security

ATV World is public and anyone can push to `main`, so the guardrails protect the secrets and the Azure resources, not what people build.

## What's protected

- **No secrets in the repo.** Deploy credentials live in GitHub secrets (`AZURE_STATIC_WEB_APPS_API_TOKEN`) and Azure app settings (`WPS_ENDPOINT`, `WPS_ACCESS_KEY`, `HQ_PUBLISH_KEY`). GitHub secret scanning and push protection are on, so a pushed key is blocked or flagged. Never commit a key, token, or connection string; if one slips out, rotate it in Azure first, then remove it.
- **Pinned deploy actions.** The actions that receive deploy credentials (`Azure/static-web-apps-deploy`, `azure/login`) are pinned to commit SHAs, so a moved tag can't swap them out.
- **Browser hardening.** `public/staticwebapp.config.json` sets HSTS, a Content-Security-Policy (no plugins, no foreign framing except Teams/Office, same-origin forms and base URL), and a Permissions-Policy that turns off camera, microphone, location, payments, and USB.
- **Multiplayer token.** `/api/negotiate` is anonymous by design (there are no accounts). Its tokens last 15 minutes and are rate-limited per caller. They only allow joining and talking in the one `world` group.

## Things to know

- Multiplayer messages are self-reported by each browser, so a player can pretend to be another one. Names and chat are casual, not authenticated. Don't build anything here that trusts them for something that matters.
- Anything that runs in the build (`package.json` scripts, `scripts/build.ts`) runs on a GitHub runner next to the deploy token. Treat changes to `package.json`, `scripts/`, `.github/`, and `api/` with extra care when you review what landed.
- Render text from other people (names, chat, roster) as text, never as HTML.

## Reporting a problem

Open an issue, or message the maintainers (@Bakar404) for anything involving a leaked key.
