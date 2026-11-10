# BF1 independent review

## Verdicts

- **Spec compliance: PASS WITH QUALIFICATIONS for BF1's offline scope.** The frozen candidate supplies the required new mission, natural multidirectional fighting, real cover, two Sandfalcon convoy wins and full-result replay evidence without changing the preserved engine/assets. Cover establishes retreat followed by effective hold-cover against a returning in-range live enemy; it does **not** establish an instantaneous in-range clear-to-blocked disengagement. This is not BF2 integration, device acceptance or whole-branch merge approval.
- **Code quality: CHANGES REQUESTED — one Important acceptance-test identity gap.** Current saved raw evidence checks out; the gap is that two central regression tests do not themselves bind their derived summaries to those raw/current sources. No production correctness defect or Critical issue found in the reviewed diff.

## Review boundary / identity

Read the BF1 brief, design, implementer report and the complete seven-file new-source diff. The supplied package SHA256 is `96c57761c7ea354d9d53195de0cd1bceca6917fbfd2ebfcabe2a6a28f05d7ac6`; BASE and head manifest hashes independently match `90fb8d9fb19e720acab5542b24ca28c8308b94bb13a39d55942195baa9520545` and `e9013e8a02cdc01c5a39b98c81bdc4e322dafac78907425645c49bf935d5d104`. The controller's fresh 709-file unchanged-baseline result is accepted as the preservation boundary; I did not redundantly rehash that tree.

Read only named saved artifacts and the exact saved physical-source snippets needed to check cover origin/range/aim height. No tests, route simulations, builds, browser/device jobs, Git, network, downloads, installations or subagents were run. Artifact decoding/hash/equality inspection is not a new replay. Only this review report was written.

## Strengths / checked evidence

1. `work/src/battlefront-depot-front.js:6-23` creates a fresh scanned-cover mission with ID/index/slug 9080/9080/battlefront-depot, retains the five entity IDs/rules, authors only the permitted poses/patrols, and shares the three ruin instances between colliders and the existing view/ray pipeline. The workshop collider and matching landmark are removed together; no foundation or field edits are introduced. Tests cover unchanged field, roads, routes, zones, objectives, spawn and convoy data, old builder bytes/behavior, conservative patrol/choice clearance and independent results.
2. `work/scripts/battlefront-replay.mjs:9-21,29-43` uses the accelerated production ruin world, literal `createGame`, validated normal controls and production `stepGame`; pilot reads do not inject targets, poses, HP or outcomes. Raw results precede win assertions; fresh verification writes its generated result before whole-JSON equality. Existing control tapes are reused only as inputs. Sources are captured and checked unchanged at run end. Three source-layout versions and five harness snapshots, actual assertion REDs, diagnostic losses/failed cover attempts, and serial terminal logs are retained.
3. Decoded both accepted route artifacts and independently generated counterparts: entire parsed JSON results are equal. Each original attempt differs from its accepted result only by the explicit `failure:null` diagnostic field. Direct has 8,323 inputs, tick 8,322, won, player28/supply100 HP; covered has 13,600 inputs, tick13,599, won, player80/supply16 HP. Supply is alive/arrived, selected routes match, and friendly-damage events are zero. Both source snapshots contain 31 files matching current bytes and their SHA256s; JS-recomputed spec/final hashes and closure aggregate match recorded values. Closure aggregate: `2d8e706932808be909a52a890e3ee3524f40eb6532f476bff1feb7cac8beb9a1`.
4. Independently checked `v03-crossfire-analysis.json` against the saved raw artifact's hash, spec/source identity, frames and actual shot events. Road tick820 and flanker tick867 use identical player pose and actual muzzle origins separated156.4904438120621 degrees. Both are alive/targeting player at both events; tick867 contains both actual projectiles. Damage follows at ticks870/880 from the two hostiles. Raw has1,273 recorded overlap ticks and five frames with both owners' projectiles. The generic diagnostic uses +1m rather than exact player aim height, so I rely on actual production shot/projectile/damage/target records for the natural fight, not the generic LOS counter alone. Covered raw contains real support-to-flanker and flanker-to-support damage.
5. Compared the early-cover summary's selected records with `v03-cover-retreat-01-result.json.gz` exactly. Last clear engaged in-range tick1370; first clear-to-blocked transitions1917/2162/3424 are out of range. At2231 through3117 (887 ticks), the live90HP road enemy returns within19m while exact rays hit `scorched-east-cover`; player stays48HP, truck100HP. Origin y=pose.y+1.3, 3D range and resolved Sandfalcon aim height match saved production `combat.js:154-161`. Enemy idle/null target behind cover is consistent with the visibility check, not proof of ongoing firing through it. This substantiates real hold-cover after retreat, not the stronger same-in-range transition claim.
6. `ground-budget-final.json` records all331 exported base vertices at approximately0..0.000000799m gaps,757 triangles,61 spans and three instances. The inherited west destructible-fence route envelope remains honestly blocked; actual winning convoy passage is separate evidence. Existing source/provenance files retain CC-BY/CC0 attribution and the original tank's unresolved commercial-rights boundary; no new map/asset family is in this diff.

