# E1 — loading-apron defend → extraction

**Status: DONE_WITH_CONCERNS.** Required offline unmodified-mission evidence established; fresh controller review pending. This is not entry/DOM/device/visual/performance/public-release acceptance. Final scoped gate: **50/50 passed, 0 failed/canceled** (`13-final-focused`, 2.888s). No full suite or build was run by E1.

## Scope, authority and exact source
- Base: exact frozen grounded source ZIP `0f8f04e5e941390f27d1947820a620687300970efe9264e6b7676f52c04c2ccf`, extracted 2026-10-31 15:03:07 UTC exit0 per `evidence/extraction/BASE.json`.
- Baseline source head is the immutable-extraction-derived `evidence/extraction/sdd/e1-base.json`: 387 files, `da33d2baf957d806e6ee6c7e228516c1cb0802385dfe814c9a33b738f8369894`. It was not substituted with a later live crawl.
- Only new `work/src/loading-extraction-front.js` and `work/tests/loading-extraction.test.mjs`; all other writes owned under this evidence directory. No preexisting work source/tests/scripts/assets/main/locale/CSS/input/runtime/build changed. No Git/commit/network/install/browser/Mac/Blender action or subagent used.
- `14-integrity-analysis`: **all1814 original extracted file bytes exact**, all14 protected predecessor archive SHA values exact, including grounded source above and grounded device `20dce1068bd11079f3fe765508cea0edb23e9993839b9ce55ed6bdcdc551582d`. Full per-file/archive checks: `integrity.json`.
- Complete new 389-file source head: **`5474a97fe3f537164a8924a841e1a4b83288cb9b609f2750e31a0ee587bc903e`** (`source-head.json`, explicit canonical hash encoding). Owned final source SHA: builder `3612649e944300ae85e4a2dc641adf825edad540c52c5aeffe46c9b8c061348c`; tests `78f3e33172621ab3956f42892015e279cd82f81ada23f28145f8fb638d217d99`.
- `final-source/work/...` contains exact owned final snapshots. `source.diff` is U10 new-file diff against absent baseline paths, SHA `7acd010321bd980f5483f6b92a259cb33ba28f55f38f3347b523cbc497e8c75c`. No commits were made.

## Authored behavior and genuine TDD
`createLoadingExtraction()` starts from fresh unchanged `createBattlefrontDepotFront()` data. New mission9090/index9090/slugloading-extraction/optional/loadingExtraction; inherited terrain, rendering flags, roads, route mouths, actor count/placements/HP/patrols/weapons/relations/rigs and collision data remain unchanged. Defend `prepare-extraction` requires18 continuous simulated seconds in exact inherited orders polygon x[-4,4],z[20,26], then unlocks `escort-supply` to existing rendezvous. Supply activation and convoy-choice prerequisite both match preparation. No kill quota. Protected supply failure still precedes objective advancement. Optional support loss is not failure.

- `01-red`: all5 new tests failed specifically because new builder was missing; no import/typo substitution.
- Initial builder had design-original `targetIds:['supply']`. Controller identified actual marker/tracker leading to truck(0,28), outside loading zone. `03-guidance-red` genuinely showed2 failures: exact authoring contract and real `getActiveTargets` marker supply(0,28) instead of loading-area(0,23). Controller revised design/brief to `targetIds:[]`; only new builder changed. Existing global protected-truck rule preserves loss before objective progress. No renderer/runtime workaround.
- `04-green`:45/45 pass; `11-record-green`:49/49; final `13-final-focused`:50/50. Exactly four files at concurrency1: loading-extraction, mission-runtime, convoy-orders, route-choice. Default tests read saved route artifacts only; they **never automatically simulate a long route**.
- Explicit UNIT FIXTURE tests may place player or set loss state only to isolate continuous18s, reset, inclusive boundary, immutable paused/terminal behavior, stationary selection/release/commanderhold and global defeat. Those fixtures are not actual-play evidence. Public stepGame start/pause/resume semantics are separately exercised, but actual main lifecycle/gesture/input-release acceptance belongs to E2. No manual phase fixture is claimed as actual user pause.

