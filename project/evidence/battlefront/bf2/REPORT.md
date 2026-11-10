# BF2 — playable freight-yard presentation and entry

**DONE_WITH_CONCERNS.** Mission `mission-9080` / `battlefront-depot` now has a real featured/direct-URL entry, initial Sandfalcon and all five retained player choices, candidate-only mineral/ash ruin material ownership, one bounded grounded wear/spall bucket, hidden candidate zone outlines with active gold choice/objective rings preserved, and opt-in mineral-earth terrain appearance. The exact BF1 physical encounter is unchanged.

**Offline final gate passed:** 1,100 tests / 1,079 pass / 0 fail / 21 inherited skips, 340.331s; actual CN+EN builds; both original-harness final input replays reproduce entire state/event evidence and even compressed raw bytes. **Not browser/Mac/visual-quality/device/performance acceptance.** Parent independent review and authorized Mac review remain required. No commit, package, upload or publication was made. All workers are terminal.

## Final identity and immutable boundaries

- BF2 base-head SHA256: `ab7137a2a7cc6b92ce1d40cc7ff869f1192768179248c5321bc98fd2c4d45d77`.
- Frozen final source/config manifest: `final-source-manifest.json`, SHA256 `d1c5f94bb5589c2405f01da6618fa7e60ba005beee8af8f4242b45baa8b09d6f`, 324 files. Exact copies: `final-source/`.
- Final `work/src/main.js`: `2f9e5103d6ff46f3ec162e54137b12f118a912417b5aeeb5108ff43a8af02e73`.
- `final-audit.json` and `source-and-geometry-audit.json`: 732 base work files checked; exactly seven authorized existing files changed, all other **725 byte-exact**, including BF1 builder, physical closure, harness/tests/raw, assets and `style.css`. No missing base files. Eight new work files, listed below.
- All **62 original BF1 evidence files** are exact (`bf1-evidence-before.json` / `bf1-evidence-after.json`). All **709 original parent work files** remain exact against `BASE.json`; all **28 restored historical external-test fixtures** remain exact in both candidate and original parent trees. These historical dependencies were restored by the controller, not newly observed BF1 acceptance.
- The old suite regenerated the copied `evidence/ruined-depot/integration/route-qa/isolated-input-fired-shells.json` using its existing subprocess and deep comparison. Its before/after SHA remains the recorded historical value. No failed or original BF1 evidence was repaired/replaced.
- No browser, Mac, Chromium, Playwright, Blender, install, network task, operational Git, subagent, reviewer, release or upload was used. Existing `node_modules` was only borrowed read-only. No scope expansion beyond the brief was needed.

## Implemented scopes

1. `main.js`: builder/resolver/terrain resolver/featured entry; `withPlayerVehicle(...,'sandfalcon')`; candidate-only zone option, appearance and static warfield owner. Old slugs/defaults/crafted missions, compact UI/CSS, simulation and player-selection guards remain unchanged. The original `./ruined-depot-world.js` main import remains: the existing build plugin still resolves it to accelerated exact world. Loader failed-promise cache retry, late-selection guards, loaded-world readiness and occlusion-before-ruin disposal ordering are retained and exercised.
2. `campaign-view.js`: explicit `suppressZoneBoundaries` option only. Logical zones are untouched; real campaign update still produces gold route-choice/objective rings. Existing old mission boundary creation remains the same path.
3. `ruined-depot-view.js`: only `battlefrontDepot` clones/tints materials; clones share by original material identity. Geometry/maps/library materials remain borrowed. Roughness 1, metalness 0, bounded linear mineral multiplier (.61,.58,.53); no exposure change. Transactional preparation precedes proxy visibility mutation. Real THREE identity/dispose events verify one owned clone per original, exactly-once disposal, mixed material-array reuse, library/material clone error cleanup and occlusion restoration before tint disposal. Texture decoding/real art rendering is not observed by these fixture tests.
4. `crossfire-warfield-view.js` dispatches only this candidate to new `battlefront-depot-ground-view.js`. The candidate's main ambience path bypasses old generated smoke/stains; the new warfield does not instantiate old floating wall scars/far proxy frames/fragments or a second full-map layer. Old missions retain their existing view owner and buckets.
5. `relief-view.js`: optional `appearance='battlefront'`, same six terrain maps and existing 1024 RGBA mask/B weather channel, unique `relief-pbr-world-weather-v5-battlefront` cache key. No near-black char branch. Real CPU comparisons against frozen base implementation prove default/scorched/crossfire shader strings, masks and contact geometry unchanged. Candidate shares crossfire weather mask bytes and exact terrain geometry; no new sampler/texture/frame update. Palette is an authored trial, not measured beauty.
6. `en-missions.json`: exact title/briefing translations only for the new builder. Old English inventory entries are unchanged; no `en-ui.json` edit.

