# Notes for AI agents

ATV World is a pixel-art world built with Phaser 4, React 19, TypeScript 7, and Vite 8. Push straight to `main`: every push goes live within a few minutes and the live page reloads itself, so there's nothing to deploy by hand.

## Where things live

- `src/game/scenes/Preview.ts`: the world on the live screen. Things added with its `building`, `tree`, and `prop` helpers grow the world's bounds, so the camera's fit view always includes them.
- `src/game/kit/`: all the pixel art, drawn in code (characters, buildings, nature, props, palette, font).
- `src/game/main.ts`: the Phaser game config and its scene list.
- `src/game/view.ts`: the camera. F fits the world, +/- and the wheel zoom, dragging looks around, and it follows the player.
- `src/App.tsx`: the React overlay (banner and zoom buttons). `src/game/commands.ts` passes its button presses to the game.
- `src/live.ts`: the LIVE badge and the auto-reload.
- `scripts/build.ts`: the build that deploys. If a change breaks the build, the rest still ships and the broken file stays at its live version.

## Checking a change

`npm install`, then `npm run typecheck` and `npm run build`. Both show real errors.

## Phaser gotchas

- Don't name scene fields or methods after Phaser's built-in scene members (`add`, `time`, `input`, `cameras`, `events`, `scale`, `data`, ...). It breaks the scene, and `npm run typecheck` catches it.
- Read keys with Key objects (`this.input.keyboard?.addKey(...)`) or a `window` listener. The scene's `'keydown'` event can fire more than once for one press.
