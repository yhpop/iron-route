# Weathered road — independent candidate

## Result and scope

This is an incremental continuation of the existing Iron Route tank game, based on `grounded_meadow_candidate/work`. It makes the ridge asphalt border less ruler-straight and adds restrained world-coordinate tonal/roughness weathering. It does not replace the previous candidate, add a new game, change collision/traction, or introduce a new asset dependency.

The only runtime source change is `src/terrain-candidate/relief-view.js` (SHA-256 `b6c3440e148c870d708b64d3c585f9a7b669c7f39bac22be55022e2c54d51e8d`). The saved grass package, living-world implementation, all original assets, licenses, simulation, heights, route definitions, 20-level campaign and original acceptance evidence remain unchanged.

## Research and selection

The existing map uses original deterministic 512² PBR textures, with sRGB albedo, tangent-space normals and packed ORM; physical UV repeats every 4 m. Sources are `assets/terrain/material-manifest.json`, `assets/terrain/README.md` and `scripts/terrain/bake_materials.py`. The older flat industrial terrain README describes a different adapter; this ridge candidate uses the authoritative shared heightfield, not a flat Y=0 drive plane.

The old asphalt edge noise was only 4.5 cm, smaller than one 1024² mask texel over this 80×84 m field (about 8 cm). Replacing texture resolution alone would not correct that border or identical 4 m repeats.

Reviewed reusable resources:

- Existing vendored [THREE.Terrain](https://github.com/IceCreamYou/THREE.Terrain) noise is MIT licensed; its bundled Isaac Sukin copyright and license are retained. This candidate reuses that noise rather than importing another terrain library or upgrading the vendor.
- [Poly Haven Worn Asphalt](https://polyhaven.com/a/worn_asphalt), by Amal Kumar, is a possible later photographic PBR replacement. Its page specifies CC0 and a 2 m physical size. [Poly Haven's license](https://polyhaven.com/license) covers assets, not all site/preview content. **No Poly Haven texture or preview was downloaded or included in this candidate.** A later adoption should re-bake physical scale and test normal/roughness response, not silently swap a 2 m scan into the current 4 m UV convention.
- [Three DataTexture documentation](https://threejs.org/docs/pages/DataTexture.html) confirms mipmap generation is disabled by default. The mask now explicitly enables minification mipmaps; no texture color-space change is needed for numeric mask data.

Chosen improvement: use existing licensed noise and embedded PBR maps to fix the world-scale border/material structure first. No added network request, material sampler or texture asset.

## Implementation

- Coherent low/mid-frequency inward shoulder erosion plus restrained fine detail, with a local 24 cm blend. Deep asphalt stays fully paved and outer ground remains ground; wear is painted appearance, not newly drivable geometry or a raised curb.
- A deterministic world-coordinate asphalt weather signal varies over metres and follows road shoulders/wheel use. It modulates asphalt albedo by 0.88–1.12 and roughness by 0.92–1.0. It does **not** eliminate the original crack/grain tile or create pothole geometry.
- The existing RGBA mask's A channel carries weather on asphalt and existing wheel-track intensity on earth. Of 956,894 base-level pixels with quantized asphalt R=0 both before/after, all but one are byte-identical; one junction pixel's earth G channel changes by one byte level due to sub-byte asphalt coverage. At asphalt/earth crossings and distant mip levels the two semantics can mix, so additional dark borders remain a specific runtime observation item.
- Mask mipmapping is explicit. Terrain still has one mesh/draw and seven owned textures. Mask allocation estimate rises from 4 MiB to approximately 5.33 MiB (4,194,304 → 5,592,404 bytes for a full RGBA8 chain); GPU driver allocation and FPS were not measured.

## Verification and evidence

- Main Node suite: **715 passed, 0 failed**. Four new tests cover resolvable edge variation, bounded/non-periodic weather, actual mask/shader integration, unchanged field data and texture lifecycle. Test-first evidence records three failures before implementation.
- Chinese and dedicated English bundles build successfully. These builds do not demonstrate actual GPU shader compilation.
- The existing direct/covered exact-control tapes were independently replayed: both won and exactly matched their retained final state hashes. Direct: 8,206 ticks, player HP 100/truck HP 86; covered: 10,842 ticks, both HP 100. No teleport/state-injection inputs are used.
- Source preservation audit checks the grass candidate and all assets/licenses/accepted40 files. Historical strict acceptance remains the prior **38/41** result (all 40 original runs won, but source binding/impact metadata differ); old evidence was not rewritten to manufacture a pass.
- Actual production-mask capture and CPU albedo evaluation show the sampled east edge half-blend x-span increasing from **7.30 cm to 24.95 cm**. This is a boundary measurement, not a subjective quality score. Baseline-to-baseline image self-check has zero changed pixels.
- `visual-evidence/` contains equal-view offline albedo comparisons and source-bound raw captures. Images were visually inspected: the edge is visibly less regular; tonal change is subtle; repeated source crack/grain still appears. This is not a full PBR render, browser screenshot, camera-motion test or performance evidence.

## Pending Mac checks — not requested by this package

The preceding candidate is already being tested. Do not duplicate or supersede that request. Once its outcome is known, this separate candidate can be considered for: same-camera road close/medium view; distant edge/mask shimmer while moving; asphalt–earth junction dark seams; visual driving/contact agreement; pause/resume; one complete escort run. No Tabbit automation; use only the previously authorized browser tooling.

## Rights

All current licenses and attributions are preserved. Original player-tank commercial/re-distribution rights remain independently unverified, as disclosed by `assets/PROVENANCE.md`. This private test package is not a declaration that the full game is cleared for public commercial distribution.
