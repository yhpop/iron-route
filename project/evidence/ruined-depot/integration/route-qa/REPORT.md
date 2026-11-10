# Mission 9070 ruined-depot — input-only acceptance PASS

## Scope and outcome
Both actual production Sandfalcon routes **WON** and were independently reproduced from fresh Node processes/worlds. Each fresh replay deep-compared **the ENTIRE persisted JSON evidence**: exact spec/specHash, sourceSnapshot/sourceHashes, provenance, RLE inputs/count, events, checkpoints, complete final state and finalHash. The independently generated complete gzip is also **byte-identical** to its accepted recording. No selected-field/hash-only comparison.

This is offline CPU production simulation, **not browser/WebGL/GPU/FPS/device/Mac acceptance**. No production source, previous test or earlier candidate was edited by this QA task. No full suite, build, browser, network, download, install or Git command was run here.

| Route | Inputs | Tick | Player HP | Supply HP | Supply | Shots | Allied damage | Record / fresh verify |
|---|---:|---:|---:|---:|---|---:|---:|---|
| direct | 8,141 | 8,140 | 72 | 86 | alive, arrived | 4 | 0 | WON / exact PASS |
| covered | 13,600 | 13,599 | 92 | 100 | alive, arrived | 9 | 0 | WON / exact PASS |

`selectedConvoyChoiceId` is respectively `direct` and `covered`; both supply entities genuinely end at `(0,0,-32)`, alive/arrived. Mission victory does not require killing every enemy.

## Exact identities and physical closure
Shared mission/spec SHA256: `4501679426f876be1f96f61956d5df7ed96f3e5c2dd6fa9468c0b18f39ef42ec`.

- Direct final-state SHA256: `ba67ec6206b2c23ec66a9689ce2c9a945e73c62d93dbfd317a66723b872c4222`.
- Covered final-state SHA256: `dc586e3d3b7a3ec00217424a90c0ad2b1dcc36068e659dd3d19b9298d109588b`.
- Direct accepted **and** independent generated complete gzip SHA256: `ee5ee1d850d0d4c7a2f343ff3be0b79f8f2abc55e14d93b5236dd578338a39fc`.
- Covered accepted **and** independent generated complete gzip SHA256: `7b183427a5398c5d0ffed520076938f7a9d4f31903a2ebc53c33d6536d27d599`.

All four completed record/verification runs use `createRuinedDepotFront`, `withPlayerVehicle(...,'sandfalcon')`, **createRuinedDepotWorld** and real `createGame`/`stepGame`: exact new **757 triangles / 61 conservative movement spans**. The 30-file transitive local physical source closure explicitly includes new collision-data/layout/front/world wrapper, heightfield/terrain queries, campaign world/simulation, combat, controller, mission runtime, crushing, interceptor, measured rigs and all authored front dependencies. Closure aggregate SHA256: `43731151b349d8d5ad6bbeee24b43ad215d40426ebc2fea1e13b18d21bf0e8c8`.

Each completed run compares the full physical source snapshot before/after; no drift. Post-verification audit rehashed all 30 files against both accepted records: **zero drift**. Concurrent main/loaders/locales/render-adapter-only changes are outside this physical closure and are not claimed as CPU-route acceptance.

`artifact-identities.json` retains every physical file/hash, record/generated paths and entire-file SHA identities. Each accepted result embeds the complete exact spec, source text snapshot and source hashes. Independent proof files bind the current complete harness/helper source SHA256; focused tests check those bindings and full generated artifact equality.

Frozen QA harness SHA256: `0e5307d3c0acd6a1dc3f6e5d38979a32618f0739453272c05a7bc8582f4d2299`.
Comparison helper SHA256: `dd43243e7621e7f032e4648729f5a9bbf396ea7bbea2285d83b4a4b7a6b91399`.
Final focused test SHA256: `e0e08e975f8a52b098590c335cdddb10ded88344dd7701b74955d130aaafdc3f`.

