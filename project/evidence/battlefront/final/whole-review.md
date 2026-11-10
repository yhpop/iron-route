# Whole-candidate independent review — private Mac/source freeze

**Ready to freeze private Mac/source candidate: YES.**

No Critical or Important defect found in this combined candidate. The two carried Minor findings remain real, explicitly deferred below; neither requires changing this frozen implementation before private handoff. This verdict is readiness to freeze the reviewed source/build/evidence for private evaluation, **not device acceptance, public release, commercial-rights clearance, or verification of a not-yet-created delivery archive**.

## Identity, scope and method

Read the plan, design, both exact task briefs, progress/decision rulings, both implementation reports, BF1 task review and I1 fix review, BF2 task review, and pending Mac checklist. Read the complete combined diff once in sequential passes: all **22 work files + 5 active evidence helpers**, including unchanged context at integration seams. The plan's unchecked original boxes are planning history; progress/rulings and terminal evidence establish the actual disposition.

Independently confirmed:

- Initial `BASE.json`: `90fb8d9fb19e720acab5542b24ca28c8308b94bb13a39d55942195baa9520545`.
- Whole diff package: `5dce9e7416e9031167d4ebbf3e50ae308ee57d31f8eab4f8cb177115ae5b872d`.
- Whole review head: `52b827337ae84830d0f3b5a7d6cfc39749cebe0a958a9d7c8a47104238cfca13`.
- All 27 source/helper entries and all 11 report/binding entries match their recorded bytes and SHA256s.
- All 324 current frozen-source manifest entries match. Current CN/EN build files match the final-audit inventory. Thus the implementation assessed here remains the same head as the recorded integrated verification.

For named doubts about combined-head provenance and evidence semantics, inspected saved terminal logs/JSON, current hashes, saved replay gzip bytes/source snapshots, selected raw combat frames and the cover interval, geometry inventory and projection index. No tests, simulation replays, builds, audit scripts or other heavy jobs were run. No Git, network, installation, downloads, browser/Mac, Blender or subagents. Only this report was written. The 709-file predecessor preservation and 28 restored-fixture checks are accepted from the bound final audit/task review, not presented as a new independent tree audit here.

## Findings and explicit disposition

### Critical

None found.

### Important

None found. BF1 I1 is closed: `work/tests/battlefront-depot-replays.test.mjs:23–81,122–186,205–285,304–359` binds the complete current physical closure/spec and pinned raw diagnostics, derives the selected shot/projectile/damage and qualified wall-cover records, compares complete summaries, and includes meaningful mutation negatives. The previous stale-summary loophole is not carried forward.

### Minor M1 — compressed evidence tooling remains difficult to maintain

**Locations:** `work/scripts/battlefront-replay.mjs:9–43`; `work/scripts/battlefront-analyze.mjs:1–6`; `work/tests/battlefront-depot-world.test.mjs:4–7`.

Complex controller/provenance/persistence and geometry assertions remain packed into long lines. This makes changes and assertion-order review unnecessarily error-prone. The important corrected acceptance test is now readable; these other helpers are still maintenance debt.

**Triage: defer; not a private-freeze blocker.** I found no resulting correctness defect in this head. Reformatting the replay harness now would change its deliberately retained recorded identity without improving the already established physical outcome. Before substantive future harness edits, split named operations and format normally; preserve this historical harness and label new executions with their new identity. Do not rewrite old verification hashes to pretend the refactored harness produced them.

### Minor M2 — timeout helper does not bound descendant processes

**Location:** `evidence/battlefront/bf2/run-job.py:12–13` (also its advertised bounded-worker contract at line 1).

The direct `subprocess.run(..., timeout=...)` child is killed/waited on timeout, but a shell/Node/build descendant can survive. A terminal record and after-inventory could then be emitted while work continues, defeating a future serial/bounded-job guarantee.

**Triage: defer the historical helper; not a private-freeze blocker, but do not reuse it as a process-tree bound.** No recorded job timed out; this does not invalidate their existing terminal outcomes. Keep the original helper as evidence. The controller's stipulated separate-session/process-group termination and wait strategy must govern new packaging or other bounded work, preserving partial outputs and timeout records. If this helper is to become an active reusable runner, repair and separately verify that behavior before reuse; do not alter historical provenance merely to make its old description true.

## End-to-end assessment and strengths

