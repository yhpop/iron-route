# G2 — burned sealed warehouses and final candidate verification

**Status: DONE_WITH_CONCERNS.** Candidate implementation and source/CPU gates complete; fresh independent G2 and whole-candidate review must decide whether the composite verification is sufficient. **The full suite was not zero-failure:** once-only1117 tests /1094pass /2historical-view-pin failures /21inherited skips, followed by controller-authorized exact guard repair and2focused passes. No claim of GPU/device/beauty/performance/public-release acceptance.

## Owned scope and final identity

Original G2 authorization: new `work/src/battlefront-building-finish.js`, modified `work/src/authored-scene-view.js`, new `work/tests/battlefront-building-finish.test.mjs`, and G2/final evidence. The controller subsequently authorized only these two historical test-identity repairs after reading the real failures: `work/tests/battlefront-depot-scope.test.mjs` and `work/tests/crossfire-v4-front.test.mjs`. See `guard-recovery-authorization.md`. No G1 production/tests/evidence, frozen manifests, other assets or runtime sources were modified. GeneratedCN/EN outputs changed only through the single full suite's existing build regression.

- Approved G2BASE:385-file head `d4f625c03caff0fd5a6757fad208e8b05486805d8133059ce393fa2dc4c31f59`.
- Full-suite production/test head:387 files, `7b14f59b031208455818bff3b6bcb8377726b9aee95d238496284f016b84c76a`.
- Final387-file head: `da33d2baf957d806e6ee6c7e228516c1cb0802385dfe814c9a33b738f8369894`.
- Complete five-file SHA-based diff: `source.diff`, SHA256 `c5ef68385790957a399370478a1264d73f56ff3b6e60ded49a06c8efd8c812ed`; exact final copies in `final-source/`. No Git or commits.
- Full-suite→final drift is **exactly the two authorized test guards**. Every production source, asset, script and other test is exact to the full-suite input. All inherited config/evidence files are also checked by the1654-entry BASE comparison. Final identity: `../final/final-identity.json`; frozen suite input identity: `../final/pre-suite-identity.json`.

## Implementation and artistic choices

`applyBattlefrontBuildingFinish(root,{id})` is static, reversible and root-local. It owns one material clone per supported original material identity per root; array/multimaterial assignments preserve sharing and slots. It never owns geometry/maps, adds objects/draws/triangles/textures, mutates a map, or touches authoritative spec/state. Unknown/missing/non-PBR materials remain unchanged. Repeated application returns the same handle; cleanup restores its own bindings only, handles externally replaced bindings, disposes each owned clone once, and is transactional on source clone/upstream-cache exceptions.

The exact three integration targets are `south-depot`, `context-warehouse-0`, `context-warehouse-3`, only when `spec.battlefrontDepot` is true. Building handles have a separate array from existing vehicle finishes and are cleaned up on construction rejection and ordinary disposal. Root transforms, child hierarchy, all indices/position/normal/UV arrays and all material slots stay exact. Prototype art, pump/workshop/other buildings, vehicles and old modes are untouched. This does not identify an uncorrelated distant roof as the proven Mac culprit.

Coherent source coordinates use the fixed inverse authored root multiplied by world `modelMatrix * vec4(transformed,1)` after Three's project-vertex include. All primitives in one building share that one static uniform binding; different roots do not share it. No per-frame transform/uniform/update work is added. Existing upstream compile hooks and cache keys are chained. Versioned cache key is `upstream|battlefront-building-finish-v1|material-role`.

Art choices, not measured visual acceptance: roughness≥.88, metalness≤.16, environment intensity≤.30. Standard base materials remain opaque/opacity1; Physical fallback also caps clearcoat.03, raises clearcoat roughness.9 and removes transmission. Luma weights(.2126,.7152,.0722); desaturation Glass1, roof/paint.96, other roles.76; dry multipliers Glass.52, roof/paint.68, others.86. Broad sine field frequencies.47X/.38Z; apron falloff Z−3.5..3.5. Soot clamp(.24+.40apron+.12wave−.045Y,.12,.76). Ash smoothstepY1.3..3.8×(.24+.22wave). Char(.035,.032,.029)+.13luma; ash(.29,.275,.25)+.22luma. Original sampled texture detail survives beneath surface pigment. These continuous marks are not holes, damage events, collapsed roofs or new cover.

