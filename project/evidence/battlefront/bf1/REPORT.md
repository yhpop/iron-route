# BF1 — damaged freight-yard playable mission

## Outcome — DONE_WITH_CONCERNS
Mission 9080 is a new independent playable encounter, not a resource pack. Both actual Sandfalcon escort routes have input-only wins on the same frozen v03 mission. Strong natural crossfire is observed from two actual firing origins separated by 156.49° about an identical stationary player position. Real support ↔ flanker damage is recorded. The single early-cover diagnostic proves real static cover blocks the returning live enemy in range. Both entire route results independently replay exactly. Final focused verification passes16/16 tests; all709preexisting work files remain byte-exact. Browser/Mac validation and the strict same-in-range instant of cover disengagement remain qualified below.

## Frozen composition
- Builder: `work/src/battlefront-depot-front.js`, fresh scanned-cover `{spec,field}`, no heightfield edits or foundations. Scanned field hash `ea4f9a216f2e5446e47f99548f51505e6f1038f3e97189e9caa3280db9814d24` retained.
- Three existing modules: west loading (-30,0,18,π), workshop (-32,0,-5,π), east window (19.5,0,0,π/2). Matching west-workshop solid and scene landmark removed together, no hidden intact box.
- Five existing actors; only poses/patrols authored. Support patrol is a 6×7m off-lane apron circuit (-10,31),(-16,31),(-16,38),(-10,38). Flanker is an honestly stationary ridge-foot position (2,16). Road patrol is a genuine 15m outer-east loading-apron lane at x23,z16↔31. Ridge gun and supply are unchanged.
- All PzIII patrol segments sampled at ≤0.25m with a conservative 3.2m articulated envelope outside both convoy corridors and choice polygons. Real collision-swept production movement/charge parking remains authoritative.
- No new assets, actors, texture families or maps: 757 exact exported triangles,61 movement spans,3 ruin instances; existing approximately64MiB mipmapped ruin map allocation retained. Existing attribution/CC-BY-3.0,CC0 and private-commercial-rights boundaries remain unchanged. No network/download/install, asset rebuild, Blender, browser, Mac, Git or engine changes.

## Preserved trial history
- v01: source `version-01-front.js`; opening raw `work/qa/battlefront-depot/v01-opening-result.json.gz`. Rejected rectangle overlapped route-choice/corridor. The envelope test retained RED (`04-envelope-red.log`), including inherited support overlap.
- v02: source `version-02-front.js`; safe support circuit + stationary flanker. Opening support travel12.90m,road29.79m in30s; support→flanker damage48, player damage60. Crossfire trial survived first hold but eventually lost at tick3120; short63tick LOS/cooldown overlap was not accepted as sufficient paired-shot proof.
- v03: source `version-03-front.js`; road patrol moved to south loading apron. `actual-patrol-coverage.json` confirms support167.55m with all4 waypoint indices, road198.88m with both indices, zero recorded blocked/charging-motion frames on covered route. Mission-with-Sandfalcon spec hash `402a75efdb0ab4fb53185393da64f6dd8d5948f5cdeb6c243a1e340c743588ef`;31-file physical closure aggregate hash `2d8e706932808be909a52a890e3ee3524f40eb6532f476bff1feb7cac8beb9a1`. `version-03/04/05-harness.mjs` preserve controller revisions. Every raw result embeds all31 physical source texts and hashes, complete spec, full input tape, final state, events, per-event/1Hz states and projectiles, engagement tick records. Old controls are exploratory inputs only, never old state/outcomes.

## Natural combat evidence
`v03-crossfire-analysis.json` reads the saved raw v03-crossfire artifact. At ticks820 and867 both hostile tanks fire at the identical player position(7.6304385866,19.2224739437). Actual road muzzle(20.9631,20.6884), actual flanker muzzle(3.8003,17.0304), bearing separation156.49°. Both alive and naturally targeting player;1273 effective-range+LOS target-player overlap ticks;5 recorded frames contain simultaneous real projectiles from both owners. Damage is real, not merely nominal enemy placement. Generic diagnostic LOS uses player+1m; natural shot/target events are production authoritative. The later early-cover probe separately uses exact resolved player aimHeight.

Covered route raw events prove support→flanker damage at215 and flanker→support damage at569 (12HP each), with later additional support hits. No scripted logs are added to production state.

## Actual route results