### Bounded existing test-contract adaptation

Only one historical test file changed: `tests/sweep-acceleration-entry.test.mjs`. It used the earlier no-main-edit task's original-main hash, which is stale for this expressly authorized entry addition. The test now pins the frozen candidate main; retains original `9d937baf…67e6dc` identity through `BASE.json`; retains all exact main-only resolver, namespace/importer negative controls, CN+EN metafile chain, archive exclusion, Strv exclusion, old other-world imports and before/after source nonmutation checks; adds new builder ID/ruined flag, real resolver/dispatch and build-input assertions for this mission. Nothing was deleted/skipped to conceal a regression. No other historical entry/localization expectation needed changing.

## Actual generated geometry/resource budget

`battlefront-depot-ground.test.mjs`, `source-and-geometry-audit.json` and `resource-buckets.json` inspect actual mission-generated geometry, not just unrelated unit fields.

| CPU source/resource measure | Copied-base presentation on same BF1 field | Candidate |
|---|---:|---:|
| Generated warfield draw buckets | 4 (3 subsequently hidden by old ruin adapter) | 1 |
| Visible warfield triangles | 6,454 soot | 2,666 total |
| Generated total warfield triangles | 11,042 | 2,666 |
| Ground triangle ceiling | old visible soot + 460 = 6,914 | 2,666 |
| Flat spall triangles | old 460 random grid-shaped fragments, hidden | 340 clustered irregular shards |
| Visible bucket typed-attribute bytes | 774,480 | 319,920 |
| All generated bucket typed-attribute bytes | 1,269,984 | 319,920 |
| Added textures / physics bodies / terrain writes | — | 0 / 0 / 0 |

- Wear: 2,326 terrain-triangle pieces, one continuous shared-vertex RGBA field; 1,331 shared wear vertices. No per-triangle stain shading. Spalls use randomized scalene inset shapes, not scaled copies of grid silhouettes.
- Placement sources are the exact 61 movement-span world transforms derived from the three real ruin instances. Spalls: loading 104, west workshop 175, east window 61; road lanes plus .65m margin stay clear under checked vertices/interior samples. Inventories include authoritative source IDs/transforms.
- Every emitted triangle is finite, bounded and contained in one declared authoritative heightfield triangle; convex containment plus 15 barycentric interior samples verify shared linear contact. Paint offsets: wear .008m / spalls .014m, observed maximum 0.014000000458m (Float32 tolerance), below .018m. These are optical paint/flat spalls, **not physical rubble, holes or cover**.
- Position SHA256 `9167ec5512feea243e87653e1920c833f463d7d87711c88d746bd25d5fe0e66c`; RGBA SHA256 `1783a25fba6cf2848c88809bddc72d7518d66e62bdb1298ada1e720712f3e9cd`. Counts/hashes pinned; repeated construction is deterministic. Static `update()` performs no work/allocation, upload, timer, texture or body creation; geometry array identities/versions remain unchanged through updates.
- Field remains 160×168 cells at .5m, 217,672 height bytes, height SHA `a92703fdf516993795ee183906274c91853fc861b6ba2a0770b6a546b966b6bb`. Same five entities, 73 colliders, 61 ruin movement spans, three art instances / 757 exact shell triangles, unchanged weapons/AI/clock/input/contacts.
- Existing six terrain maps + one RGBA mask: mask base 4,194,304 bytes, mipmapped 5,592,404 bytes; no new map URL/image/asset. All 64 source asset files / 52,096,910 bytes exact. Both metafiles use the same 17 asset inputs. The closed ruin GLB still has one material definition and three embedded images; adapter tests prove clone sharing but real decoded/GPU material counts were not measured.
- Main caches one additional optional builder/field: **217,672 additional field-array bytes**, plus unmeasured JS spec/diagnostic records. New ground typed buffers are 319,920 bytes (−454,560 versus old visible soot; −950,064 versus all old generated warfield buckets). These are bounded CPU resource counts, **not total allocator/GPU memory, submitted draw counts, FPS/stutter or a root-cause claim**.