`cpu-palette.json` evaluates the actual generated GLSL arithmetic per channel on documented representative linear inputs. Example roof sample input(.12,.34,.09) at(0,3.5,−3) produces(.1842775,.1816721,.1716609); all documented roof/paint/glass samples have channel range<.025. This is **not decoded texture color, tone mapping, GPU pixel or artistic acceptance**.

## Actual shipping asset, geometry and occlusion evidence

`warehouse-geometry.json` independently binds original warehouseGLB SHA `3d36f5cc331470bb6e685019da941e45f93145f360eb1740e61a730e42e84dca`, binary chunk SHA, original JSON material/map/image metadata, consolidated hierarchy and all three instance matrices. Actual local GLTF loader reconstructs each8primitive/7156triangle model with source translated child(0,.49000000953674316,3.890000104904175). Texture references are omitted by the existing Node geometry helper; tests use explicitly labeled mocked-decode Texture placeholders tied to original map indices. No real image decoding or rendering is claimed.

Each building adds0triangles/0draws/0maps,24owned base clones total; G1's sole added draw/1312triangle exterior budget remains unchanged. `camera-binding.json` pins unchanged production main and the approved G1 source-level finite-frustum coverage record, not screenshots or a repeated camera simulation.

Tests use the real unchanged `createPlayerOcclusion` with an actual camera ray through the shipping warehouse, not a mock selection. Temporary fade copies keep the burned shader, versioned cache and same static uniform binding through custom clone propagation; further clone generations also retain them. Temporary copies may legitimately use transparent=true/.22opacity/depthWrite=false, while base materials remain opaque. Occlusion restores/disposes its temporary copies before finish disposal; the finish never registers those copies as owned. Clear-ray restoration, subsequent fade, disposal ordering and resource counts are checked.

The real authored scene uses shipping art plus the actual local interceptorGLB/library. Deep-frozen actual spec and `createGame` state survive repeated real scene updates with JSON-before/after exact. Candidate versus same-spec noncandidate compares all three target world transforms/geometry, other building materials, vehicle shader keys and source prototypes.

## TDD and every bounded job

The process-group runner was copied byte-exact from proven G1, SHA256 `0d07e3a29710269389f639e9165b8423f5b37ed3cfcc006c7eb692b02936f512`. It was not altered; the previously proven descendant-timeout fixture was not repeated. Every job was announced START(scope/deadline) and TERMINAL to the controller. Prelaunch command/UTC/PID/runnerSHA and all pre/post identities, complete logs and terminal records are retained. All job pre/post identities are equal, no job timed out, and every living group after wait is empty. No source/helper edits occurred while a job was pending.

| Job | Actual result | Elapsed / cap |
|---|---|---|
| `01-red` | 9 tests / 0 pass / 9 fail / 0 skipped; exit1 | 0.910 / 120s |
| `02-red` | 9 tests / 0 pass / 9 fail / 0 skipped; exit1 | 0.758 / 120s |
| `03-red` | 9 tests / 0 pass / 9 fail / 0 skipped; exit1 | 0.793 / 120s |
| `04-green` | 61 tests / 61 pass / 0 fail / 0 skipped; exit0 | 42.465 / 180s |
| `05-evidence` | source/CPU/hash assertions completed; exit0 | 6.772 / 90s |
| `06-full-suite` | 1117 tests / 1094 pass / 2 fail / 21 skipped; exit1 | 294.095 / 600s |
| `07-guards` | 2 tests / 1 pass / 1 fail / 0 skipped; exit1 | 0.907 / 60s |
| `08-guards` | 2 tests / 2 pass / 0 fail / 0 skipped; exit0 | 0.883 / 60s |
| `09-final-integrity` | source/CPU/hash assertions completed; exit0 | 5.399 / 90s |

RED history is preserved, never relabeled green. `01-red` exposed absent adapter and missing integration; it also found a test-fixture error: base art library had no pz3. The fixture was corrected to use the real existing interceptorGLB/library. `02-red` retained absent adapter/integration failures; absent diagnostics produced a TypeError, then the test was tightened to explicit untouched ZincRoof/SagePaint assertions. `03-red` is the genuine final9assertion RED. Exact versions live in `red-tests/`, `red-tests-v2/`, `red-tests-v3/`. Production implementation began only after03terminal. Scoped04 ran all9new tests plus relevant old art/authored/vehicle/occlusion/candidate/G1terrain tests:61pass/0fail/0skip.

### Once-only full suite and explicit historical guard recovery