Friendly-damage count is the `damaged` event predicate where both attacker and target are among `tank/supply/allied-support`; zero therefore includes zero player-caused friendly damage. It does NOT mean allies took no enemy damage: support ends98HP on covered route due to a real hostile hit. Accepted raw files listed below exist on disk.
- Covered: `work/qa/battlefront-depot/v03-covered-old-controls-result.json.gz`;13600inputs,tick13599,WON; player80HP,supply16HP,arrived(0,-32),9player shots,0 player-caused friendly damage. Final hash `8d1c7ab8ba5a6d6b337c39e572eafe061f9169e4f88dd7643417693e38afe4cd`.
- Direct: `work/qa/battlefront-depot/v03-direct-pilot-01-result.json.gz`;8323inputs,tick8322,WON; player28HP,supply100HP,arrived(0,-32),6player shots,0 player-caused friendly damage. Final hash `05d9ca4b9182d7525a786cce63eff0d0f0e62337e1b164c70eba662a33c6c5fa`.
- Fresh independent generated results: `work/qa/battlefront-depot/{direct,covered}-fresh-final-v03-result.json.gz`; full JSON exactly equals accepted raw, not a selected state subset. Verification records: `route-qa/sandfalcon-{direct,covered}-independent.json`.
- Accepted raw copies: `route-qa/sandfalcon-{direct,covered}-result.json.gz`.
- `five-player-rigs.json`: all five actual chassis have literal createGame spawn clearance and real-control forward/reverse/pivot motion, not all-five full routes. No initial groundPose patch.
- West static full-route envelope remains blocked by inherited destructible fence, exactly as scanned baseline; actual winning convoy route clears/passes it. No new geometric route blockage was hidden.

## Contracts / grounding / differential
`14-final-focused.log`:16/16 final tests,17.27s, exit0, no failures/skips. Command: `timeout 120 node --test --test-concurrency=1 work/tests/battlefront-depot-*.test.mjs work/tests/sweep-acceleration.test.mjs work/tests/sweep-acceleration-dynamic.test.mjs`. Earlier `07-v03-contracts-world.log`:12/12 focused+unchanged collision tests,17.0s. Includes all-five rigs;120 literal-input full reference/accelerated states exactly equal;84 new-layout static ray/dynamic/wreck query comparisons;8881 unchanged dynamic public outcomes;1858 static +75 threshold public outcomes. Isolated dynamic/wreck query fixtures are explicitly separate from input-only route acceptance. `ground-budget-final.json`: every actual collision-data exported base vertex contacts original field within approximately0.000001m. Shared instance transforms are checked against existing view adapter, generated movement proxies and exact shell world. No browser visual-quality/performance claim.

## Immutable / TDD / worker records
Initial709-file hashes: `initial-hashes.json`; final all709 unchanged: `immutable-final.json` (with owned-file SHA256 inventory); interim check also retained in `immutable-interim.json`. Old builders/combat/interceptor/world/broadphase bytes asserted. Parent owns integration and final whole-candidate review.

Actual assertion RED before implementation: `01-red.log` (missing builder), followed by GREEN `02-green-inventory.log`. Additional actual envelope RED `04-envelope-red.log`, followed by corrected v02 GREEN `05-v02-envelope-opening.log`. No throwing stub or import-error RED.

Serial bounded worker logs, each START/END announced to controller:
1. `01-red.log` expected exit1.
2. `02-green-inventory.log` exit0,contracts+ground budget.
3. `03-opening-v01.log` exit0,diagnostic only.
4. `04-envelope-red.log` expected exit1.
5. `05-v02-envelope-opening.log` exit0.
6. `06-v02-crossfire.log` exit0 diagnostic,playerlost retained.
7. `07-v03-contracts-world.log` exit0,12tests.
8. `08-v03-crossfire.log` exit0 diagnostic,no route claim.
9. `09-v03-covered-tape.log` exit0 genuine win.
10. `10-v03-direct-pilot.log` exit0 genuine win.
11. `11-v03-cover-retreat.log` exit0,diagnostic;3870inputs,tick3869,player48HP,truck100HP.
12. `12-direct-independent.log` exit0,full8323-input replay exact.
13. `13-covered-independent.log` exit0,full13600-input replay exact.
14. `14-final-focused.log` exit0,16/16finaltests.

`worker-records.json` lists session IDs, caps, terminal stamps and exit records for every worker; there are no active BF1 worker sessions. Every substantive simulation asserts its complete31-file physical closure is unchanged at terminal; sources/spec are saved before outcome assertions in each raw result.