## Real unmodified input-only acceptance
All three accepted scenarios begin from public new builder → existing Sandfalcon selection → unmodified createGame → unchanged accelerated ruined-depot production world, DT1/60; only validated literal inputs are emitted. No pose/HP/objective/arrival/projectile/event/mission-state edits, invulnerability, collision bypass, aim teleport, timecap change or hidden damage. Read-only controller logic may inspect state/world rays and emit controls. All actual runs retain every event, literal run-length tape, per-input full-state JSON hashes, event/1Hz physical frames and full final state, complete resolved spec and recursively discovered physical source texts/hashes. New physical closure is **32 files**, not an assumed31. World diagnostics retain757 exact shell triangles /61 movement spans.

| Scenario | Inputs / sim tick | Actual result | Raw SHA256 |
|---|---:|---|---|
| `win-direct-01` |9190 /9189|WON,153.150s simulated; Sandfalcon52HP, supply100HP, arrived;7 player shots|`458c5034670c74e924d5740c11093c6f548c5e2b73c46d48e409158740bd7a79`|
| `playerloss-01` |3125 /3124|LOST tank-destroyed,52.067s; player0/supply100,0 player shots|`31da743a02c1dbd911fe85cd90966e197b6f182e4880884f746bd1062822092e`|
| `truckloss-02` |3888 /3887|LOST protected-vehicle-destroyed,64.783s; player88/supply0,0 player shots, unfinished prepare0/active, no choice|`58032bdd11727a1820207a115f67cfa1e328f55191785a3a2133b1969a12bc53`|

**True first-stage causal chain in the winning run:** hostile-flanker shot `event-1` /`projectile-1`, tick121 → impact `event-2`, tick140 → adjacent damaged `event-3`, tick140, player100→88 while prepare active elapsed2.3333s. Production damaged events do not themselves expose projectileId: shot→impact uses actual projectileId; impact→damage uses immediate event adjacency, same tick/owner/target/position and exact frame HP delta. No synthetic event ID added.

Preparation completes naturally `event-17` tick1080, elapsed18.00000000000026; escort activates. Exactly one normal direct choice `event-19` tick1427, with supply still(0,28), speed0, routeIndex0 on that selection frame. Actual normal swept convoy arrives `event-47` tick9189 at(0,-32), then wins. The truck and player remain damageable; commanderhold does not pause hostile shots. Only Sandfalcon/direct win tested, not all5 chassis/both routes.

Truck-loss02 leaves loading using real controls and resets unfinished hold. First actual hostile→supply chain: `event-13`/`projectile-5` tick867 →`event-14` tick903 →`event-15`, supply100→88. Last actual chain ends supply4→0 at tick3887; preparation never completes, escort remains locked and no route is selected. Complete chains: `actual-evidence-analysis.json`.

**Actual public retry proof:** Both natural loss raws contain `retry(s.mission)` exactly equal to fresh `createGame(spec)`, then public start and first real world tick: fresh HP, original positions, unselected choice, null convoy routeIndex, no arrival/projectiles, active preparation restarting1/60 and locked escort. This is the real exported public simulation retry path, not a manual state reset. DOM/session/gesture key release/retry panel cases remain E2; E1 does not claim those controls tested.

## One literal fresh-process replay and the comparison defect
`07-replay` ran the successful9190-input literal tape **once in a fresh process**, with no planner or repair. Its in-memory object vs JSON-loaded prior `deepStrictEqual` comparison **failed**; job exit1 is permanently retained. Logs show signed-zero differences at the persistence boundary (in-memory -0 vs JSON-loaded +0). We do **not** claim IEEE bit-level state equality or use a short excerpt to exclude every unpersisted-field difference.

