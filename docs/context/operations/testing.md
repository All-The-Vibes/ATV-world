# Testing

- `npm run typecheck`: strict TypeScript; catches Phaser scene member collisions.
- `npm run build`: direct Vite production build, without deploy fallback.
- `npm run test:hq`: Node API tests, no credentials.
- `npm run test:library`: pure library tests plus real browser journey; external book services mocked.
- `npm run test:kittens`: real-browser world/animal assertions, no external services.
- `npm run test:factory`: real-browser Agent Factory journey (picker, spawning, wandering, cap, dismissing).

Browser scripts start/stop their own local Vite server and use Edge or Playwright Chromium.
`KITTEN_SCREENSHOTS` optionally writes screenshots outside the source tree.
Kitten tests check live rendered sprites, toy count, natural boredom/escapes,
PM catch/miss, coin preservation, dragon pounces, and fit bounds.
Subjective art quality is checked by inspecting the actual browser screenshot.
