# G1 — static exterior ground and coherent existing-mask damage

**Status: DONE_WITH_CONCERNS.** Scoped implementation and CPU/source gates passed; fresh independent review required before G2. This is not GPU, real-device, visual, performance or public-release acceptance.

## Scope and changes

Only these five authorized files were written outside this evidence directory:
- `work/src/battlefront-perimeter-view.js` (new)
- `work/src/terrain-candidate/relief-view.js`
- `work/tests/battlefront-depot-terrain.test.mjs` (candidate expectations intentionally revised)
- `work/tests/battlefront-perimeter.test.mjs` (new)
- `work/tests/battlefront-grounded-terrain.test.mjs` (new)

The actual 160×168/.5m field, base relief positions/normals/colors/UVs/indices, roads, production main, existing ground-detail mesh, physics/collision closure, mission builders, clocks, input, placements and player code were not changed. Candidate-only `battlefront` now returns optional `perimeterMesh` while retaining `mesh/update/ready/dispose`. Old default/scorched/crossfire retain exact shader text and mask bytes and no ring. Candidate cache key is `relief-pbr-world-weather-v6-battlefront-grounded`.

The exterior is optical-only, opaque, no caster, receives shadows, excludes generic raycasting, and shares the base material and all maps. It never enters ground sampling, physics, navigation or projectile rays. Base and ring geometries, single owned material and seven texture objects dispose exactly once, including repeated disposal. No new textures, samplers, lights, particles, normal maps, base-terrain normal/displacement changes, timers or recurring JS updates. There is one additional draw plus its PBR fragment work: no claim of zero GPU cost or improved performance.

## Test-driven execution and bounded jobs

All jobs used the new owned `run-job.py`, not inherited BF2 runner. It starts a new session, monitors the process group even if its leader exits, sends group TERM then KILL on deadline, waits the leader, adopts/reaps orphan descendants, and records empty living group. The .3s fixture deliberately exits its leader early while a descendant ignores TERM; it timed out correctly, killed/reaped the descendant, and left no living member. Exit124 is intentional for this fixture.

Before every worker the controller received START/scope/timeout; after terminal it received result. Launch identities contain exact command, UTC, runner SHA and PID. Each job has pre/post source/test/script/runner hashes, terminal JSON and complete log. All pre/post identities are equal, and all terminal living groups are empty. No source edits occurred while a job was pending.

| Job | Result | Seconds | Limit |
|---|---|---:|---:|
| `00-timeout-fixture` | Expected timeout; descendant termination proof; exit 124 | 0.533 | 0.3s |
| `01-red` | 0 pass / 6 genuine assertion failures; exit 1 | 11.344 | 120s |
| `02-green` | 17 pass / 1 test-adapter error; exit 1 | 14.988 | 120s |
| `03-green` | 20 pass / 0 fail / 0 skip; exit 0 | 24.898 | 120s |
| `04-entry` | 3 pass / 0 fail; English test intentionally unrun; exit 0 | 3.227 | 120s |
| `05-analysis` | Numeric mask/geometry/coverage/swatches generated; exit 0 | 1.812 | 60s |
| `06-final-integrity` | Full inherited identity + retained authority checked; exit 0 | 2.020 | 60s |

RED failures were missing four-zone export, missing char/ash branch, unchanged B and missing ring (three tests). Genuine assertion output is retained in `01-red.log`; exact original RED test content is preserved under `red-tests/` and matches recorded prelaunch SHA. Production was changed only after this terminal RED.

`02-green.log` is retained: its sole error was `ReferenceError: max is not defined` in the JS GLSL-arithmetic adapter. Root cause was the omitted GLSL `max` → `Math.max` mapping; only that test adapter was corrected, with no production workaround. `03-green` then passed all20. Other read-only inspection errors and an input-count metadata TypeError are explicitly retained in `inspection-failures.txt`.

The TDD skill's generic full-suite advice conflicts with the explicit G1 gate; the controller's scoped-only/no-build instruction was followed. The existing entry file's fourth English test imports an in-memory esbuild bundle; controller explicitly approved filtering it out. Node reports three selected tests, not a counted skip. It is **intentionally unrun, not a pass**, and remains for later authorized full-suite/build verification. No full suite, production build, long simulation, browser, Mac, Blender, Git, install, network, download or upload was performed.

### Exact worker commands

