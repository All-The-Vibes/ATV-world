# Eval map

Checked: 2026-10-16. Pattern: browser game plus React reader and small HTTP API.

| Workflow | Deterministic proof | Gap |
| --- | --- | --- |
| World and kittens | `npm run test:kittens` | Art appeal is subjective. |
| Library browsing/reading | `npm run test:library` | External provider availability not proved by mocked services. |
| HQ publishing | `npm run test:hq` | Real Teams authentication needs user credentials. |
| Source and bundling | `npm run typecheck`, `npm run build` | No standalone linter is configured. |

Existing Node tests and Playwright are sufficient; no new framework or exporter.
Canonical commands are in [testing](operations/testing.md). The kitten smoke
uses real scene state and rendered sprites; no test-only production behavior.

smoke-eval-validation: pass-command=`npm run test:kittens`; pass-result=exit 0;
negative-check=temporarily expected 9 kittens instead of 8 in the initial browser
assertion; negative-command=`npm run test:kittens`; negative-result=failed-as-expected
(exit 1, actual 8 !== expected 9); reverted=yes.
