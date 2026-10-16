# ATV World

Browser pixel-art town: Phaser 4, React 19, TypeScript 7, Vite 8.
Source pointers verified against the repository on 2026-10-16.

| Area | Start here | Notes |
| --- | --- | --- |
| World, player, Vibe Run, camera | `src/game/scenes/Preview.ts`, `src/game/view.ts` | Objects must contribute to fit bounds. |
| Procedural pixel art | `src/game/kit/` | PixelCanvas, shared palette, mini font and texture helpers. |
| Kittens and project manager | `src/game/kittens.ts`, `src/game/kit/kittens.ts` | Toy-filled south lawn corral; escapes, catches, coin play, dragon chase and meowing townspeople. |
| Flying coins and dragon | `src/game/tokens/`, `src/game/dragon/` | Preview updates both; kittens never consume player coins or get burned. |
| HQ and call roster | `src/game/hq/`, `src/call/` | Teams/Live Share is opt-in; `?hq&call=demo` works locally. |
| Library and reader | `src/game/scenes/Library.ts`, `src/library/` | Walk-in tower; Open Library and Internet Archive integrations. |
| UI, sound, live reload | `src/App.tsx`, `src/music/`, `src/live.ts` | React overlays, gesture-unlocked music, version polling. |
| API | `api/hq/index.js`, `scripts/api-dev.ts` | Azure Functions v3; HMAC meeting publishing, disabled without key. |
| Build/deploy and plot grid | `vite.config.ts`, `scripts/build.ts`, `scripts/plots-plugin.ts`, `src/game/world/layout.ts`, `.github/workflows/`, `infra/` | Main auto-deploys; build recovery may retain old live files. Ready PRs auto-merge. |

Run `npm ci`, `npm run dev`. Proof: [testing](operations/testing.md).
Current work: [board](../../todo.md). Harness: [eval map](eval-map.md).
No external service credentials are needed for kitten tests.