Focusedjobs capped120s, route/full-replay jobs600s, concurrency1; yielded sessions recorded in controller messages. No full suite run by BF1; BF2/controller own that final stage.

## Explicit limits
The original v03 crossfire retreat left LOS clear and ended8HP. Covered road LOS10319→10379 genuinely hits terrain, but hostile is idle and≈45m away: NOT an accepted engaged-cover-retreat proof. `covered-natural-cover.json` records transition:null. The sole early-retreat diagnostic is now saved: `work/qa/battlefront-depot/v03-cover-retreat-01-result.json.gz`, analyzed in `early-cover-retreat-analysis.json`. Road naturally shot/damaged player before retreat and remains alive90HP. Player retires to(17.10778665,4.17848164); exact production-origin→resolved Sandfalcon aimHeight(.831303m) world rays hit `scorched-east-cover` for887 live-enemy,in-range ticks beginning2231. Player48HP remains stable and truck100HP. Important limitation: first clear→blocked transitions occurred outside range; the patrol later re-entered19m range and remained genuinely blocked by cover. This is real retreat/hold-cover evidence, NOT an invented same-tick in-range LOS cut. No further placement search was performed. Browser/Mac camera/material/HUD/scheduling, complete mission entry/view integration and wall-clock smoothness remain separate BF2/Mac gates; no performance improvement asserted.

## Owned files / handoff
New source only: `work/src/battlefront-depot-front.js`; `work/scripts/battlefront-{inspect,replay,analyze}.mjs`; `work/tests/battlefront-depot-{front,world,replays}.test.mjs`; new `work/qa/battlefront-depot/` artifacts and this BF1 evidence directory. No preexisting source/assets/tests/scripts changed. No builds/commits/full suite or browser actions. The named offline gates above are verified; do not interpret them as a device-release or stutter/scheduling pass. In particular, neither collision reverse/near-truck issues nor all-five full-route playability is claimed fixed. Final integration/full-suite and Mac review belong to BF2/controller.

## Review fix I1 — round1/5 (2026-10-31)

**I1 fixed; artifact-only verification 6/6, exit0,3.38s.** The original16/16 result above remains a historical pre-review run; this amendment does not claim a new full suite or simulation replay. Only `work/tests/battlefront-depot-replays.test.mjs` changed; the saved review base is `evidence/battlefront/sdd/bf1-fix-1-base`. M1 formatting outside this one changed test is deferred by controller scope.

The formatted test now discovers the entire current physical-source closure and checks both diagnostics against its source texts/hashes, the current resolved Sandfalcon spec, final-state mission/hash and full input count. Raw bytes are SHA256-pinned; crossfire also verifies the summary raw digest. The complete summaries must equal records derived from the bound raw: actual shot events/muzzle bearings at an identical player pose, live natural player targets, both selected shot projectiles present together, and each projectile's actual tank impact followed by damage. Covered route reciprocal damage remains sourced from bound route raw.

Cover assertions derive every recorded origin(player/actor poses), resolved player aimHeight,3D range, segment hit position/distance and actual static-cover bounds; they locate exactly2231..3117 inclusive(887 consecutive in-range blocked ticks), last prior engaged-clear tick1370, and all clear→blocked transitions. **The initial clear→blocked transitions remain outside range.** This proves retreat followed by effective hold-cover against a returning in-range live enemy, NOT instantaneous in-range disengagement. Mutation negatives use in-memory copies only: edited summaries, stale raw bytes, internally rehashed stale spec/source, missing closure member, missing selected projectile/damage, wrong aim height and wrong range flags must all fail. Frozen raw files were not modified.

TDD command (both phases, cwd=`work`, bounded by `timeout 120`):
```sh
node --test --test-concurrency=1 tests/battlefront-depot-replays.test.mjs
```

