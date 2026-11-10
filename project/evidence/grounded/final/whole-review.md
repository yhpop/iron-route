# Independent whole-candidate review — grounded freight yard

## Verdict and scope

Ready to freeze private Mac/source candidate: YES.

**compositeGateAccepted: yes.** No open Critical or Important finding within the amended private source/CPU/build scope. This approves freezing the reviewed independent candidate for later private device evaluation, **not** device/visual acceptance, measured performance, public release, upload authorization, or a claim that packaging has already succeeded.

The once-only complete suite remains a failed run: **1,117 tests / 1,094 pass / 2 fail / 21 inherited skips**. The approved evidence is composite, not a zero-failure final full suite. The two guard-recovery runs remain **1 pass / 1 fail**, then **2 pass / 0 fail**. No result is erased or converted into a fictional clean full run.

## Review boundary and independently established identity

Reviewed the design, plan, ledger and its two narrow guard rulings, source diagnosis context, primary start/rulings/pending-device notes, task reports/reviews, and controller's full 21-section U10 package. This was a whole-candidate integration/authority/delivery review, not another task implementation. Focused outside-diff reads were limited to actual lifecycle, camera, art-library, texture-loader and occlusion contracts.

Read/hash/JSON/GLB-metadata inspection independently established:

- Review package: **135,384 bytes**, SHA256 `d91428d5cf1f08686a7824b13598940b0d64fa8511660befcf9a0bab56f9c8af`. All **21** section hashes match current files; every context/removal/addition line in the packaged hunks matches the frozen archive/current bytes. The previously truncated display segment was read separately.
- Review head: **912 files**, SHA256 `2eb4e23e7822d5e972f6a41228dc02e61bfcd587a7c2bef224361f6b339be424`; every recorded size and SHA matches current bytes.
- Current source/test/script/asset head: **387 files**, canonical SHA256 `da33d2baf957d806e6ee6c7e228516c1cb0802385dfe814c9a33b738f8369894`.
- All **1,654** inherited BASE entries remain present. Exactly 15 inherited entries differ, matching the final identity: five authorized existing source/test files and ten generated CN/EN build files. The new owned files are separately bound by the source/review heads. No hidden configuration/asset change was found.
- Frozen parent source archive SHA256 remains `5746b1c62205353868221149bd5f47018edbc01f95a38a22700e7779d1a0bd95`. All **12** recorded predecessor archives and the protected parent source entries independently match their recorded identities.
- Both retained complete-input artifacts retain their exact compressed hashes and all **31** source snapshot texts/hashes match current work. These are historical authority bindings, **not freshly replayed simulations**.
- All **16** actual CN/EN output size/hash rows match the saved full-suite build census. Each standalone HTML embeds the exact corresponding current bundle. Final work-file census also exactly matches the prepared freeze worker's expected inherited-plus-current work set.
- All seven G1 and nine G2 saved job before/after maps match; saved terminals contain no surviving living process-group member. The delivery runner is byte-identical to the new G1/G2 runner, not the forbidden historical direct-child runner.

No test, build, generator, simulation, replay, freeze worker, archive creation, upload, installation, network, Git, Mac or browser operation was executed by this review. The sole write is this report. One read-only hash check initially used an unresolved relative parent path and failed before the archive portion; it was corrected with an absolute root, and the archive/parent/replay checks then completed. This does not alter or invalidate the preserved task evidence.

## Strengths and integrated technical assessment

### 1. The repair addresses the three reported failures without changing gameplay authority

The actual production entry still selects candidate relief through `spec.battlefrontDepot` (`work/src/main.js:143`); the new warehouse finish is gated to the same candidate and precisely the south depot plus context warehouse indices 0/3 (`work/src/authored-scene-view.js:19,24`). No new actor, vehicle, scene placement, route, mission builder, physics source, collision precision, input, clock, HUD, player rig, projectile or AI change is present. The original detailed sealed warehouse is retained rather than making a false visual hole over solid collision.

Combined cost remains the ring's **one extra draw / 1,312 triangles**. The building adapter only replaces existing material bindings; it creates no geometry, map, light, particle, timer or recurring JS update. Borrowing the existing relief material also avoids a second mask/map allocation (`work/src/terrain-candidate/relief-view.js:177-190`). Added draw and fragment/shader work are real GPU costs, not a performance improvement.

### 2. Exterior construction, actual camera coverage and mask handling agree

The ring walks each of the actual field's 656 edges once, shares corners and uses actual field heights for its inner vertices (`work/src/battlefront-perimeter-view.js:7-24`). Its separate geometry does not modify the base field/mesh. The retained tests check all seams, upward winding, convex exterior half-spaces, area, UVs and original geometry identity, not only counts (`work/tests/battlefront-perimeter.test.mjs:6-25`). Generic raycasting is disabled, it is not a shadow caster, and it does not enter authoritative terrain/projectile/navigation data.

