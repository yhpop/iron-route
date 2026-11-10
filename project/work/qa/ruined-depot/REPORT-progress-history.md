> Update 2026-10-31 04:04 UTC: BOTH actual routes now WON. Direct HP72/supply86; covered HP92/supply100. Fresh ENTIRE-JSON evidence verifications are running (direct30719, covered14408); independent pass is not yet claimed. Earlier progress notes below are retained history.

# Mission 9070 — input-only production acceptance (in progress)

CPU/offline evidence only. No browser, WebGL, GPU, real-time FPS, device, or Mac acceptance claim. No production source edited by this QA task.

## Observed terminal result
- Sandfalcon **direct WON**: 8,141 legitimate inputs, tick 8,140, player HP72, supply HP86, supply alive/arrived, selected route direct; zero allied damage.
- Final state SHA256: `ba67ec6206b2c23ec66a9689ce2c9a945e73c62d93dbfd317a66723b872c4222`.
- Spec SHA256: `4501679426f876be1f96f61956d5df7ed96f3e5c2dd6fa9468c0b18f39ef42ec`.
- Physical closure: 30 files, hashes aggregate `43731151b349d8d5ad6bbeee24b43ad215d40426ebc2fea1e13b18d21bf0e8c8`, no record-run drift. Includes new front/layout/collision-data/world wrapper, terrain and all transitive local physical imports. Concurrent main/loaders/locales changes are outside this physical closure.
- New masonry genuinely stopped player shells at ticks1633 and1687; road-gun remains HP90. Escort victory does not require killing every enemy. Original controls were reused only as controls; original outcome/spec/source/state never reused.
- Fresh-process **entire-evidence direct verification is running**. No independent equality claim yet.
- Covered control replay is still running; no covered victory claim yet.

## Isolated actual shell evidence
`isolated-input-fired-shells.json`: separate authored shooter spawn/spec; fresh createGame plus ordinary aim/brake/firePressed, real Sandfalcon projectile creation and stepGame, exact complete new-world geometry. Opening shot passes x19.5 and reaches x22.650065; jamb stops x19.273340,y1.278724; lower shot stops sill x19.273340,y0.426310. No projectile injection in this stronger fixture. It is NOT a mission route or a win.

`isolated-stepGame-shells.json`: separately labeled seeded-projectile fixture, six west/east window/jamb/sill cases. Actual stepGame projectile collision, not raw raycast and not user-fired route evidence.

Focused pre-route test command: `node --test work/tests/ruined-depot-physics.test.mjs`: **2 passed, 0 failed, 3 explicit skips** (two await accepted independent route results; long route replay is deliberately a separate command). Input-fired fixture independently deep-reproduced its entire artifact.

## Commands and retained logs
- `node work/scripts/replay-ruined-depot.mjs direct --tape --attempt=direct-original-controls-01` — exit0, accepted new-world win.
- `node work/scripts/replay-ruined-depot.mjs covered --tape --attempt=covered-original-controls-01` — running.
- `node work/scripts/replay-ruined-depot.mjs direct --verify` — running in a fresh Node process.
- `node work/qa/ruined-depot/fired-shell-fixture.mjs` — exit0.
- Logs and per-attempt full results: `work/qa/ruined-depot/`.

No rejected/failed route attempt has occurred so far. Both runs start from exact original createGame condition: no pose/groundPose, HP, objective, phase, target, collision or state repair; dt1/60. Real ally/enemy behavior unchanged. Accepted artifact contains RLE inputs, full spec/source snapshot, exact events and complete final state; independent verifier deep-compares the ENTIRE result and also checks before/after physical closure identity. Each real world is disposed.

## Main initial grounding diagnostic (separate, no long replay restarted)
Controller requested comparison to actual main's one-time `state.tank.pose=world.groundPose(state.tank.pose)`. `node work/qa/ruined-depot/initial-groundPose-diagnostic.mjs` exited0. Initial and start-frame differences are **only** tank.pose.y (0 vs0.008) and basis (absent vs identity). Both consume exact same accepted input prefix. On input#2 `{}`, simulation tick1, **entire game states deep-equal**, SHA256 `b38086a511c059ee0a438e9d7a37ec1b8057584a16435685fbb6ee57c2d7384f`. All remaining observed inputs through#120 retain entire-state exact equality. `initial-groundPose-diagnostic.json` retains both initial/full final states, per-step hashes/differences, and actual main initialization source line. This does not alter any accepted route initial condition or artifact.

## Interrupted-host recovery
The original covered record session28156 and direct verification session32167 did **not** return observed terminal results. Recovery probes found Unknown process ids; waiting cell g34:49 belonged to a stale host generation. They are not counted as completed or failed game outcomes. Their logs remain unchanged. `interruption-2026-10-31.json` records exact probes. Controller authorized fresh recovery of these missing operations only: covered attempt `covered-original-controls-recovery-02` (session73202) and direct verification (session16838), each with a NEW recovery log. `status.json` retains resumable ids. Accepted direct recording was not repeated or overwritten.

## JSON signed-zero verification failure and QA-only correction
The recovered direct verifier completed the actual same won simulation and same finalHash, but exited1: raw in-memory event normals contained `-0`, while retained JSON necessarily decodes those numbers as `0`. Five signed-zero fields were the only printed strict diff. Entire failure log remains `work/qa/ruined-depot/direct-independent-recovery-02.log`; it is NOT counted as successful independent evidence.

The QA comparator now roundtrips the **ENTIRE** newly generated result through the recorder's identical JSON serialization before `deepStrictEqual` against the entire decoded artifact. No fields are selected, dropped, approximated, repaired, or copied from expected evidence. The fresh generated complete result is retained separately before comparison; the independent proof pins harness/helper SHA256. The small red/green regression reproduced the signed-zero failure and then passed; real event-number changes, removed/added fields, input changes and final-state changes are rejected. Before text, hash, exact patch and boundary are retained under `work/qa/ruined-depot/json-evidence-fix*`; before text was explicitly reconstructed using the exact inverse of the four uniquely targeted replacements, not misrepresented as a pre-edit snapshot. No production source changed.

Frozen QA harness SHA256: `0e5307d3c0acd6a1dc3f6e5d38979a32618f0739453272c05a7bc8582f4d2299`. New direct fresh verify uses session30719 and `direct-independent-recovery-03.log`; accepted direct record remains untouched. Covered record continues session73202.

Controller independently confirmed the inverse-restored before SHA256 `9f24ba6d507e29d08d78c76f3e521f39d84c4224c14145b3a38c880664a7dccb` matches the pre-fix `inputs['scripts/replay-ruined-depot.mjs']` in the retained 03:35 build-source verification (archived under `evidence/ruined-depot/final/build-before-json-verifier-fix/`). Thus a genuine prior hash corroborates the reconstructed before text; the text is still not represented as a pre-edit snapshot. The always-skipped/no-assertion placeholder was removed from the new focused test; long input replays are independent real commands, not a fictional test count. Historical TAP files remain untouched. Final route identity tests additionally bind independent harness/helper SHA256 to current full source bytes.