1. **Actual optional encounter, not another asset pack.** `work/src/battlefront-depot-front.js:6–23` derives a fresh scanned-cover field/spec, adds mission 9080/battlefront-depot, and changes only permitted authored placement/patrol and presentation metadata. Five existing actors, three ruin instances and three scans remain; route/spawn/zone/objective/convoy and combat rules are preserved. The western workshop's intact collider and corresponding landmark are removed together. Shared ruin transforms feed existing visual, movement-span and exact-ray paths; no terrain foundation or artificial cover repair appears.

2. **Gameplay proof uses the unchanged production authority.** The replay harness constructs the accelerated world, literal game state and validated real controls; it does not inject health/pose/targets or teleport. Support's closed circuit and stationary flanker are an honest use of existing AI rather than small reciprocal decorative motion. The accepted static route envelope still discloses its inherited destructible fence instead of concealing it; actual convoy wins establish passage separately.

3. **Natural fighting and qualified cover are supported, not inferred from placement.** Saved raw frames independently show road/flanker shots at ticks 820/867 around the identical player pose; the reported origin separation is 156.4904438120621°. Both projectiles exist at tick 867, followed by actual tank impact/damage at ticks 870/880. Reciprocal ally/enemy damage is checked from the source-bound covered route. I do **not** promote the generic +1m/2D-range diagnostic's 1,273 overlap counter into an exact production aim-height/range proof; actual production firing/target/projectile/damage records establish the required encounter. The exact retreat inspection contains 887 live-enemy/in-range wall-blocked ticks, 2231–3117, player HP48. Its first clear→blocked transition is outside range: the accepted behavior is retreat then hold-cover against the returning enemy, not instantaneous in-range disengagement.

4. **Whole-result final replay evidence survives BF2 integration.** Final fixed-copy direct and covered gzip bytes independently equal their BF1 accepted bytes. Both embedded 31-file source snapshots match current physical source; 8,323 and 13,600 input counts match their run sums. Both final phases are won and supply is alive/arrived (HP100/16); player HP28/80 is correctly disclosed. The unchanged original harness compares complete JSON, not a repaired/subset state. These are two Sandfalcon wins, not all-five route coverage. Basic five-rig spawn/forward/reverse/pivot checks are correctly bounded.

5. **Presentation is candidate-specific and resource ownership is coherent.** Main retains the exact main-only accelerated ruin import and existing readiness/retry/stale-selection/disposal order. It adds both optional resolvers, featured selection and Sandfalcon selection without replacing old defaults. The campaign flag hides boundary rendering, not logical zones or active gold rings. Ruin material clones share original-material identity and borrowed geometry/maps; preparation is transactional and clone disposal is idempotent, after occlusion restoration. Old terrain shader outputs/masks/geometry are guarded against the frozen base; the new cache key and appearance are opt-in. No physics, clock, input safety, CSS or global exposure change is hidden in this integration.

6. **Ground detail obeys the bounded optical contract.** The new module makes one static merged mesh, 2,666 triangles including 340 spalls, below 6,454 old visible soot + 460. It uses continuous shared-vertex RGBA for wear and inset irregular shards, actual ruin-span source transforms, authoritative triangle containment and paint offsets at most approximately .014000000458m (< .018m). No extra map family, body, terrain mutation or per-frame update work is introduced. CPU typed-buffer and additional cached-field costs are disclosed; fewer triangles/buckets are not misrepresented as measured GPU performance or allocator totals.

7. **Regression/build contract adaptation is narrow.** `work/tests/sweep-acceleration-entry.test.mjs:11–12,37–78` retains old main identity through BASE, pins the authorized new main, preserves negative resolver/namespace/importer checks, exclusive accelerated chain, old world paths, archive/Strv exclusion and build nonmutation, and adds the candidate entry assertions. This is not deletion of a failing protection.

## Verification/evidence accuracy

