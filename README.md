![ATV World hackathon illustration with people and robots building a shared virtual world](assets/atv-world-hackathon.png)

# 🌍 ATV World

**One world. All the vibes. Absolutely no pull requests.**

Welcome to the ultimate All the Vibes hackathon: a virtual world built by everyone, owned by everyone, and occasionally set on fire by everyone. Every ATV team member can commit directly to `main`. The world is our canvas. Git history is our incident documentary.

## Meet the agents of questionable judgment

- **Steph:** Turning “what if we…” into a shared universe and everyone else's weekend plans.
- **Darth Vader:** Finds your lack of commits disturbing.
- **Nemo:** Just keep shipping. Just keep shipping.
- **Ralph Wiggum (The Simpsons):** “I'm a developer!” Somehow, his code works.
- **Pac-Man:** Eats bugs. Also dependencies. Also the floor.
- **Rocky (Project Hail Mary):** Five limbs. Zero excuses. Amaze, amaze, amaze!
- **A Girl Scout:** Ships features. Sells cookies. The only agent with a sustainable business model.
- **A Phoenix:** Calls every production outage a personal rebrand.

## How to make this everyone's problem

1. Pull the latest `main`.
2. Add something wonderful: a place, a character, a game, or a deeply unnecessary volcano.
3. Commit and push straight to `main`. No PRs. No approval queue. You live here now.
4. Respect each other's creations. If you break the world, help fix it. Bring snacks.

**Build boldly. Pull often. Leave the world weirder than you found it.**

## Prerequisites

| Tool | Version | Notes |
| --- | --- | --- |
| [Node.js](https://nodejs.org/) | 24 LTS (22.12+ works) | `.nvmrc` pins 24 |
| npm | 10+ | Ships with Node |
| [Git](https://git-scm.com/) | Any recent version | You'll be pushing to `main` a lot |
| A browser | WebGL 2 | Chrome, Edge, Firefox, or Safari 15+ |

Optional: [GitHub CLI](https://cli.github.com/) to watch your push go live (`gh run watch`).

## What's inside

**Stack:** Phaser 4.2, React 19.3, TypeScript 7.0, and Vite 8.3.

- `src/game/kit/` draws all the pixel art in code: characters, buildings, trees, props, and a tiny font. Every color slot takes any color, and every catalog is open, so add your own.
- `src/game/world/layout.ts` is the lot grid the town grows on.
- `src/game/scenes/Preview.ts` is the world on the live screen.
- `src/game/view.ts` is the camera: F fits the whole world, +/- or the mouse wheel zooms, dragging looks around, and the view survives reloads.
- `src/live.ts` is the LIVE badge in the bottom left. It shows the commit that's live and reloads the page when a newer push deploys.
- `src/game/hq/` is ATV HQ: everyone on the Teams call gets a random avatar, coding at a desk. Desks fill eight to a floor, and the building grows a floor at a time as the call does.
- `src/call/` is the call itself: who's on it (from Teams, the website mirror, the demo, or the URL) and the panel you see inside ATV HQ.
- `api/` is the Static Web App's API: `/api/hq` mirrors one Teams meeting onto the website.

Every push to `main` goes live within a few minutes, and the live page reloads itself to show it. CI (typecheck and build) and CodeQL run on every push too.

## ATV HQ: your Teams call, hard at work

Everyone on the call walks in the front door, sits down at a desk, and starts coding. Their avatar is random, but the same on every screen, every time. Lights flick on when someone joins and off when they leave. Desks fill eight to a floor, so a 50-person call is a six-storey HQ.

Walk into HQ (or click it, or press H) to see who's there: the call panel only shows up inside. Press down or **Step out** to leave.

1. Walk into HQ and click **Add to Teams**. It downloads `atv-world-teams.zip`.
2. In Teams, go to **Apps › Manage your apps › Upload an app** and pick that file.
3. In a meeting, add **ATV World** from **+ Apps**, hit **Save**, then **Share to stage**. Everyone gets a desk.

Teams counts the people who have ATV World open (in the side panel or on the stage), so sharing it to the stage brings in the whole call. It syncs with Live Share, which Teams hosts. Every meeting gets its own session, so a meeting's HQ only ever holds that meeting.

### Show one meeting on the website

Out of the box, the public site's HQ stays empty: the call lives inside Teams. To let everyone on the website watch one meeting, turn on the mirror:

1. Pick a secret and give it to the site: `az staticwebapp appsettings set -n swa-atv-world -g rg-atv-world --setting-names HQ_PUBLISH_KEY=<secret>`
2. When adding ATV World to that meeting, type the secret into **website mirror key** on the setup page, then Save and share to stage.

Save trades the secret for a publish token that only works for that meeting and lasts two weeks, so the secret itself never goes into a URL. ATV World in that meeting then posts who's there to `/api/hq` every few seconds, and the website shows them. A meeting keeps HQ until it's been quiet for two minutes; to allow only one meeting ever, also set `HQ_MEETING_ID` (ATV World logs the meeting's ID to the browser console). Changing `HQ_PUBLISH_KEY` revokes every token. The website only ever shows first names and an initial, nothing is stored, and HQ empties on its own when the meeting ends.

No meeting handy? Add `?call=demo` to the URL to watch the agents of questionable judgment dial in, `?call=crowd` for a 48-person call, or `?call=Ana,Ben` to seat whoever you like. From the browser console: `atv.call.join('Ana')`, `atv.call.leave('Ana')`, `atv.call.demo('crowd')`.
