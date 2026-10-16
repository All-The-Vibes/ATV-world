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
- A flying saucer circles above town with a little alien pilot, chasing lights, and a hovering shadow.
- `src/game/view.ts` is the camera: F fits the whole world, +/- or the mouse wheel zooms, dragging looks around, and the view survives reloads.
- `src/game/kittens.ts` runs the south-lawn cat and kitten corral: eight slippery kittens, 24 toys (yarn, balls, mice, tunnels, scratching posts and feather teasers), and a project manager trying to carry escapees home. Kittens get bored, dodge catches, bat at dropped coins without spending them, and chase and jump toward a nearby dragon. People get distracted and exchange meows: "I have to get back to work now.. err... meow, meow." Press F to fit the whole playground; `npm run test:kittens` checks their antics in a real browser.
- `src/live.ts` is the LIVE badge in the bottom left. It shows the commit that's live and reloads the page when a newer push deploys.
- `src/music/` is the background music: an 80s arcade loop made with Gemini. The speaker button or M turns it off and on.

Every push to `main` goes live within a few minutes, and the live page reloads itself to show it. CI (typecheck and build) and CodeQL run on every push too.

## Character creator nametags

Set `githubUsername` (without `@`, preserving casing) on the character's look:

```ts
const look = randomLook('my-character', { githubUsername: 'YourGitHubLogin' });
// After creating the sprite from that look:
addCreatorNametag(sprite, look);
```

Both helpers are exported from `src/game/kit`. Omit `githubUsername` when ownership
is unknown. It identifies the character's creator, not the author of the shared
drawing kit, a later editor, the current viewer, or a Teams participant. Never
derive it from a display name, participant ID, texture key, or login session.
The label follows movement, visibility and opacity; destroying the sprite or
stopping its scene removes the label and its listeners. Player markers and speech
bubbles have separate space; labels keep a 12px screen font at every zoom.
Crowded full-world views can overlap tags; zoom in to read individual characters.

Backfill evidence (creation diffs and GitHub's commit-author account association,
checked October 16, 2026):

| Characters | Creator | Introduction commit |
| --- | --- | --- |
| Six street walkers (`preview-0` through `preview-5`) | `Bakar404` | `9c37211d647e5fba6a20dd7e8149f0509abd52de` |
| Player, including the library copy (`PLAYER_LOOK`) | `vvundela1111` | `9fd2cf3a9bd3c02e8374a6dc25b13737725deb52` |
| Abdallah (the named street walker) | `aifateen` | `3c1fb9c186c8051a961a26073761e970347316de` |
| Disco dancers | `markbriggs-ms` | `c5fedcc91e9cd741957049bda145811b8a768dc4` |
| Kitten playground's project manager | `DeaderestPool` | `bee168535494ad2ed5f4eef73dcfdfd2da2e8be0` |
| HQ seated coders and arriving/departing avatars (`callerLook`) | **Unresolved; unlabeled** | `3ccda30b460936980682095775fdcd746f1b5f75` |

The HQ commit names Veda Vundela but has no linked GitHub author account. Confirm
the creator's account before adding `githubUsername` to `callerLook` in
`src/game/hq/art.ts`; both seated and walking sprites already support it. Existing
HQ desk plates still identify call participants, separately from creator tags.

Run `node tests/nametags-browser.mjs` for focused real-Phaser regression checks at
desktop and mobile widths. It uses an OS-assigned local port and closes only its
own server. Set `NAMETAG_SCREENSHOTS` to a directory to save screenshots.