- Saved `08-full-suite.log` and terminal JSON agree on **1,100 total / 1,079 pass / 0 fail / 21 inherited environment-gated skips**, concurrency 2, 340.331 seconds, exit 0 and no code drift. Do not call these 1,100 passes or newly executed old full-route replays.
- CN/EN builds occurred in that suite and were reused on the unchanged source head. Current CN bundle SHA is `2c4c9290ca1c947ab0cdb0d0718c80f5ed10f1645ac0bd7acc81ff695be9b0f3`; EN is `071ba1e445a15d9597740b2612fb0d24da56b59eea6ecde60f48d0c76255647c`. Manifests retain `browserVerified:false` and `runtimeRequestsMeasured:false`.
- Direct replay job 09 reached successful complete-replay END, then its shell post-check failed because of the wrong directory traversal. Job 10 only recovers the missing post-check; it is not a second replay. Covered job 11 completed replay and post-check. Saved logs support the report's distinction.
- Initial mixed-head RED is rejected. Corrected scalar RED contains actual assertions but only retrospective base-file identity, not fully frozen prelaunch provenance. This is a genuine disclosed process limitation, not evidence that may be retroactively repaired. Later frozen source/results support this private candidate despite that limitation.
- Failed trials/fixture corrections and the projection-count correction are retained. The final index has **16 distinct reset-camera schematics**, not 24 observations. Covered contributes only its saved final checkpoint; actor dots are not full vehicles.
- Source preservation audit records 725 unchanged nonowned BF2-base work files, 62 unchanged BF1 evidence files, 28 exact restored historical dependencies and 709 unchanged predecessor files. Historical fixtures are dependencies, not newly observed mission acceptance. Preserve SDD/version/failure records because there is no authorized Git history substitute.

## Behaviors considered but deliberately not judged as accepted

| Behavior / question | Disposition and reason |
|---|---|
| Actual visual coherence, wall darkness, soft wear, apparent grid artifacts, lighting or texture decode | Pending Mac/GPU inspection. Source palette and geometric containment are assessable; CPU fixtures/schematics cannot show rendered beauty or decode success. |
| Actual shader compilation, submitted draw counts, full GPU/allocator memory | Not measured. Shader-text parity, CPU buffers and mesh buckets do not establish these runtime quantities. |
| DOM/HUD/control overlap, touch, screenshot alignment, smoothed camera and whole-cycle occlusion | Pending device review. Sixteen sparse reset-camera shell/actor-dot schematics lack full actor meshes, DOM and temporal camera history. |
| A same-tick **in-range** escape that breaks enemy LOS | Not proved; first clear→blocked was out of range. Only the explicitly qualified retreat/returning-enemy hold-cover behavior is accepted. |
| Every player vehicle completing both routes or workshop turns | Not proved. Two Sandfalcon complete tapes plus five basic rig-motion checks are narrower. |
| Reverse/near-truck collision fixes, arbitrary pilot safety or general difficulty balance | Not claimed or established. Existing physics is retained; the covered truck's 16HP and direct player's 28HP are successful particular tapes, not forgiving balance. |
| Universal old-mission full-play regression | Not newly established; 21 inherited environment-gated long replay tests skipped. Old source protection and executed contracts remain useful but narrower evidence. |
| Seconds-long scheduling/stutter cause or improvement | Unresolved, deliberately not investigated here. No clock/safety changes; callback or geometry counts cannot establish smooth wall-clock play. |
| Strict prelaunch frozen identity for BF2 RED02 | Cannot reconstruct from an after-terminal capture. Keep the limitation; no new test run would change history. |
| Fresh execution independently observed by this reviewer | Not claimed. This was saved-source/log/artifact review, not rerunning simulations or certifying an external device. |
| Commercial/public redistribution rights | Unresolved for the original Vanguard asset. Existing attribution is preserved; private source delivery is not blanket redistribution clearance. |
| Contents/checksums/portability of the final ZIP or offline HTML package | Not yet reviewable because final packaging is subsequent work. Bind its manifest to this head, include required historical test dependencies and fixed replay copies, retain provenance, and do not treat historical absolute mirror/parent paths as portable runtime dependencies. |

## Freeze/handoff boundary

The controller's subsequently supplied `PACKAGING_PLAN.md` was read as a plan, not executed evidence or a runtime change. Its creates-only separate device/source artifacts, exact archive/remote identity checks, process-group timeout requirement, fixed replay/fixture retention and explicit reference to the unchanged prior upstream/DCC archive are consistent with this gate. Excluding dependencies and the temporary mirror is reasonable provided the promised current runtime sources/assets, package-lock, test snapshots and restored external fixtures are actually included and verified; do not describe the new ZIP as duplicating every historical authoring source.

Freeze this reviewed implementation without reopening layout, physics, Strv or scheduler investigation. Carry this report, both Minor dispositions, the qualified retreat statement, actual pass/skip counts, fixed replay mappings, rights limitation and `MAC_ACCEPTANCE_PENDING.md` into the private handoff. Retain failed and SDD evidence; do not delete it. Future package verification should check identity/inclusion, not repeat already established heavy runs without a named new need. Device acceptance and any later public-release decision remain separate, pending gates.