## Verification chronology, commands and retained failures

All jobs were serial at the orchestration level. Focused/audit caps ≤120s; route/full-suite cap 600s. Test concurrency 1 except final suite 2. `worker-records.json` and each `*-terminal.json` retain exact commands, terminal times, exits and limits. Source SHA inventories are captured before and after every job from 03 onward and all report `CODE_DRIFT []`; no app/test/script/locale edit occurred while those jobs ran. START/END messages were sent to controller; 03's START message was immediately after launch, not before.

| Job/log | Yielded session | Cap | Outer exit | Recorded time |
|---|---|---:|---:|---:|
| 01-red | 24911 | 120s | 1 | 70.520s |
| 02-red | synchronous/no yielded session | 120s | 1 | 0.846s |
| 03-focused | 96585 | 120s | 1 | 12.403s |
| 04-focused | 13305 | 120s | 0 | 10.256s |
| 05-regression | 4824 | 120s | 0 | 18.274s |
| 06-audit | 25877 | 120s | 0 | 2.776s |
| 07-final-focused | 20461 | 120s | 0 | 14.149s |
| 08-full-suite | 29048 | 600s | 0 | 340.331s |
| 09-direct-replay | 37453 | 600s | 1 | 61.789s |
| 10-direct-postcheck | synchronous/no yielded session | 120s | 0 | 0.115s |
| 11-covered-replay | 7290 | 600s | 0 | 119.941s |
| 12-final-audit | 65225 | 120s | 0 | 4.943s |

- For 01/02, recorded time is the Node TAP duration, not an independently captured wrapper wall time; all later times are runner monotonic wall time.
- Initial setup used doubled `work/` paths and failed before tests; accidental empty directories were removed. `00-setup-path-error.txt` is a clearly labelled transcription, not a new execution.
- **01-red is unaccepted:** file-level failure only, source edits occurred while its process was pending (mixed head), no usable assertion transcript and cause not established. Log/source-test snapshot retained; never used as frozen-head proof.
- **02-red is actual assertion RED:** exact base copies of main/campaign/ruin/warfield were restored before launch; scalar assertions fail on zone suppression, material ownership and 4→1 buckets. Implementation restored only after terminal. The four base-file SHA identities were recorded **after**, not before, launch (`02-red-base-identities.json`); do not misrepresent this timing limitation. No import/stub RED and no repeat of terminated jobs.
- 03-focused: 8/13 pass; five test-fixture failures (incomplete fake turret rig, wrong selection phase/vehicle expectation, rejection arriving during boot, missing English fake scan roots). Fixed only new fixture boundaries, then 04-focused 13/13 pass. Every failure log retained.
- 05-regression: **49/49** existing focused ruined runtime/entry, scanned entry, occlusion, tiny viewport and sweep acceleration tests plus new scope contract. 07-final-focused: **14/14** new tests after pinned hashes/all-five choice check, plus successful actual geometry audit. New tests and all raw/logs remain in place.
- 06 projection generator reported 24 records but had repeated covered indices (only one saved covered checkpoint); preserved as nonfinal in `pre-final-06/`. Final generator uses unique indices; 07 retains **16 distinct** projections, not 24 observations.
- 09 direct replay body reached normal end after full evidence comparison/win, but the outer shell exited 1 because its post-check `cd` climbed one directory too far. **Replay was not repeated.** 10 ran only the missing post-check from the correct directory, exit 0; mirror/current/frozen source and accepted raw were exact. Original failure + recovery retained separately. 11 covered uses subshell-safe cwd and exits 0 including pre/post checks.
- `unused/unused-output-wrapper.mjs` + `.diff` preserve an authored but **never executed** output-path wrapper. It is not a passed test or active work script. Final replay implementation is the original byte-exact harness in the mirror.