The fresh run wrote its entire result before that assertion. Original and fresh entire compressed artifact bytes both SHA **458c5034670c74e924d5740c11093c6f548c5e2b73c46d48e409158740bd7a79**. `08-saved-compare` only reads the already saved artifacts: entire gzip bytes equal, entire uncompressed JSON bytes equal, entire parsed result deepStrictEqual; all9190 tick-state JSON hashes/events/frames/full final/source/spec included. It also reproduces signed-zero object-vs-JSON mismatch in a tiny assertion. `saved-replay-comparison.json` states original07exit1. No second long replay was launched, no evidence repaired or overwritten. The accepted replay claim is **complete persisted-output protocol equality**, not raw IEEE/in-memory equality.

## Failed attempts, retained without greenwashing
1. `02-green`: historical nonaccelerated crossfire-v4-front import/test exceeded60s; worker exit1, runner exit124,14passed/0assertionfailed/4canceled. New loading tests, mission-runtime and route-choice had not run. Full log and kill/wait terminal retained. Controller authorized narrower four-file120s gate; expensive V3/V4 not automatically rerun. It is not a green full suite.
2. `07-replay`: original job exit1 as above;2.17MB complete failed comparator log and complete fresh raw retained. Subsequent saved-artifact comparison is a separate inspection job, not a rewritten original success.
3. `09-truckloss` /`truckloss-01`:1240inputs/tick1239, correctly stopped by no-motion guard at(-19.31454,23.05690), actual contact `south-depot` en route to(-22,23); phaseplaying, player88/truck88, preparation reset0. Full unsuccessful tape/raw/summary retained (raw `d4b654fe1ae691ea48f5b176649616dcd89d22b73c1a2e30fc68fff6acb1fe1e`). Controller explicitly authorized one shorter waypoint(-18,23) retry through already traversed clear corridor; no mission tuning.12 then established natural truck death within35.263s wall process time. No brute-force parameter/route search or empty-wait extension.
4. `01-red` and `03-guidance-red` are expected genuine feature/guidance REDs, retained in full.

## Jobs, deadlines, identities and processes
Every substantive job was announced to controller before launch with scope/cap and after terminal. All ran through byte-exact copied proven process-group runner SHA `0d07e3a29710269389f639e9165b8423f5b37ed3cfcc006c7eb692b02936f512`. Its original successful descendant-timeout fixture is `evidence/grounded/g1/00-timeout-fixture-terminal.json`; no redundant fixture run.02 also exercised actual group timeout, SIGTERM/SIGKILL/wait, no living descendants.

Each job has `*-launch.json`, `*-before.json`, `*-after.json`, `*-terminal.json` and full `.log`. These record source/test/script/helper SHA identities and exact command, startUTC, timeout, PID, child status and kill/wait. **All14 source identities unchanged across each run; every terminal livingGroupAfterWait=[]; no worker remains pending.** No source/helper edits while any job pending. Planner revisions are retained: v1`4cf0803909b75cc976fcad006a682c56d9bd184bf3636f9e57aade8b74f6b4b1`; v2`d23ea78cd4171495507692ea025682ff8af41086e4a5c5f7263a64222e2d551d`; current`01bf4d69bb82d2124e5350afe0593c46c1e4d476cf5bb2af284e1fe8cfe11718`. Only controls/early-stop protection changed between planners, never production source.

Commands below run from `work/` under `python3 evidence/extraction/e1/run-job.py NAME SECONDS ...` launched at candidate root. Exit column is **worker / runner** (timeout returns124):

