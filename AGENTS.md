# Notes for AI agents

ATV World is a pixel-art world built with Phaser 4, React 19, TypeScript 7, and Vite 8. Push straight to `main`: every push goes live within a few minutes and the live page reloads itself, so there's nothing to deploy by hand.

## Where things live

- `src/game/scenes/Preview.ts`: the world on the live screen. Things added with its `building`, `tree`, and `prop` helpers grow the world's bounds, so the camera's fit view always includes them.
- `src/game/kit/`: all the pixel art, drawn in code (characters, buildings, nature, props, palette, font).
- `src/game/main.ts`: the Phaser game config and its scene list.
- `src/game/view.ts`: the camera. F fits the world, +/- and the wheel zoom, dragging looks around, and it follows the player. `show(area)` frames one spot, and both leave room for UI panels via `insets` in `src/game/commands.ts`.
- `src/App.tsx`: the React overlay (banner, zoom and sound buttons, and the ATV HQ call panel, which only shows while the player is inside HQ). `src/game/commands.ts` passes its button presses to the game and tells the panel when the player goes in or out.
- `src/live.ts`: the LIVE badge and the auto-reload.
- `src/music/`: the background music, an 80s arcade loop made with Gemini (`arcade.mp3`). Browsers hold sound until the first click or key press, so it starts then. The speaker button (`SoundButton.tsx`) or M turns it off and on, and the choice sticks through reloads.
- `src/game/hq/`: ATV HQ, where everyone on the call codes. `art.ts` draws the building and the coders; `HQ.ts` seats whoever's in `call` (walk-ins, lights, floors of eight desks). The player goes in by walking into it or clicking it (`enterHQ` in Preview.ts).
- `src/game/tokens/`: flying cars that cross the sky every 10-18s towing a FREE TOKENS! banner and dropping gold tokens onto open ground. `art.ts` draws them; `Tokens.ts` flies the cars and lets the player and passers-by pick tokens up (they blink out after 45s). The player's count lives in `commands.ts` (`tokenCount`, kept in localStorage) and shows top-left. `atv.game.scene.getScene('Preview').tokens.flyOver()` sends one over now.
- `src/call/`: who's on the call. `roster.ts` is the list (`call`); `teams.ts` fills it from a Teams meeting with Live Share (loaded only with `?teams`); `relay.ts` mirrors one meeting onto the website through `/api/hq`; `demo.ts` runs a pretend call; `CallPanel.tsx` is the panel; `teamsApp.ts` builds the Teams app package.
- `api/`: the Static Web App's Azure Functions (Node, v3 `function.json` model, no dependencies, no build step). `api/hq` is the website mirror; it's off unless the `HQ_PUBLISH_KEY` app setting is set. `POST /api/hq/token` trades that key for a meeting-only publish token (HMAC-signed, so no shared state), and `POST /api/hq` takes the roster with that token. `scripts/api-dev.ts` serves `api/` on the dev server.
- `scripts/build.ts`: the build that deploys. If a change breaks the build, the rest still ships and the broken file stays at its live version.

## Checking a change

`npm install`, then `npm run typecheck` and `npm run build`. Both show real errors.

To see ATV HQ with people in it, open the dev server with `?hq&call=demo` (people dialing in and out), `?hq&call=crowd` (a 48-person call), or `?hq&call=Ana,Ben,Cy` (a fixed list). To try the website mirror, start the dev server with `HQ_PUBLISH_KEY=anything`, POST `{ meeting }` to `/api/hq/token` with an `x-hq-key` header, then POST `{ meeting, people: [{ id, name }] }` to `/api/hq` with the token in `x-hq-token`.

## Phaser gotchas

- Don't name scene fields or methods after Phaser's built-in scene members (`add`, `time`, `input`, `cameras`, `events`, `scale`, `data`, ...). It breaks the scene, and `npm run typecheck` catches it.
- Read keys with Key objects (`this.input.keyboard?.addKey(...)`) or a `window` listener. The scene's `'keydown'` event can fire more than once for one press.
- Key objects miss taps shorter than a frame (`isDown` and `JustDown` both: a key-up clears them). Use a `window` `'keydown'` listener for one-shot presses.
