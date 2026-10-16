# Kitten playground

- ID: kitten-playground; owner: this session; status: in-progress; blockers: none.
- owning_component: src/game (existing directory; no component table).
- test_level: functional; functional_risk: medium; execution_class: serial.
- model_tier: medium; model_requirements: TypeScript/Phaser integration and browser tools.
- escalation_triggers: conflicting user edits, inaccessible runtime, failing unrelated baseline.
- token_budget: concise implementation/report; no worker dispatch.
- cost_tier: 6 for kitten behavior, 2 for art/character/camera/browser helpers.
  Ruled out: existing walkers only stroll horizontally and cannot model toys or catches.
- expected_files: game/kittens.ts, kit/kittens.ts, Preview.ts, Tokens.ts, Dragon.ts,
  tests/kittens-browser.mjs, package.json, README.md and focused project memory.
- conflict domains/shared resources: Preview world and one browser server.
- proof_check: npm run typecheck && npm run build && npm run test:kittens.
- HITL: none required for implementation; merge explicitly not authorized.

## Ordered steps and acceptance

1. Paint a 300x170 south-lawn corral, 18+ toys in six varieties, eight distinct
   kittens and a labeled PM using existing art helpers. Camera F includes the area.
2. Wire actual scene updates: play briefly, get bored, leave through fence gaps,
   wander, then be chased and carried home on a successful catch. Misses show
   a dodge and cooldown; no teleport home. Repeat indefinitely.
3. Read landed coins without consuming/repositioning them; chase the nearby
   dragon's ground position and jump visibly when close. Ignore distant targets;
   never add kittens to the dragon's burnable list.
4. Prove natural escapes, both catch outcomes, real coin/dragon integration,
   bounded motion and rendering in Playwright. Run existing library/HQ regression.
5. User-added scope: nearby people approach kittens, exchange meows, say they
   must get back to work, relapse into meowing, and return to their walking lane.
   Prove both sides' bubbles and eventual release; preserve dragon rest holds.

Use bounded timers, clean scene lifecycle, shared palette and depth sorting.
Do not modify production deployment or merge automation. Draft PR has no review
requests so automatic merge does not run.