Coverage uses axial far 150 with the necessary aspect-dependent radial bound, not the incorrect 150 m sphere assumption. Production FOV/near/far, portrait/landscape offsets, aim shift and convex smoothing match unchanged `work/src/main.js:196-198`. The continuous bound for aspect .25..8 is conservative relative to the ring bounds; the four required viewport cases are also retained in the source/CPU evidence (`work/tests/battlefront-perimeter.test.mjs:28-39`). This is not proof of an unrestricted viewport, pixel-perfect seam, visible normal continuity or beauty acceptance.

The candidate shader explicitly resets outside R/G/A to zero and B to .18. It therefore does not extend clamped asphalt/rut/weather stripes into the exterior (`work/src/terrain-candidate/relief-view.js:75-96`). The four anchored continuous B zones and palette reuse existing storage, preserve R/G/A bytes and retain the original base geometry. The saved census reports 85.50% quiet area and 4.46% high damage, satisfying the specified coverage bounds without making the entire map charred. Asphalt pigment is bounded by the explicit .25 multiplier. Old default/scorched/crossfire shader and mask parity is preserved, with a candidate-only new cache key. CPU arithmetic tests are useful but correctly do not claim GPU shader compilation or real texture appearance.

### 3. The warehouse adapter respects actual geometry, source coordinates and ownership

Independent raw metadata inspection confirms shipping GLB SHA256 `3d36f5cc331470bb6e685019da941e45f93145f360eb1740e61a730e42e84dca`, exact JSON/binary binding, **8 primitives / 7,156 triangles**, and the consolidated translated child. The implementation does not rely on imaginary separate roof nodes. Inverse authored-root × modelMatrix × transformed vertex is consistent across primitives and includes actual child transforms (`work/src/battlefront-building-finish.js:11-12,28-29`). Static roots are the production contract; no per-frame inverse is needed.

One owned clone per supported original material identity per building preserves slots and map identity, while root-local bindings keep unrelated instances isolated. The color treatment neutralizes roof/paint/glass and lowers scalar sheen properties without replacing geometry, removing panels, or adding transparency (`:14-41`). Unknown/missing/non-PBR materials are deliberately untouched. Original library resources remain borrowed (`work/src/art-kit.js:4-16`).

Existing compile/cache behavior is chained and cloned finish materials preserve the patch through real occlusion's temporary clones (`work/src/battlefront-building-finish.js:24-50`; `work/src/player-occlusion.js:17-18`). Temporaries remain occlusion-owned. Main disposes occlusion before world view on selection and final teardown (`work/src/main.js:94,140`), so finish restoration/disposal does not race a later restoration of already-disposed base materials. The saved real-ray test exercises fade, restoration and subsequent fade, not merely a mock clone call.

Failed clone/cache setup restores previously bound materials and releases every created owned clone; active-root handles are installed only after successful traversal (`work/src/battlefront-building-finish.js:53-58`). Authored construction rejection and normal disposal both clean the separate building-finish list (`work/src/authored-scene-view.js:35,47`). Existing campaign lifecycle owns authored/terrain disposal and propagates readiness failures (`work/src/campaign-view.js:13,21,55-57`). Saved actual-scene tests use frozen spec/state, non-target comparisons and geometry/world-matrix identity. The Node art helper deliberately omits image references (`work/tests/helpers/art-geometry.mjs:3-5`), so its placeholders cannot establish real decoding or pixels; the reports are honest about that limitation.

### 4. The amended composite gate is adequate for this private freeze

The complete retained failure records, not just summaries, identify only the intentionally changed authored-view hash (`evidence/grounded/g2/06-full-suite.log:1135-1179`). The first repair then exposed precisely the transitive V4-test pin (`evidence/grounded/g2/07-guards.log:14-34`). Final branches require exact current **and preserved-original** hashes for those paths, rather than excluding an entire directory or rewriting old authority (`work/tests/battlefront-depot-scope.test.mjs:3-7`; `work/tests/crossfire-v4-front.test.mjs:86-96`). Other physical pins and spec/fixture assertions remain.

Independent hashing confirms final-to-suite drift is **exactly those two read-only test guards**. No production, asset, script or other test changed after the full run. Both guards ran together successfully after the second ruling (`evidence/grounded/g2/08-guards.log:1-10`). The earlier deferred English entry actually passed in the full run (`06-full-suite.log:118`); generated CN/EN outputs were reused, not rebuilt after the fact.

A clean final full-suite run and empirical re-establishment of every cross-test interaction are absent. That residual risk is acceptable here because the changed assertions are bounded, read-only identity checks; all runtime/other-test inputs are exact to the once-only run; the final joint guard execution covers their discovered dependency; behavioral/scoped evidence addresses the real implementation. This judgment does not generalize to production edits after a failed suite or make the 21 inherited skips passes.

