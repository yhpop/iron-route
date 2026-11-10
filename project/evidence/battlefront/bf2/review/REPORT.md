# BF2 independent specification and quality review

**Spec verdict: PASS_WITH_CONCERNS for the task-scoped CPU/source gate.** The implementation meets the optional-entry, candidate-only presentation, immutable gameplay/resource and saved final verification requirements examined here. Strict prelaunch provenance of the accepted RED cannot be established from its retained after-terminal hash record. This is a disclosed process-evidence limitation, not an established implementation regression. Browser/Mac/visual acceptance remains outside this verdict.

**Task quality verdict: APPROVED_WITH_MINOR_FOLLOWUP.** No Critical or Important implementation defect found. Do not reopen/repeat the accepted suite, builds or route replays for this review. Controller whole-candidate review and the already-required authorized visual review remain outstanding.

## Review identity and method

- Reviewed the complete 15-work-file plus 5-active-evidence-helper diff once in three sequential passes. The diff was not truncated; no changed source file reread was needed.
- Requirements: `evidence/battlefront/sdd/task-bf2-brief.md`.
- Verified supplied identities: report `60b568b53caafe94b63d062c67f6fe9b0afb74070bbe099198b7fbb589b9d418`; review package `6f5461ebddd1119bee12c94658621aa0e72f11b9e5820a994cf991abefc89a65`; base `ab7137a2a7cc6b92ce1d40cc7ff869f1192768179248c5321bc98fd2c4d45d77`; review head `dc51976cb661537e2147414c24fe8f1761f1ba8d97e51ff5e4fa1d92f104b74c`; final source manifest `d1c5f94bb5589c2405f01da6618fa7e60ba005beee8af8f4242b45baa8b09d6f`.
- Independently compared current work to base, current files to all 324 frozen-manifest entries, and all 20 source/helper entries to the review-head inventory. Exactly the seven authorized existing files differ from base; frozen/review-head mismatches are empty.
- Inspected saved terminal records/logs, saved geometry/resource records, projection index/SVG identities, final build manifests/metafiles, mirror source identities and fixed replay outputs. This was file/data inspection only, not a test, simulation, build or audit-script rerun.
- Named unchanged dependency checks: ruin loader/embedded/art clone contract. The real library's `root.clone(true)` borrows geometry/materials/maps, matching the adapter ownership strategy.
- No source, test, helper, raw evidence or build modification; only this review report written. No Git, network, install, browser/Mac, Blender, heavy worker or subagent.

## Strengths and specification findings

1. **Optional integration is bounded.** Main preserves the exact `./ruined-depot-world.js` import and old conditional paths, adds the mission to both resolvers/featured selection and defaults only its cached spec to Sandfalcon. Candidate switches control boundary suppression, relief appearance and replacement ambience. Existing retry cache, late-selection guard, readiness ordering, route-label suppression and occlusion-before-ruin disposal are retained.
2. **Material lifecycle is sound in the reviewed contract.** Tint clones are keyed by borrowed original-material identity, share maps/geometry, and are disposed idempotently. Preparation precedes visibility changes; library/material-clone failure disposes created tint materials without hiding proxies or attaching a partial root. Tests exercise real THREE identities/disposal events and occlusion material restoration.
3. **Ground geometry is source-bound and static.** Emission is within the same authoritative terrain triangles used by the sampler; convex containment establishes interior containment, and tests additionally sample barycentric interiors/contact. Wear uses common grid-vertex RGBA values rather than random triangle shading. Spalls are small scalene inset triangles near actual ruin spans, not grid silhouette copies. One replacement mesh; no update work, bodies, terrain writes, new maps or fake cover/firing.
4. **Saved geometry/resource evidence supports the budgets.** 2,666 total triangles (2,326 wear + 340 spalls), below 6,454 old visible soot + 460; maximum observed paint offset 0.014000000458m, below .018m. 319,920 typed-attribute bytes; placement inventory covers all three actual ruin instances and 61 span transforms. No actual GPU/draw-submission performance claim is warranted or made.
5. **Old relief behavior is protected.** New appearance is opt-in, uses the same six map URLs and existing B channel, and owns a distinct shader cache key. Tests compare full old shader outputs, CPU masks and geometry against the frozen base. No global exposure or CSS changes appear.
6. **The build-test adaptation is authorized and narrow.** It pins the candidate main while retaining original main identity via BASE.json, exact resolver negative controls and main-only closure checks, other-world routes, archive/Strv exclusion and before/after nonmutation. New optional mission dispatch is additionally asserted; the old checks were not deleted or skipped.