Full suite ran **once** as `node --test --test-concurrency=2 tests/*.test.mjs`, through the process-group runner and bash glob expansion; exact163file expansion is `../final/full-suite-expansion.json`. Actual result1117/1094pass/2fail/21skip,293.923s Node time,294.095s enclosing job. All21skip names independently match the retained prior full-suite list exactly (`../final/test-results.json`); they are **not passes** and were not ungated. The previously intentionally unrun English entry now actually passed. No long input-only pilot/script or retained full tape was re-simulated as a separate job.

Both full-suite failures concern only the authorized authored view's historical byte pin:
1. Old BF2scope line5 expected changed=[], got only `['src/authored-scene-view.js']`. Contrary to initial hypothesis, G1's terrain test was absent from that historical BASE and needed no allowance.
2. Old V4 line88 expected authored view original SHA2e7da33acb99251e1a5b098c2d779749e43c9ce13f3efab8c4121607cfe1587c, got intended candidateSHA56e855b45a6ce89dffdccc80fb08122e190a115398344f5fe481425cb3eaf1ab.

The controller independently confirmed these were obsolete presentation identity expectations, not physical/source scope violations, then authorized only the two test repairs. Their titles now distinguish current grounded view from preserved original; both candidate SHA and original SHA are checked. V4 retains all other9source pins plus original spec and fixture invariance assertions. BF2 retains its exact original general allowlist and all remaining raw/gameplay checks.

The first focused recovery07 was **1pass/1fail**, because BF2scope correctly detected the other newly authorized V4test edit. This missed transitive guard dependency is retained and reported, not hidden. After another explicit controller authorization, BF2 gained only a strict current V4testSHA95098da030f0efa120d4d1da48133857b2117c002762113569468610291831dd + preserved original6a900c689224b4285b4ebe103465051a514a6324b49b6fb2d24709e1ec1f83da branch, not a tests-directory exemption. Recovery08 passed2/2. Original guards remain in `old-guards/`;07inputs in `07-guard-source/`. **No full-suite or build rerun occurred.** This is a composite gate with preserved failures, not a claimed1117test zero-failure rerun. Fresh independent review must accept or reject its sufficiency.

## Actual embedded CN/EN build output reuse

The current `sweep-acceleration-entry` regression actually executedCN `build.mjs` andEN `build-english.mjs` inside06. Their build terminal events are in the full-suite log. No separate production build was launched.

| Output | Actual game.js SHA256 | Bytes |
|---|---|---:|
| CN | `12e20eae7187051bfa6071ab5c1a02b7d28046cc4c05230dc70cce7fbe923c31` |38,702,545|
| EN | `a3e3dd5418547dd7afed25700cc9fc2c8eeb0e16b0a79e5655e180e0dcdf03a5` |38,688,493|

All16dist/dist-en output hashes/sizes are saved in `../final/full-suite-builds.json` and matched at final09 without changes. StandaloneCN `铁流_电脑浏览器离线版.html` andEN `Iron_Route_Desktop_Offline.html` embed the exact corresponding bundle bytes with the build's closing-script escaping and no external game.js reference. Actual manifest/metafile incoming edges prove main-only accelerated ruined→terrain→campaign→broadphase mapping; old alternate campaign/terrain worlds remain present. The new building module is bundled; Strv and archived generated catalog remain absent. Both manifests still explicitly say browserVerified=false/runtimeRequestsMeasured=false.

Current main unchanged SHA `2f9e5103d6ff46f3ec162e54137b12f118a912417b5aeeb5108ff43a8af02e73`; original pre-BF2 main SHA `9d937baf1d64fcb3409d3e975e1cf836c221e900dea420fdd57741289867e6dc` remains pinned in untouchedBASE. No gratuitous main hash rebinding.

## Protected physical and predecessor identity

Final09 verifies all1654inherited entries;15differ only as authorized:3G1/G2production/test inherited changes plus2historical guards and10generated CN/EN build files. The3newG1 files and2newG2 files are tracked in the387source/test/script/asset head. G1 production/tests match the approved G2BASE exactly; this task made no writes to G1 evidence. The approved G1review SHA remains exact to G2BASE. A complete historical pre/post census of every G1 evidence file was not captured by G2; source/raw authority and the unchanged review binding are independently checked.

