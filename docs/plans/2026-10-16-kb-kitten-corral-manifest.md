---
manifest_schema: 3
objective_contract: true
model_tier_contract: true
workspace_isolation_contract: true
proof_governor_contract: true
pre_slice_review_contract: true
workflow_shape: focused-game-feature
pre_slice_review:
  status: not-required
  source: direct-chat
  not_required_reason: Clear additive game behavior; no persistence, auth, dependency, or unresolved product decisions.
delivery:
  mode: pr-merge
  commit_authorized: true
  push_authorized: true
  merge_authorized: true
workspace:
  branch: feat/kitten-corral
  isolation: user-authorized-in-place-feature-branch
done_check: npm run typecheck && npm run build && npm run test:kittens
---

# Kitten corral

User wants a generously sized corral with lots of kitten toys, easily bored
escapees, a project manager who sometimes catches them and sometimes misses,
coin play, and chasing/jumping toward a dragon they can see.

One vertical slice: [kitten playground](2026-10-16-feature-kitten-playground-plan.md).
No blockers or independent workstreams. Existing world/animal APIs are the
integration boundaries. No API, storage, release automation, or dependency changes.

Gate ledger:
- requirements-to-plan: passed; user messages specify every requested behavior.
- plan-to-work: passed; inspected Preview, Tokens, Dragon, art and browser harness.
  Allowed next action: implement the single slice in this session.
- work-to-delivery: pending deterministic and browser proof.

No repository kbcheck command exists; use the documented native npm commands.

Current-run authority update: after implementation the user said "pr then
commit when done", then "accept pr". This authorizes merging the feature PR
after proof, superseding the initial no-merge direction. Do not merge unrelated PRs.