## Actual controls, geometry interaction and provenance
Accepted routes start at exact unmodified `createGame` condition, then normal `start`; fixed dt `1/60`. No pose/groundPose/HP/objective/phase/projectile/target repair; no frozen AI, collision toggle, forced hit or teleport. Input whitelist and actual numeric envelope are validated every tick; RLE total equals input count, first command is exactly one start input. Real ally/enemy behavior is unchanged. Normal completed runs/fixtures dispose their real worlds in `finally`.

Only the old retained **controls** were reused as observations. Their original state/spec/source/outcomes/hashes were not substituted as new evidence. New artifacts retain input-file provenance SHA256. Both old control streams genuinely win in the new world, so no gameplay adjustment/rejected terminal gameplay run was needed.

The new east masonry really changes the old shotline: accepted direct player shells hit `ruin-east-window` at ticks1633/1687, at x19.273340, y≈0.943, z−1.294606/−0.818736. `road-gun` remains alive HP90; the escort nevertheless wins. See `direct-cover-observations.json`.

Covered retains the original fence breach: actual `ridge-fence-2/3/4` barrier-opened events occur ticks8281/8388/8495. See `covered-fence-observations.json`; no route collision was bypassed.

## Isolated real shell fixtures — NOT route wins
1. **Input-fired fixture** `isolated-input-fired-shells.json`: separate authored shooter spec (only id/spawn altered; fresh Sandfalcon at x11). Real `createGame` + ordinary aim/brake/**firePressed** creates production shells, against the exact complete new world. No projectile/state injection. Opening shot passes the east window and reaches x22.650065; jamb shot stops on exact masonry x19.273340/y1.278724; lower shot stops on real sill x19.273340/y0.426310. Focused test independently regenerates and deep-compares this entire artifact. It is explicitly not the authored mission route or a win.
2. **Seeded projectile fixture** `isolated-stepGame-shells.json`: separately labeled six west/east window/jamb/sill cases. Initial projectile position/velocity are explicitly supplied ONLY for this fixture; actual production stepGame/stepCombat collision then passes the window or impacts exact masonry. This is not a raw raycast, not an input-fired route and not a win claim.

## Main initial groundPose diagnostic
`initial-groundPose-diagnostic.json` separately compares pure createGame versus actual main's one-time `state.tank.pose=world.groundPose(state.tank.pose)` under the same first120 accepted inputs. Initial and start-frame differences are only tank.pose.y (0 vs0.008) and basis (absent vs identity). On input#2 `{}`, simulation tick1, **entire game states deep-equal**, SHA256 `b38086a511c059ee0a438e9d7a37ec1b8057584a16435685fbb6ee57c2d7384f`; every remaining observed input through#120 stays entirely equal. Both initial/full final states, per-step differences/hashes and actual main initialization line are retained. Accepted route initial conditions/artifacts were not altered, and no large route was blindly rerun for this diagnostic.

## Checkpoints
Successful fresh verifiers retain 8 direct +13 covered real input-run inspection checkpoints (every1000 inputs). `sandfalcon-{direct,covered}-scene-inspection.json` includes complete player/turret/muzzle/entity state and the exact contemporaneous retained control. These support later scene/camera composition, **not executed camera/HUD/GPU screenshots**.

## Terminal commands and retained failures/interruption
Run from this candidate root. All logs below are preserved under `work/qa/ruined-depot/`.

| Command / log | Observed result |
|---|---|
| `node work/scripts/replay-ruined-depot.mjs direct --tape --attempt=direct-original-controls-01` / `direct-original-controls-01.log` | exit0, accepted new-world direct WON; never repeated/overwritten |
| Original covered attempt `covered-original-controls-01`, session28156 | interrupted host; no terminal observed, not counted as completed/game failure |
| Original direct verify session32167, wait cell g34:49 | interrupted host; no terminal observed, not counted as independent verification |
| `node work/scripts/replay-ruined-depot.mjs covered --tape --attempt=covered-original-controls-recovery-02` / matching `.log` | exit0, accepted covered WON |
| Direct `--verify` / `direct-independent-recovery-02.log` | exit1, QA signed-zero serialization mismatch; actual replay won with identical finalHash, but not counted as verified |
| `node work/scripts/replay-ruined-depot.mjs direct --verify --verification-tag=independent-recovery-03` / `direct-independent-recovery-03.log` | exit0, ENTIRE evidence exact; complete generated gzip byte-identical |
| `node work/scripts/replay-ruined-depot.mjs covered --verify --verification-tag=independent-01` / `covered-independent-01.log` | exit0, ENTIRE evidence exact; complete generated gzip byte-identical |
| `node work/qa/ruined-depot/fired-shell-fixture.mjs` | exit0, actual input-fired isolated fixture |
| `node work/qa/ruined-depot/initial-groundPose-diagnostic.mjs` | exit0, short complete-state convergence diagnostic |
| `node work/qa/ruined-depot/json-evidence-comparison-regression.mjs` | red exit1 then green exit0, retained `json-comparison-{red,green}.log` |
| `node --test work/tests/ruined-depot-physics.test.mjs` / `focused-final.tap` | **6 passed, 0 failed, 0 skipped**, exit0 |

Old host recovery probes returned stale cell generation and Unknown process ids28156/32167. `interruption-2026-10-31.json` preserves exact probes and missing terminal outputs. Controller explicitly authorized only the missing covered recording/direct verification to resume fresh, with new logs/attempts; accepted direct was untouched. `status.json` records all resumed session IDs and terminal states. No claim is made about normal destructor execution for interrupted/unknown processes.

## QA-only JSON signed-zero correction
Raw in-memory replay event normals contain `-0`; recorded JSON necessarily decodes them as `0`. Five such signed-zero fields caused the preserved direct recovery-02 strict-comparison failure. No gameplay/source/state drift was found. The corrected comparator roundtrips the **ENTIRE** generated result through exactly the recorder's JSON serialization, then deepStrictEqual-compares the **entire** decoded saved artifact; no subset, omitted field, approximation or state repair. Complete fresh generated gzip is retained before comparison. Both passing fresh verifications independently produce byte-identical complete gzip files.

The small red/green regression reproduces the old failure and proves the fix accepts JSON persistence semantics while rejecting changed event numbers, removed/added fields, input changes and final-state changes. Final route tests additionally verify entire fresh-generated artifact equality, source/spec identities, harness/helper source hashes, genuine alive/arrived terminal state and direct new-wall impacts.

Before text/SHA, exact diff and boundary are in `work/qa/ruined-depot/{replay-ruined-depot.before-json-fix.mjs,json-evidence-fix.diff,json-evidence-fix-metadata.json}`. Before text was restored by the exact inverse of four uniquely targeted replacements, not falsely called a pre-edit snapshot. Its SHA256 `9f24ba6d507e29d08d78c76f3e521f39d84c4224c14145b3a38c880664a7dccb` independently matches the prior 03:35 build-source hash archived in `evidence/ruined-depot/final/build-before-json-verifier-fix/build-source-verification.json`.

Historical 1pass/3skip and 2pass/3skip TAP logs remain untouched; they were interim fixture runs before route proof existed. The always-skipped/no-assertion placeholder was removed, not counted in final coverage. Long input replays are the real independent commands above, not synthetic tests.

## Artifacts / remaining boundary
Accepted per-route `-result.json.gz`, `-inputs.json`, `-summary.json`, `-independent.json` remain here under **evidence/ruined-depot/integration/route-qa/**, not work/qa. Fresh generated complete results and attempt logs remain under work/qa/ruined-depot; their paths are bound in independent metadata/audit.

No unresolved CPU-route gate remains. Browser/rendering/application-entry/device acceptance is outside this evidence-only task and must not be inferred from these wins.