Physical closure uses the exact original BF1 roots, recursively discovers **31keys**, and matches both `sourceSnapshot` text and `sourceHashes` maps to current work. The earlier30key import-discovery root-set is not substituted for this authority. Both original raw compressed artifacts retain exact bytes:
- direct SHA `0d76b716b131103839fd8e9fcfb61de5aa74bc58cb44e6d0bbbdf1061dbc1361`,8323inputs;
- covered SHA `5a470daefbd47a83e045f772fe3bb4f3c568e1ab6bb0c4e2c66bdf21b810bb08`,13600inputs.
These are retained full-input artifacts, **not fresh route simulation/gameplay evidence**. Hash/source binding proves unchanged authority, not new actual-device behavior.

Protected predecessor source ZIP remains `5746b1c62205353868221149bd5f47018edbc01f95a38a22700e7779d1a0bd95`. All382parent source/test/script/asset files compare exact to the extraction baseline;12device/source ZIPs across Battlefront, sweep acceleration, ruined depot, scanned cover, crossfireV3 and crossfireV4 compare exact pre/post. Full hash maps in final identity. No frozen predecessor was overwritten or packaged/uploaded by this task.

## Remaining concerns and handoff

- Independent G2 spec/code review and strongest whole-candidate review remain required; selfreview is not a substitute. The composite full-suite/repaired-guard evidence needs their explicit disposition.
- No WebGL compiler, real texture decoder, browser, Mac, Blender, screenshot, small-screen operation, runtime performance/memory measure or visual acceptance was performed. Source/CPU evidence cannot prove GPU output or beauty.
- One extra G1draw/1312triangles and extra material shader arithmetic are not a performance fix or zero-cost claim. Prior short Mac sample with no>900ms gaps applies only to that sample. Small-screen authorization attempts timed out without execution; no retry.
- Warehouses remain sealed/intact-shape burned surfaces with inherited coarse roof/box collision approximation. Boundary tank-center/decorative-wall setback remains unchanged. No holes/colliders/layout/actors or new tank; Strv paused.
- Original Vanguard public/commercial rights unresolved; private development acceptance only. Controller alone may package after reviews; no publishing/upload by implementer.
- Read-only inspection errors (broken pipe and two mistaken ridge module paths) are retained in `inspection-failures.txt`; no source consequence.

## Exact worker commands

All commands below execute from `work/`; enclosing runner is `python3 evidence/grounded/g2/run-job.py NAME LIMIT COMMAND...` from candidate root. Limits and prelaunch identities are in each launch JSON.

### 01-red
```sh
node --test --test-concurrency=1 tests/battlefront-building-finish.test.mjs
```

### 02-red
```sh
node --test --test-concurrency=1 tests/battlefront-building-finish.test.mjs
```

### 03-red
```sh
node --test --test-concurrency=1 tests/battlefront-building-finish.test.mjs
```

### 04-green
```sh
node --test --test-concurrency=1 tests/battlefront-building-finish.test.mjs tests/authored-scene-view.test.mjs tests/art-kit-contract.test.mjs tests/war-vehicle-finish.test.mjs tests/player-occlusion.test.mjs tests/crush-occlusion-integration.test.mjs tests/battlefront-depot-presentation.test.mjs tests/battlefront-depot-terrain.test.mjs tests/battlefront-grounded-terrain.test.mjs tests/battlefront-perimeter.test.mjs tests/crossfire-terrain-appearance.test.mjs tests/relief-async-textures.test.mjs
```

### 05-evidence
```sh
bash -c 'node ../evidence/grounded/g2/analyze.mjs && python3 ../evidence/grounded/g2/integrity.py pre'
```

### 06-full-suite
```sh
bash -c 'node --test --test-concurrency=2 tests/*.test.mjs'
```

### 07-guards
```sh
node --test --test-concurrency=1 '--test-name-pattern=^(BF2 frozen gameplay and raw remain exact; grounded view has separate candidate and preserved-original SHA bindings|V4 retains V3 physical sources and spec; grounded view and preserved V3 view have separate exact SHA bindings)$' tests/battlefront-depot-scope.test.mjs tests/crossfire-v4-front.test.mjs
```

### 08-guards
```sh
node --test --test-concurrency=1 '--test-name-pattern=^(BF2 frozen gameplay and raw remain exact; grounded view has separate candidate and preserved-original SHA bindings|V4 retains V3 physical sources and spec; grounded view and preserved V3 view have separate exact SHA bindings)$' tests/battlefront-depot-scope.test.mjs tests/crossfire-v4-front.test.mjs
```

### 09-final-integrity
```sh
python3 ../evidence/grounded/g2/integrity.py post
```