| Job | Cap | Exit | Wall process time | Exact child command |
|---|---:|---:|---:|---|
| 01-red | 60s | 1 / 1 | 0.458s | `node --test --test-concurrency=1 tests/loading-extraction.test.mjs` |
| 02-green | 60s | 1 / 124 | 60.261s | `node --test --test-concurrency=1 tests/loading-extraction.test.mjs tests/mission-runtime.test.mjs tests/convoy-orders.test.mjs tests/route-choice.test.mjs tests/crossfire-front.test.mjs tests/crossfire-v3-front.test.mjs tests/crossfire-v4-front.test.mjs tests/battlefront-depot-front.test.mjs` |
| 03-guidance-red | 30s | 1 / 1 | 0.666s | `node --test --test-concurrency=1 tests/loading-extraction.test.mjs` |
| 04-green | 120s | 0 / 0 | 2.210s | `node --test --test-concurrency=1 tests/loading-extraction.test.mjs tests/mission-runtime.test.mjs tests/convoy-orders.test.mjs tests/route-choice.test.mjs` |
| 05-playerloss | 180s | 0 / 0 | 22.229s | `node ../evidence/extraction/e1/input-acceptance.mjs playerloss playerloss-01` |
| 06-win | 300s | 0 / 0 | 73.645s | `node ../evidence/extraction/e1/input-acceptance.mjs win win-direct-01` |
| 07-replay | 300s | 1 / 1 | 115.200s | `node ../evidence/extraction/e1/input-acceptance.mjs replay win-direct-01-fresh win-direct-01` |
| 08-saved-compare | 30s | 0 / 0 | 0.389s | `node ../evidence/extraction/e1/compare-saved-replay.mjs` |
| 09-truckloss | 180s | 1 / 1 | 13.629s | `node ../evidence/extraction/e1/input-acceptance.mjs truckloss truckloss-01` |
| 10-analysis | 30s | 0 / 0 | 0.413s | `node ../evidence/extraction/e1/analyze.mjs` |
| 11-record-green | 120s | 0 / 0 | 3.769s | `node --test --test-concurrency=1 tests/loading-extraction.test.mjs tests/mission-runtime.test.mjs tests/convoy-orders.test.mjs tests/route-choice.test.mjs` |
| 12-truckloss02 | 180s | 0 / 0 | 35.263s | `node ../evidence/extraction/e1/input-acceptance.mjs truckloss truckloss-02` |
| 13-final-focused | 120s | 0 / 0 | 2.888s | `node --test --test-concurrency=1 tests/loading-extraction.test.mjs tests/mission-runtime.test.mjs tests/convoy-orders.test.mjs tests/route-choice.test.mjs` |
| 14-integrity-analysis | 60s | 0 / 0 | 10.336s | `python3 -c 'import subprocess; subprocess.run(['"'"'python3'"'"','"'"'../evidence/extraction/e1/integrity.py'"'"'],check=True); subprocess.run(['"'"'node'"'"','"'"'../evidence/extraction/e1/analyze.mjs'"'"'],check=True)'` |

## Boundaries and inherited concerns
- No E1 build/full suite/English production entry/DOM layout/touch/browser/WebGL/GPU/Mac acceptance. E2 owns actual CN/EN launch/select/main lifecycle guarded retry/input-release and state-derived remaining-seconds DOM wording, then the controller-authorized once-only whole suite/build gate. Fresh E1 task review must precede E2.
- The physical closure deliberately excludes entry/view/loaders/locales; whole source head is separate. Four prior31-key physical raws are checked byte/text exact as historical provenance only. All1814 inherited bytes and14 ZIPs checked immutable. Old BF1 tapes/results never substitute newmission9090 outputs; only planning structure informed the controller.
- Existing friendly-fire absorption, real solid wreck/collision, all art/actor budgets and fixed-step clock remain byte-exact. Nothing bypasses production sweeps or weakens damage/AI.18 simulated seconds is not guaranteed wall-clock human pacing when time is dropped by unchanged scheduling.
- Trusted parent Mac summary at `evidence/extraction/MAC_BASELINE_RESULT_1513.md`: sampled western gray off-map ground improved/no obvious seam there; warehouse still intact/uniform gray-brown and surface burn remains soft color rather than sufficient war damage. Frequent warehouse transparency toggling occurred; no same-pose older comparison establishes whether new regression. Five video-assisted rAF samples contained14 intervals>900ms; seconds-scale scheduling gaps remain unresolved. Small-screen timed-out commands were not retried. No cloud Mac actions or causal performance diagnosis claimed.
- Vanguard rights remain unresolved/private only. No public release/merge/frozen predecessor replacement authorized by this work.
