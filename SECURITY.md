# Security

ATV World is public and anyone can push to `main`, so the guardrails protect the secrets and the Azure resources, not what people build.

## What's protected

- **No secrets in the repo.** Deploy credentials live in GitHub secrets (`AZURE_STATIC_WEB_APPS_API_TOKEN`) and Azure app settings (`WPS_ENDPOINT`, `WPS_ACCESS_KEY`, `HQ_PUBLISH_KEY`). GitHub secret scanning and push protection are on, so a pushed key is blocked or flagged. Never commit a key, token, or connection string; if one slips out, rotate it in Azure first, then remove it.
- **Pinned deploy actions.** The actions that receive deploy credentials (`Azure/static-web-apps-deploy`, `azure/login`) are pinned to commit SHAs, so a moved tag can't swap them out.
- **Browser hardening.** `public/staticwebapp.config.json` sets HSTS, a Content-Security-Policy (no plugins, no foreign framing except Teams/Office, same-origin forms and base URL), and a Permissions-Policy that turns off camera, microphone, location, payments, and USB.
- **Multiplayer token.** `/api/negotiate` is anonymous by design (there are no accounts). Its tokens last 15 minutes and are rate-limited per address (generous enough for a shared office network). They only allow joining and talking in the one `world` group. Web PubSub refuses connections without a token.
- **Fork pull requests wait.** Auto-merge only merges pull requests from people who can push here. It talks to the GitHub API and never checks out or runs pull request code.

## Things to know

- **Keys are only as private as the people who can push.** A workflow or an `api/` function that lands on `main` can read the deploy token and the Static Web App's app settings. Only add keys scoped to this world. Never add keys for paid AI services or for other Azure resources. If a key may have leaked, rotate it (see below).
- Multiplayer messages are self-reported by each browser, so a player can pretend to be another one. Names and chat are casual, not authenticated. Don't build anything here that trusts them for something that matters.
- Multiplayer runs on Web PubSub Standard (one unit): 1,000 connections at once and 2 GB of outbound traffic a day included. Traffic past that is billed, so a traffic alert (over 5 GB in an hour) and a $100 monthly budget on `rg-atv-world` email the maintainer. If connections fill up, people play solo until it frees up.
- Anything that runs in the build (`package.json` scripts, `scripts/build.ts`) runs on a GitHub runner next to the deploy token. Treat changes to `package.json`, `scripts/`, `.github/`, and `api/` with extra care when you review what landed.
- Render text from other people (names, chat, roster) as text, never as HTML.
- `.github/workflows/deploy-atvworld-webapp.yml` signs in to a separate Azure subscription through OIDC, and that identity trusts pushes to `main`. Its owner should keep its role to Website Contributor on that one web app, or trust only a protected environment.
- `npm audit` flags the old `axios` that `@microsoft/live-share` (Teams HQ) pulls in. That's already the newest Live Share, most of those issues are Node-side, and it only loads inside Teams. Recheck when Live Share updates.

## Rotating keys

The SWA deploy token (then update the GitHub secret):

```sh
az staticwebapp secrets reset-api-key -n swa-atv-world -g rg-atv-world -o none
az staticwebapp secrets list -n swa-atv-world -g rg-atv-world --query properties.apiKey -o tsv | gh secret set AZURE_STATIC_WEB_APPS_API_TOKEN -R All-The-Vibes/ATV-world
```

The Web PubSub key (then update the app setting):

```sh
az webpubsub key regenerate -n wps-atv-world -g rg-atv-world --key-type secondary -o none
key=$(az webpubsub key regenerate -n wps-atv-world -g rg-atv-world --key-type primary --query primaryKey -o tsv)
az staticwebapp appsettings set -n swa-atv-world -g rg-atv-world --setting-names WPS_ACCESS_KEY="$key" -o none
```

## Reporting a problem

Open an issue, or message the maintainers (@Bakar404) for anything involving a leaked key.