### Focused commands

Cwd `work/` (complete exact shell/argument variants are retained in logs/terminal JSON):

```sh
node --test --test-concurrency=1 tests/battlefront-depot-presentation.test.mjs
node --test --test-concurrency=1 tests/battlefront-depot-{presentation,ground,terrain,entry,scope}.test.mjs
node --test --test-concurrency=1 tests/battlefront-depot-scope.test.mjs tests/ruined-depot-runtime-view.test.mjs tests/ruined-depot-entry.test.mjs tests/scanned-cover-entry.test.mjs tests/player-occlusion.test.mjs tests/v4-tiny-viewport.test.mjs tests/sweep-acceleration.test.mjs
node scripts/battlefront-bf2-audit.mjs
node scripts/battlefront-bf2-projections.mjs
```

### One complete final suite and reused real builds

```sh
# runner cap 600s, one invocation, final source frozen
node --test --test-concurrency=2 tests/*.test.mjs
```

Actual terminal (`08-full-suite.log`):

```text
ℹ tests 1100
ℹ pass 1079
ℹ fail 0
ℹ cancelled 0
ℹ skipped 21
ℹ todo 0
ℹ duration_ms 340188.573857
EXIT 0
SECONDS 340.3307834669977
CODE_DRIFT []
```

The **21 inherited skips were not changed**: 8 old crossfire full-input replays; 3 V3 full-input replays + its acceptance case; 3 V4 full-input replays + its acceptance case; 5 scorched full-input replays, gated by their existing `*_REPLAY_FULL` environment flags. Exact names: `full-suite-inherited-skips.txt` / `final-audit.json`. Their artifact/unit checks ran, but those old long replays were **not newly run**. BF1/new mission two complete routes were freshly replayed below.

The unchanged build script names are `node build.mjs` and `node build-english.mjs`. The final suite's adapted build contract invokes each exactly once and proves successful main-only accelerated closure. Those **terminal builds were reused, not rebuilt** on identical final sources:

| Final build | JavaScript bytes | SHA256 |
|---|---:|---|
| `work/dist/game.js` | 38,696,403 | `2c4c9290ca1c947ab0cdb0d0718c80f5ed10f1645ac0bd7acc81ff695be9b0f3` |
| `work/dist-en/game.js` | 38,682,351 | `071ba1e445a15d9597740b2612fb0d24da56b59eea6ecde60f48d0c76255647c` |

Build manifest/metafile/HTML/CSS/license hashes and embedded asset input identities are in `final-audit.json`. Both retain main specifier `./ruined-depot-world.js` → `src/ruined-depot-world-accelerated.js` → accelerated terrain/world/broadphase, while original non-ruin world routes remain. Archive and Strv remain excluded; EN bundle's no-Han check passed. Source/build nonmutation assertions passed. Both manifests explicitly retain `browserVerified:false` and `runtimeRequestsMeasured:false`.

## Exact original-harness final replays

