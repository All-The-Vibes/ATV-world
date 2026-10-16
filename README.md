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
- `src/game/scenes/Preview.ts` is the world on the live screen. Find all six glowing vibes, chain quick pickups for a combo, and clear a round for a temporary speed rush. Press Space for a short-range Vibe Pulse that grabs nearby shards and makes the locals hop.
- `src/game/llama/Ollama.ts` runs a fluffy pixel-art llama around the plaza. It says "Hi, I'm Ollama!" followed by "I run local. Mostly in circles." on a repeating speech-bubble loop.
- Abdallah walks around town with a pixel-art nameplate.
- **Chaos / Incident Button:** Click the big red button beside the production station west of the plaza (or walk nearby and press **C**). It randomly starts a building fire, power outage, alien invasion, or network failure. Watch, Patch, and Rollback detect the incident, run to the station, visibly repair it, and return to standby. The board and progress bar show recovery; one incident runs at a time. These are harmless in-world drills, not real service outages. Run `node tests/incidents-browser.mjs` to check every incident and the input guards.
- **🛠️ Self-Healing Repair Crew:** Watch, Patch, and Rollback automatically detect and fix a simulated fault after 30 seconds on standby, using animated wrenches and repair sparks. Click the **AUTO ON/OFF** sign beneath the incident board to pause or enable automatic drills; manual chaos-button use still works. Disabling automation lets any current repair finish. The standby timer only advances while the world is active, you're outside HQ, and you're not typing; each return to standby starts a fresh countdown. This crew repairs the in-world production station, not real code, workflows, or services.
- **💡 Idea Machine:** Walk up to the lightbulb machine just left of the starting spot, then press **E** or click it for a random build challenge. Try building an arcade game, creating an AI character, or adding something that changes the whole world. Press again for a different idea.
- A flying saucer circles above town with a little alien pilot, chasing lights, and a hovering shadow.
- `src/game/view.ts` is the camera: F fits the whole world, +/- or the mouse wheel zooms, dragging looks around, and the view survives reloads.
- `src/game/kittens.ts` runs the south-lawn cat and kitten corral: eight slippery kittens, 24 toys (yarn, balls, mice, tunnels, scratching posts and feather teasers), and a project manager trying to carry escapees home. Kittens get bored, dodge catches, bat at dropped coins without spending them, and chase and jump toward a nearby dragon. People get distracted and exchange meows: "I have to get back to work now.. err... meow, meow." Press F to fit the whole playground; `npm run test:kittens` checks their antics in a real browser.
- `src/live.ts` is the LIVE badge in the bottom left. It shows the commit that's live and reloads the page when a newer push deploys.
- `src/music/` is the background music: an 80s arcade loop made with Gemini. The speaker button or M turns it off and on.

Every push to `main` goes live within a few minutes, and the live page reloads itself to show it. CI (typecheck and build) and CodeQL run on every push too.

## CI/CD Traffic Light

The giant traffic light in the town square watches the latest `main` runs of Deploy, CI Health, and CodeQL. Click it to open GitHub Actions.

- **Green:** deployment and strict CI are present, and all observed checks pass.
- **Yellow:** one workflow is failing, or checks are running/cancelled.
- **Red:** deployment failed, or two or more workflows are failing.
- **Lights off:** waiting for the first CI results, or GitHub is unavailable. Unknown is never shown as healthy.

The separate CI Health workflow runs strict typecheck and build without blocking the existing resilient deployment. The light refreshes every minute through `/api/health`, which caches GitHub results for a minute per server instance. Public repository reads need no setup; optionally set the server-only `GITHUB_HEALTH_TOKEN` app setting (Actions read permission) for a higher GitHub rate limit.

Check the status rules with `node --test tests/health.test.cjs` and the game integration with `node tests/health-browser.mjs` (Edge).