## Saved verification independently checked

- `08-full-suite.log` and terminal record agree: concurrency 2, cap 600s, exit 0, 1,100 total / **1,079 pass / 0 fail / 21 inherited environment skips**, 340.331s, empty code drift. These are not 1,100 executed passes.
- The same log contains actual successful CN and EN build terminal identities. Current bundle hashes/bytes match manifests: CN `2c4c9290…be9b0f3`, 38,696,403 bytes; EN `071ba1e4…55647c`, 38,682,351 bytes. Both current metafiles independently show the exclusive main → accelerated ruin → accelerated terrain → accelerated campaign → broadphase chain, with 17 asset inputs each. No second build needed.
- All **120 mirrored source/config/harness inputs** independently match final source and the frozen mirror record.
- Fixed generated direct and covered gzip outputs independently equal original accepted raw bytes, not just summary hashes. Direct: tick 8322 / 58 events / SHA `0d76b716…dbc1361`; covered: tick 13599 / 102 events / SHA `5a470dae…810bb08`. Retained helper harness identities match the current unchanged original harness.
- Direct job 09 reached its normal successful replay END; only the shell post-check failed after an incorrect parent-directory traversal. Job 10 is solely the recovered identity post-check, exit 0. No second direct replay appears. Covered job 11 has successful replay and post-check, exit 0. The implementation report describes this distinction accurately.
- First RED is a mixed-head file-level failure and is correctly rejected as proof. Second RED has three genuine assertion failures (zone suppression, owned material identity, 4-versus-1 buckets), not import/stub errors. Its base hashes were captured after terminal: this does not independently prove a frozen prelaunch head. The report discloses that limitation.
- The five initial focused failures are retained and consistent with the described fixture-boundary defects (selection/phase expectation, rejection during harness boot, missing fake scan roots, incomplete fake turret rig). Later saved focused and final-suite records pass; no historical harness weakening appears in the diff.
- Projection inventory contains exactly **16 unique records** and matching saved SVG hashes: three direct states and one covered state at each of four viewports. Code produces reset-camera shell-triangle schematics and actor dots, not screenshots, full actor meshes, DOM or complete-cycle observations. The initial repeated covered-index artifact is not substituted for final evidence.
- Restored historical external fixtures are correctly described as source-test dependencies, not fresh BF1 proof. The evidence/report makes no stutter/device/root-cause acceptance claim.

## Issues

### Critical
None found.

### Important
None found.

### Minor — evidence worker timeout is not a descendant-process bound

`evidence/battlefront/bf2/run-job.py:12-13`: `subprocess.run(..., timeout=...)` kills/waits for its direct child on timeout, but the runner does not create and terminate a process group. Several recorded commands launch a shell which launches Node, and the suite can launch build subprocesses. If a future job hits the cap, a descendant may survive while the runner writes a terminal record and after-inventory, defeating the advertised bounded/serial-worker guarantee. Before reusing this helper, start a separate process session and terminate/wait for the entire group on timeout, preserving the original failure record. **No present record timed out, so this does not invalidate the saved successful terminal results or require rerunning them.**

## Concrete cannot-verify items / boundaries

- No independently captured prelaunch source hash exists for accepted RED 02; after-terminal identities plus genuine assertions do not retroactively supply one. RED 01 remains unusable.
- No actual GLB image decoding/GPU material count, terrain shader compilation/rendering, palette quality, submitted draw count, allocator/GPU total memory, FPS, stutter or device behavior was observed here.
- Source schematics cannot establish DOM/HUD layout/touch, screenshot alignment, smoothed camera history or whole maneuver-cycle visibility/occlusion. Covered projections contain only its one saved final checkpoint.
- Two Sandfalcon physical replay wins are not complete-route acceptance of every selectable chassis. Reverse/near-truck behavior and BF1 combat/retreat limits are unchanged, not repaired by this presentation task.
- Historical fixture identity and stored failed-run chronology are not newly observed BF1 execution. This review did not broaden into a BF1 re-review.

The outstanding authorized Mac/ego-browser checklist in the implementation report remains appropriate. No package/upload/publication approval is implied.