## Findings by severity

### Critical

None found within the reviewed scope.

### Important

None found within the amended private source/CPU/build/freeze-preparation scope.

### Minor

- **Maintainability:** dense one-line control flow makes future lifecycle/test review harder (`work/src/battlefront-building-finish.js:53-58`, `work/src/authored-scene-view.js:19-35`, `evidence/grounded/g2/integrity.py:47-79`). This follows existing local style and did not conceal a blocking defect in the reviewed bounded changes. Do not churn the frozen candidate merely to reformat; consider readable decomposition in a separately authorized change with renewed identity/review.

## Prepared delivery helper assessment and recommendations

The worker is prepared code, not successful archive evidence. Its actual saved JSON consumers match the current schemas, including `finalFocusedRecovery.pass/fail`, review-head size/SHA rows, inherited entries and flat per-directory build rows (`evidence/grounded/delivery/freeze-worker.py:95-149`). I independently checked the exact work census that feeds its set equality at line 128; it presently has no extra or missing file. No inherited BASE entry is excluded by its source selection rules.

The worker refuses existing output/audit targets, requires separately bound approval/review/head identities, preserves the failed-suite accounting, rechecks predecessor/physical/build identities, writes exclusive ZIPs, audits entry names/CRC/all hashes, and checks selected inputs again afterward (`:82-170,203-217`). The device launchers point to the corresponding actual standalone HTML with the intended sortie; credits and explicit pending-device/rights notes are included (`:172-195`). The source archive retains inherited evidence, failed records and the new review material rather than deleting the workspace.

**Execution precondition:** the worker itself does not prove its parent runner's identity or impose a 900-second deadline. Its registration check binds attempt number and worker SHA (`:82-84`); timeout/process-group enforcement is external. The controller explicitly confirmed it will register the proven runner SHA, worker SHA, full command and **900-second deadline**, launch exactly once through that runner, record launch/terminal/group state, and not start if this precondition cannot be met. That is an operational precondition, not a claimed self-enforcement property of the worker. Current helper bytes must remain unchanged or be re-reviewed.

Recommendations for the authorized next step:

1. Bind this report's exact SHA, the reviewed head, final identity, composite acceptance and zero open required findings in the later approval. Preserve the controller's explicit runner/deadline precondition.
2. Treat any preflight failure, timeout, archive mismatch or partial output as a retained failed attempt requiring inspection, not as a successful freeze or permission to overwrite/retry blindly.
3. Report actual ZIP hashes and terminal outcomes only after the worker's all-entry audits succeed. This review is not evidence those future outputs already exist.
4. Keep the primary start note, failed-suite/composite wording, private-rights limits and pending Mac checklist prominent in delivery. Do not let inherited README/manifests become the apparent current approval.

## Declined to judge

- **Real Mac pixels, WebGL compilation, real texture decoding, west-edge/normal seams, green-roof elimination, ground artistic quality, floating appearance and occlusion visual quality:** no authorized GPU/device evidence was produced here; CPU geometry/GLSL arithmetic cannot establish these outcomes.
- **Frame time, memory behavior, seconds-long scheduling root cause or performance improvement:** no comparable device measurement; one extra draw and shader/fragment work may cost time. Earlier sample-video interval observations remain sample-limited.
- **Small-screen/UI/control acceptance and timed-out authorization attempts:** no execution occurred in those attempts and no retry is authorized by this review.
- **New physical contact precision, wall setback, sealed-roof/collider correspondence, low/over-wall projectile-ID limits, fresh route wins, AI/mission behavior redesign:** explicitly out of scope and unchanged. Historical replays were identity-checked, not rerun or reclassified as new acceptance.
- **Generalized use on moving/transformed-after-attachment, instanced or skinned building roots; arbitrary material names or incompatible future shader chunks:** these are not the actual three static shipping targets. The adapter's unsupported-material/fallback behavior is deliberate, not evidence of universal compatibility.
- **Behavior outside aspect .25..8 or entirely different camera rigs:** no coverage claim or approval beyond the stated production envelope.
- **Absence of every possible transient historical edit-and-revert or undocumented action:** equal saved snapshots/logs establish boundary identities and outcomes, not omniscient process history. No contradictory evidence was found.
- **Completed freeze/upload, Library IDs, archive transfer integrity and actual device launch success:** archive execution/upload has not occurred; future terminal/ZIP/transfer evidence is required.
- **Public/commercial redistribution rights, original Vanguard clearance, new tank/Strv completion:** rights remain unresolved, private development only, Strv remains paused. This technical review grants no rights or expanded authority.

The independent candidate is suitable to freeze under the stated execution preconditions and retained limitations. Older versions remain immutable; actual device/performance/public-release approval remains withheld.