All commands below run from `work/`; the enclosing runner invocation is `python3 evidence/grounded/g1/run-job.py NAME TIMEOUT COMMAND...` from candidate root.

`00-timeout-fixture` (0.3s):
```sh
python3 ../evidence/grounded/g1/timeout-fixture.py
```

`01-red` (120s):
```sh
node --test --test-concurrency=1 tests/battlefront-perimeter.test.mjs tests/battlefront-grounded-terrain.test.mjs
```

`02-green` (120s):
```sh
node --test --test-concurrency=1 tests/battlefront-perimeter.test.mjs tests/battlefront-grounded-terrain.test.mjs tests/battlefront-depot-terrain.test.mjs tests/crossfire-terrain-appearance.test.mjs tests/relief-async-textures.test.mjs
```

`03-green` (120s):
```sh
node --test --test-concurrency=1 tests/battlefront-perimeter.test.mjs tests/battlefront-grounded-terrain.test.mjs tests/battlefront-depot-terrain.test.mjs tests/crossfire-terrain-appearance.test.mjs tests/relief-async-textures.test.mjs
```

`04-entry` (120s):
```sh
node --test --test-concurrency=1 '--test-name-pattern=^(real featured entry uses exact mission flags, Sandfalcon, shared field and accelerated world path|candidate real direct URL retries rejected library without poisoning cache|candidate waits for actual loaded world readiness and discards stale selection)$' tests/battlefront-depot-entry.test.mjs
```

`05-analysis` (60s):
```sh
node ../evidence/grounded/g1/analyze.mjs
```

`06-final-integrity` (60s):
```sh
python3 ../evidence/grounded/g1/final-integrity.py
```

## Geometry and camera proof (source/CPU only)

`coverage-budget.json` records actual generated geometry, source-derived camera parameters and representative clipped ground-plane intersections. Every one of656 perimeter edges is stitched to the corresponding base-field Float32 vertex; corners are shared without duplicate strips. All1,312 triangles wind upward. Every triangle lies wholly in at least one exterior half-space, and summed projected area exactly equals outer rectangle minus playable rectangle (1.51603e+06m²). Original base mesh is byte-exact.

Outer bounds are x[-616,616], z[-618,618], i.e.576m beyond original. Inner heights are actual field-edge values, outer y=0; UVs stay x/4,-z/4. Base53,760 + ring1,312 =55,072 triangles, base1 + ring1 =2 draws. Zero added maps/texture bytes. Field actual height range is 0..4.2m.

Actual main camera FOV42°, near.15, axial far150, offsets portrait(8,23,22)/landscape(10,19,18), .85 aspect switch and2.2m aim offset were read from unchanged production source, not demo camera. Test projects actual Three camera frustum vertices for aspect extrema, both switch branches and400×300,844×390,1280×720,390×844 review viewports, at all coordinate-envelope corners and target heights. Smoothing is a convex history of reachable focus positions; target height0.5..4.7 is covered. Entire finite frustum is inside ring rectangle in XZ.

Continuous-aspect conservative Euclidean reach is axial far150×sqrt(1+tan(21°)²×(1+8²)) = **487.854190500m**, not150m. Including target/spec/aim/camera envelope yields x[-522.054190,540.054190], z[-514.054190,554.054190], fully enclosed. This proves only the stated aspect.25..8 and source bounds, not unrestricted viewport behavior or real rendered ground/pixels. It does not rely on fog or blindly dividing horizon-crossing rays.

Existing tank-center limits x±37,z±39 versus decorative retaining-wall centers x±40.6,z±42.6 remain unchanged. This inherited physical/visual setback is not solved; the exterior is not playable cover, an extra collider, or evidence of exact wall contact.

## Actual mask and coherent damage

`mask.json` records actual generated1024² mask bytes, channel hashes, histogram and four anchors. Existing storage remains4,194,304 base bytes; there are **0 R/G/A raw-byte mismatches** against old crossfire. **1,041,337 B texels** change. Quiet B<.35 = **85.504913330%** (required≥35%); high B>.72 = **4.461574554%** (required<20%). B bytes range22..247.