## Findings

### Critical

None found.

### Important

**I1 — Core natural-combat/cover tests trust unbound derived summaries.** `work/tests/battlefront-depot-replays.test.mjs:4-5` reads `v03-crossfire-analysis.json` and `early-cover-retreat-analysis.json` and asserts their fields, but never opens their corresponding raw crossfire/retreat artifacts, checks raw identity/current spec/source closure, or establishes that the summarized pair/cover records actually occur there. Crossfire analysis carries a raw hash/spec/source hashes, but the test ignores them; cover analysis names its raw file/spec hash, also ignored. The strong source/full-result binding at line3 applies to the two **route** records, not these separate diagnostic runs. Regenerating route acceptance for a future changed mission can therefore leave these central gates green on stale summaries. A changed analysis claim alone can also pass without supporting recorded events.

Current evidence is not rejected: the read-only raw audit above verifies these exact artifacts against this frozen source. Before treating the focused suite as a reusable acceptance gate, load both named raw files; bind their spec/source closure to the current candidate; verify the crossfire raw digest and derive/locate both shot/player/projectile records; derive the in-range static-cover interval from `coverInspection` with the exact aim-height/range semantics. Preserve the out-of-range first-transition qualification. This requires bounded artifact-only assertions, not another route search or physics change.

### Minor

**M1 — Evidence tooling/tests are excessively compressed.** `work/scripts/battlefront-replay.mjs:9-43`, `work/scripts/battlefront-analyze.mjs:1-6`, and `work/tests/battlefront-depot-world.test.mjs:4-7` put complex provenance, pilot, persistence and geometry assertions in very long single lines. This obscures assertion ordering and makes future source-identity mistakes harder to review; stack traces identify a whole phase rather than the failed operation. Reformat into named helpers/ordinary statements without changing semantics when the controller schedules the narrow I1 change. If harness bytes change, update the saved verification harness identity transparently rather than silently claiming the old harness ran.

## Evidenced test scope, not new execution

Inspected actual RED logs: missing-builder assertion and inherited support/choice-envelope assertion; neither is a throwing stub/import failure. Worker records list14 serial bounded terminals with expected exit1 for those REDs and exit0 otherwise, including retained diagnostic failures. Final log `14-final-focused.log` records16/16,0fail/skip,17.27s, exit0: BF1 contracts/artifact assertions; all-five spawn plus90-frame forward/reverse/pivot checks;120 literal-input full reference/accelerated states;84 new-layout static/dynamic/wreck query comparisons; unchanged static/threshold and dynamic contracts. Independent route replay logs record terminal exact-result success. I did not re-run them.

The all-five check is basic spawn/input movement only, not five full routes or five-rig apron traversal. Isolated synthetic dynamic/wreck fixtures are not input-only gameplay acceptance. These limits are appropriately disclosed.

## Cannot verify / next gate

- No actual camera/material/ground-detail presentation, HUD/actor exclusion, mission entry/main wiring, browser route usability, resource disposal or device scheduling smoothness is established by BF1; these are pending BF2/Mac gates, not BF1 failures.
- No all-five full-route playability, collision reverse/near-truck fix, all-five workshop turn clearance, performance improvement, or commercial asset licensing is established or claimed.
- Fresh-run provenance is supported by the saved harness, source snapshots, generated artifacts and terminal logs; this read-only review does not independently execute the simulations or certify an external device.
- Recommend the controller's planned integrated/full-suite and device gates after BF2; no additional heavy worker or unbounded placement search is recommended here. Fix I1 with bounded artifact assertions and retain the current cover limitation verbatim in downstream acceptance.