`prepare-replay-mirror.py` copied all current source plus required asset JS/configs and the **unchanged original** `battlefront-replay.mjs` into `replay-mirror/`; read-only dependency symlink; copied accepted raw/input tapes. **120 mirrored inputs match final head byte-for-byte** before/after. Harness SHA256 `8ea10bd7bbbab432941829a7fb45b60ffd737324861af8f1c4b50e34714a87fb`. `mirror-input-identities.json` and pre/post checks bind this. No transformed harness, field/state patches, teleports, actor repair, new route search or overwritten BF1 output.

Cwd `replay-mirror/work/`:

```sh
node scripts/battlefront-replay.mjs direct --verify --verification-tag=bf2-final
node scripts/battlefront-replay.mjs covered --verify --verification-tag=bf2-final
```

| Route | Inputs | Final tick | Events | Full final-state hash | Generated compressed raw SHA256 |
|---|---:|---:|---:|---|---|
| direct | 8,323 | 8,322 | 58 | `05d9ca4b9182d7525a786cce63eff0d0f0e62337e1b164c70eba662a33c6c5fa` | `0d76b716b131103839fd8e9fcfb61de5aa74bc58cb44e6d0bbbdf1061dbc1361` |
| covered | 13,600 | 13,599 | 102 | `8d1c7ab8ba5a6d6b337c39e572eafe061f9169e4f88dd7643417693e38afe4cd` | `5a470daefbd47a83e045f772fe3bb4f3c568e1ab6bb0c4e2c66bdf21b810bb08` |

Direct: player 28HP, truck100HP, 6 shots; covered: player80HP, truck16HP, 9 shots; both won/arrived, correct selected branch, zero allied-to-allied damage events（不含敌方造成的支援/车队损伤）. Both runs bind the exact 31-file physical closure and resolved Sandfalcon spec SHA `402a75efdb0ab4fb53185393da64f6dd8d5948f5cdeb6c243a1e340c743588ef`. Original harness compares **entire JSON result**, including all source snapshots, runs, frames, checkpoints, events and final state. Final audit confirms the freshly generated gzip bytes also equal accepted BF1 raw.

Necessary results/helpers/checkpoints were copied into fixed **`replays/`** and source/destination SHA compared. Helpers are retained byte-exact, including original relative generated-evidence paths; `final-audit.json` maps those paths to fixed BF2 copies without rewriting helper fields. The temporary mirror is a work area, **not a required artifact to package**; future controller packaging should use fixed copies/identities, not copy the mirror/dependency symlink.

## Offline source-camera projections and limits

`projections/INDEX.json`: 16 unique SVG schematics + exact corresponding JSON state/tick/inputs/raw SHA and camera matrices. Four CSS-pixel viewports: **400×300, 844×390, 1280×720, 390×844**, DPR1 projection convention. Direct checkpoints: ticks506,2573,8322; covered saved checkpoint: tick13599. Exact ruin shell triangles/transforms are projected; actor dots are schematic, not full asset meshes. Camera uses production `cameraReady=false` reset formula at each saved physical state, not reconstructed smoothed render history.

These are **not screenshots** and do not prove texture decoding, material beauty, lighting, DOM/CSS layout, screenshot alignment, real touch, whole-cycle no-occlusion, camera smoothing schedule, FPS or device behavior. New zone/ring/view tests use synthetic presentation states only, not route acceptance. Existing isolated shell fixtures are labelled fixtures, never substituted for real route evidence.

## Remaining parent/Mac checklist