B = clamp(.12 + .035×existing MIT low-frequency noise + .83×max(four continuous warped ellipses),0,1). Warp components are1.2m-scaled existing simplex noise. Ellipse anchors/radii: south apron(-26,25)/(8,10); west loading(-30,18)/(7,10); workshop(-32,-5)/(6,13); east window(19.5,0)/(6,10). This is world-space, not triangle-dependent confetti. Anchor core weights are0.953546, 0.960892, 0.938127, 0.952545; 20m X falloffs are0.125466, 0.114820, 0.127819, 0.100515. Local4m-square high-damage fractions are100%; sampled5cm differences remain below.0063. Quiet ridge negative space is retained.

Actual candidate GLSL outside-mask condition is executed by the CPU adapter at each side, corner, seam and exterior: outside bounds R/G/A=0, B=.18; seam itself remains inside. This prevents clamped edge roads/ruts extending across the ring. No extra sampler or map exists.

`cpu-swatches.json` records exact palette/weights and evaluates actual straight-line candidate GLSL arithmetic for representative linear earth(.32,.27,.19), coarseLuma.32 and asphalt.1 inputs. It is not image decoding, tone mapping, GPU pixels or artistic acceptance. Palette: soil(.25,.22,.175), detail tint(.94,.86,.73),62%detail; compacted(.25,.205,.15), tint(1,.85,.65),56%detail,22%rut darkening,85%earth-route blend; dusty ash(.34,.30,.25) with38%(.86×luma); char(.035,.030,.026) with35%(.20×luma). Ash shoulder = smoothstep(.24,.48,B)×(1−smoothstep(.64,.88,B)); char = smoothstep(.57,.88,B). Ash mix76%, core char88%; asphalt pigment is exactly25%×max(ash,char), never more than25%. Soil dirt/rut effects survive final char/ash compositing; asphalt does not inherit the earth-route channel. Ground normal scale remains candidate.48. No displacement.

## Identity / immutable authority / complete diff

- Approved source ZIP SHA256 `5746b1c62205353868221149bd5f47018edbc01f95a38a22700e7779d1a0bd95` unchanged.
- BASE manifest SHA256 `f9cb2f71b98f6a61fa3fbe73191c621542c4a5d3875f2fe857a184230599eaec` preserved. All1,654 inherited entries checked: only the two authorized preexisting files differ; no unexpected change. Three newly owned work files exist in addition.
- Existing BF1 direct and covered raw artifacts each retain31-key `sourceSnapshot` **and** `sourceHashes` exact equality to current work. Their full input/results artifacts are unchanged; direct8,323 inputs and covered13,600 inputs are retained evidence, **not fresh simulation**. See `retained-physical-identity.json` and final recheck in `final-identity.json`.
- Initial import-discovery closure used a different30-key root set. It is not the authority: BF1-only keys are two armor rig asset modules and two player-vehicle modules; discovery-only keys are campaign-input, unaccelerated campaign-world and session. No raw source or binding was changed to erase that definition difference.
- Complete work source/tests/scripts/assets content head contains385 files; canonical SHA256 `d4f625c03caff0fd5a6757fad208e8b05486805d8133059ce393fa2dc4c31f59`. No Git command was permitted; content-addressed head replaces a Git HEAD claim.
- Unified authorized-file diff: `source.diff`, SHA256 `aaa0472297e65b0728a955a1e5e8af68b65adb0151877f28c68dc5782f5cdb31`. Full owned source snapshots: `final-source/`. Every source SHA is in `final-identity.json` and per-job pre/post identity manifests.
- New runner SHA256 `0d07e3a29710269389f639e9165b8423f5b37ed3cfcc006c7eb692b02936f512`.

## Remaining concerns / handoff gates

1. Fresh independent G1 review required before G2 integration. No G2 file was touched and G2 needs no private G1 implementation dependency.
2. CPU/source checks do not compile shaders in WebGL or prove west-edge appearance, coherent visual damage, small-screen controls, memory/frame timing or real Mac acceptance. Those stay pending under separate authorization. Aspect beyond.25..8 is not covered.
3. One static exterior draw/1,312 triangles and its PBR fragments add real GPU work; no performance-fix claim. The supplied Mac sample's lack of>900ms gaps applies only to that sample; timed-out small-screen attempts were not retried.
4. No full suite or CN/EN production builds in G1. Controller's later once-only full suite/build gate and21 inherited gated skips remain separate, not silently marked passed.
5. Original Vanguard rights remain unresolved; private development acceptance only. No new tank; Strv remains paused.

No pending worker or surviving process group remains at handoff.