RED output (`fix-1/01-red.log`, assertion failure, not import/stub failure):
```text
Sat Oct 31 11:45:39 UTC 2026
✔ actual direct convoy win binds full spec/source closure and complete independent generated evidence (185.653566ms)
✔ actual covered convoy win binds full spec/source closure and complete independent generated evidence (168.837722ms)
✔ natural two-bearing crossfire uses actual firing origins about the identical player point plus overlapping real projectiles; ally and enemy exchange real damage (69.990448ms)
✔ early retreat uses actual static cover against a live returning in-range enemy without health/state patches (1.089948ms)
✖ I1 rejects an edited crossfire summary unsupported by unchanged frozen raw (78.428716ms)
ℹ tests 5
ℹ suites 0
ℹ pass 4
ℹ fail 1
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 691.40816

✖ failing tests:

test at tests/battlefront-depot-replays.test.mjs:8:1
✖ I1 rejects an edited crossfire summary unsupported by unchanged frozen raw (78.428716ms)
  AssertionError [ERR_ASSERTION]: Missing expected exception (AssertionError).
      at TestContext.<anonymous> (file:///workspace/scratch/08f39b8da479/battlefront_depot_candidate/work/tests/battlefront-depot-replays.test.mjs:8:317)
      at Test.runInAsyncScope (node:async_hooks:227:14)
      at Test.run (node:internal/test_runner/test:1402:25)
      at Test.processPendingSubtests (node:internal/test_runner/test:974:18)
      at Test.postRun (node:internal/test_runner/test:1542:19)
      at Test.run (node:internal/test_runner/test:1467:12)
      at async Test.processPendingSubtests (node:internal/test_runner/test:974:7) {
    generatedMessage: false,
    code: 'ERR_ASSERTION',
    actual: undefined,
    expected: { name: 'AssertionError' },
    operator: 'throws',
    diff: 'simple'
  }
EXIT:1
Sat Oct 31 11:45:40 UTC 2026
```

GREEN output (`fix-1/02-green.log`, session30894):
```text
Sat Oct 31 11:48:27 UTC 2026
✔ actual direct convoy win binds full spec/source closure and complete independent generated evidence (181.745417ms)
✔ actual covered convoy win binds full spec/source closure and complete independent generated evidence (172.979736ms)
✔ natural crossfire is bound to current raw bytes/spec/closure and actual shots/projectiles/damage (134.862863ms)
✔ early retreat derives exact production-height/range static-cover interval from bound raw (326.216765ms)
✔ I1 mutation negatives reject edited summaries, stale raw bytes, stale specs and stale sources (1576.150961ms)
✔ I1 mutation negatives reject unsupported raw combat and incorrect cover query semantics (592.856754ms)
ℹ tests 6
ℹ suites 0
ℹ pass 6
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 3382.812498
EXIT:0
Sat Oct 31 11:48:31 UTC 2026
```

Final identity: `fix-1/identity.json`. Old709 files still byte-exact; comparing the prior BF1 owned-file manifest identifies ONLY the amended replay test. No production/scenario/harness/analyzer/other tests or frozen raw changed; no simulations, route searches, full-suite/build/browser/Git/network jobs ran. All workers terminal.

Modified test SHA256: `d64d23bba3da2363aa2b5e190829d7325e09d2d036d2bec893e019865ea4d8d6` (before `8059a8908ab9f268a508b3c12f6a249c116b0e4ed14cf491171d3c243df67106`).

Exact additive fix evidence and SHA256:
- `evidence/battlefront/bf1/fix-1/01-red.log` — `b58c1546e3baf24263c08262bcab62a2e3a0878e3f02aa780d89c30195a2f69b`
- `evidence/battlefront/bf1/fix-1/02-green.log` — `eb3ececbd8c29c8b690a897d1c99e5740b4b486ddcc26ff6c8441b0969d391d5`
- `evidence/battlefront/bf1/fix-1/identity.json` — `cc5be3172bdca7d846df2022e27a5c94e5bce4a38be52927822b1c216657e349`
- `evidence/battlefront/bf1/fix-1/test-after.mjs` — `d64d23bba3da2363aa2b5e190829d7325e09d2d036d2bec893e019865ea4d8d6`
- `evidence/battlefront/bf1/fix-1/test-before.mjs` — `8059a8908ab9f268a508b3c12f6a249c116b0e4ed14cf491171d3c243df67106`
- `evidence/battlefront/bf1/fix-1/test-red.mjs` — `b939665f2498e8e2b8971f791a3c513a5ec2920ae91fcedaea9c676abf0f80fb`

Frozen raw SHA256 reaffirmed:
- `work/qa/battlefront-depot/v03-crossfire-result.json.gz` — `d75f4574826cdc3b10d6a1704ae4dc0b2bf9309462e2e2accae46c15fc6c7180`
- `work/qa/battlefront-depot/v03-cover-retreat-01-result.json.gz` — `546f3665e6e8a567bc30f8948034ff785f89078355ae20899feff711aeec56dc`