- Independently review this frozen source and evidence before any private Space packaging/upload.
- Open actual CN/EN private builds; featured/direct URL/refresh, default old missions and all five chassis choices, start/retry/load-failure recovery and stale navigation. Confirm decoded art ownership/visuals and no missing textures/proxies.
- At all four viewport sizes, assess actual mineral walls/earth, localized soft wear/flat spalls, readable route lanes; reject muddy/too-dark carpet, grid silhouettes, floating scars or pale test-arena look if present. Palette is still a bounded trial.
- Verify compact HUD/charge/status/convoy controls and existing 400×300 pause-primary fix in real DOM/touch; no floating route labels/zone boundaries over vehicles, active gold rings and convoy choice/order still functional.
- Drive/turn/reverse/aim/fire/hold/advance through actual maneuver cycles and both routes; inspect windows, occlusion restoration, near-truck contacts and pause/resume. CPU schematics and two Sandfalcon wins do not prove all-five complete routes or full-cycle no-occlusion.
- Preserve BF1 limits: reverse/near-truck collision issues are not claimed fixed; retreat evidence proves retreat then hold-cover against returning in-range enemy, **not** an instantaneous in-range LOS cut. No AI/firepower/physics/clock tuning or stutter/root-cause claim was made.

## Exact work-file inventory

All changed/new work files are below; evidence/orchestration/log/build identities are in the evidence index and `final-audit.json`. No other existing source/test was changed.

| File | Bytes | Final SHA256 |
|---|---:|---|
| `work/locales/en-missions.json` | 29,792 | `56bc120c55d4204505555b49b1d54d6d1f1089db5e63b76abbe8e925ddd202f4` |
| `work/src/campaign-view.js` | 9,304 | `1f17bcc7b24868201afb93ab15894ecf2b93686b4108e8cfe59d063cd3b6a042` |
| `work/src/crossfire-warfield-view.js` | 7,583 | `2b7e70b904646a8eb814c862a143d1ed155a492ce2671e324a77cc5fd6378a30` |
| `work/src/main.js` | 24,303 | `2f9e5103d6ff46f3ec162e54137b12f118a912417b5aeeb5108ff43a8af02e73` |
| `work/src/ruined-depot-view.js` | 2,655 | `1184c830911b03d0439fbbd5966f8f79c5c1bba9ca99ad1e2f6191f7bf0c593c` |
| `work/src/terrain-candidate/relief-view.js` | 12,647 | `c7d2a9a07c8fa26b951f8bd8ee2806e0a5f56d8d9b125a4327bbaa9608da7a53` |
| `work/tests/sweep-acceleration-entry.test.mjs` | 6,977 | `47894f1592518cb10d32423067bcd5f30006b83341bc3c42d77fc91e0311a57c` |
| `work/src/battlefront-depot-ground-view.js` (new) | 4,980 | `0184fd4b839f94c7573c05d7c663b0392384c7308721a823f61140e33dce38dc` |
| `work/tests/battlefront-depot-entry.test.mjs` (new) | 5,779 | `cede9ef9025e815eb56d369e9bb148ad93e4bbd272b270f51e04e4ce0bcc8f36` |
| `work/tests/battlefront-depot-ground.test.mjs` (new) | 5,340 | `c703ae210b7cd1ff870cc55474f4e45b9c0134fa6c258c4b4b2a4821274f9dd2` |
| `work/tests/battlefront-depot-presentation.test.mjs` (new) | 7,626 | `45044730fbececb97ad63238e9935c8b5f7023133889949000e37178d8c6033f` |
| `work/tests/battlefront-depot-scope.test.mjs` (new) | 984 | `87e481c2ca13778c9156989c229d338d0390492259442cc5618f797a7b55d0c0` |
| `work/tests/battlefront-depot-terrain.test.mjs` (new) | 3,838 | `fc728983e1d71a632cfa8a9473dc2ac979ccc4a7702fe79c7664c48a5ff7213d` |
| `work/scripts/battlefront-bf2-audit.mjs` (new) | 3,893 | `5afd1ba9a67c8c65f22eb9c7a2b7569bb29067c628be2e7ffd25fc4ea678c4b5` |
| `work/scripts/battlefront-bf2-projections.mjs` (new) | 4,111 | `b7d65f4e6ce8befb055aad5c5cc83c5f69d021c2eba06a38ca83bbda98932f55` |
