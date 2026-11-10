# Round 2: weathered concrete environment source audit

Date: 2026-10-31. Scope: isolated source audit only; no V3/V4 changes, no game integration, no Mac/browser automation, no installations/accounts/purchases. Baseline asset screening read from `crossfire_maneuver_v4_candidate/docs/ASSET_SCREENING.md`.

## Decision
**Shortlist original mesh only: Poly Haven Concrete Road Barrier 02, Amal Kumar.** This is a real PBR, chipped/weathered concrete prop suitable for a checkpoint or industrial perimeter. It is **not** a ruined building, fractured-wall kit, or general rubble solution. Prefer one meaningful audited prop over unrelated crate count padding. Neutral rendering completed; visual audit and later LOD comparison status are below.

- Primary asset: https://polyhaven.com/a/concrete_road_barrier_02
- License: https://polyhaven.com/license — CC0; commercial use, modification and redistribution allowed, attribution appreciated rather than mandatory. Source page identifies Amal Kumar. Retained primary fetch evidence: `sources/exa-primary-pages.json` (contains license + asset text).
- Official file metadata: https://api.polyhaven.com/files/concrete_road_barrier_02 ; retained text in `sources/exa-barrier-api.json` (response truncated late, but complete chosen glTF block present).
- Actual original glTF, binary and three JPG maps downloaded from the official `https://dl.polyhaven.org/file/ph-assets/Models/` paths listed in `sources/downloads.json`. Total **2,928,100 bytes**, no 4K/8K download. Five actual MD5 hashes match the official manifest exactly (`evidence/source-integrity.json`); individual SHA256 values and sizes retained in `sources/downloads.json`.

## Actual mesh/material inspection
Blender imported original glTF with `--disable-autoexec`, no source scripts run. Evidence: `evidence/mesh-audit.json`, original glTF JSON and binary.

- 1 node, 1 mesh, 1 primitive/material, **23,822 triangles**, 12,499 split vertices; portable glTF 2.0, no animation/skeleton.
- glTF Y-up bounds: X [-0.77617699, 0.78923237], Y [-0.00279442, 1.10915852], Z [-0.25404897, 0.18809301]. Extents **1.565409 × 1.111953 × 0.442142 m** (width/height/depth). Blender converts these to Z-up automatically.
- Identity node transform; origin approximately base center, base 2.8 mm below zero. No giant scene offset or hidden scaling; actual depth center is -0.033 m. Fit to terrain from min Y, not nominal origin.
- 3 actual **1024 × 1024** maps: base color sRGB, OpenGL normal non-color, packed ARM non-color. One double-sided, non-metallic material (metallicFactor=0). The source glTF wires packed map as metallicRoughness but **does not wire an occlusionTexture**; red-channel AO would need explicitly added if desired. No emissive/transparent shader gimmicks.
- Map visual inspection: actual scanned cement discoloration, pores, chipped edges and rusty exposed anchors; the atlas has dilated UV gutters (not intended to tile). `evidence/material-contact.png` viewed. Do not reuse it as a generic tiled wall material.

## Runtime budget / bounded conversion
- Original 23.8k triangles per instance is acceptable only for a few near hero barriers, not blanket battlefield scatter. 20 instances would be ~476k triangles before tanks/terrain.
- Actual Blender Decimate geometry feasibility probe produced **5,999** and **1,999** triangles (`evidence/lod-probe.json`). Dimensions remained within ~2.2 mm. This proves bounded geometry reduction, **not** that texture seams/normals remain visually clean; at this initial probe they were not saved; later saved/rendered audit variants were rejected as documented below.
- Superseded preliminary LOD suggestion: actual later renders reject direct-decimated 6k and 2k (see final judgement). Use original sparsely, shared geometry/maps, conservative simple box or 2-box collision; no render-mesh physics.
- 3 maps at 1K ≈12 MiB RGBA GPU residency, ≈16 MiB with mipmaps; maps should be shared, not cloned for each barrier. Original download <2.8 MiB. Avoid displacement/subdivision in runtime. Compression can be evaluated later without installing tools now.
- Keep correct sRGB/linear color spaces and normal convention, use neutral/bright enough light. This prop alone cannot fix the user's dark flat terrain complaint.

## Other sources screened, not admitted
- Poly Haven rubble, concrete debris, broken brick wall and cracked concrete wall search results were **textures**, not ruin meshes. They should not be represented as downloaded 3D ruins. Separate material audit belongs to parent/team.
- Zero Energy Games City: Rubble https://zeroenergygames.com/assets/city-rubble/ lists 24 free models from 40, CC0 glTF/PNG, 8 m lot grid, using Quaternius city sheets. Direct page download denied HTTP 403. Official searchable text retained in `exa-primary-pages.json`; no binaries acquired or visual approval. The stylized city-sheet direction is not a strong match for the user's realism complaint, so not pursued.
- Blendkit rubble scan search surfaced 150k–700k polygon, 8K assets and app-mediated downloads; not downloaded, no account or addon attempted.
- Sketchfab concrete rubble search surfaced an explicitly NoAI asset and 500k triangles/8K; excluded without download. No license circumvention.
- No retries of previously blocked 3DAssets/MetaWorldOS/Retgun/Quaternius/Google Drive sources.

## Exact blockers and recovery
- **Denied:** direct urllib GET `https://api.polyhaven.com/assets?t=models`, `https://polyhaven.com/license`, `https://polyhaven.com/models`, `https://zeroenergygames.com/assets/city-rubble/`, `https://polyhaven.com/a/concrete_road_barrier_02`, `https://api.polyhaven.com/files/concrete_road_barrier_02` each returned HTTP 403. No direct retry or access-control bypass. Normal Exa public-page retrieval supplied primary license/manifest evidence; the distinct official downloadable asset URLs were then fetched successfully.
- **Completed:** all five official selected glTF bundle files downloaded and integrity verified. No denied file-download operation retried.
- **Recovered local renderer limitation:** first Cycles render failed because installed Blender lacks OpenImageDenoise. Original failure log retained as `evidence/render-denoise-unavailable.log`; script changed to denoising disabled with 48 CPU samples. No install/escalation.
- **Completed:** original neutral-view rendering reached Blender exit 0; four calibrated views and material atlas were viewed. No WebGL frame, browser FPS, Mac appearance or integrated acceptance is claimed by this offline audit.

## Additional binary validation and render calibration
`evidence/binary-validation.json` independently unpacks all source binary positions/indices: 12,499 positions, 71,466 indices, max index 12,498, zero out-of-range indices, zero repeated-index triangles. Actual binary bounds exactly match declared glTF bounds.

First complete 4-view 48-sample render set (`front/rear/side/detail.png`) imported the actual source and real maps successfully, but the Standard/high-contrast light rig clipped light concrete at exposure 0. These images are retained only as calibration evidence, **not** the preferred neutral judgement. A second actual rerender uses exposure -1.3 with the same geometry, maps, lights and camera; no image-generation or post-painted geometry. Preferred files use `-neutral.png` suffix. Renderer noise is present because installed Blender lacks denoising.


## Original source visual judgement (completed)
Viewed `evidence/neutral-contact.png` and source-map contact sheet. Front, rear and side show actual chipped silhouette, grained/damaged concrete, surface staining and rusty lifting loops; source UVs/materials import without obvious seams or missing maps. Detail confirms geometric edge irregularity and normal-map relief. **1K maps visibly soften at extreme 0.65 m-frame steel closeups** (`lod-original-rebar.png`), so qualify at tank-camera/medium distance, not unlimited first-person macro use. No claim that the asset represents fresh battle damage: it is weathered/chipped concrete.

Parent requested actual visual LOD comparison after first audit. Original 23,822 / 5,999 / 1,999 triangle GLBs saved in `lod-candidates/`, with SHA256/material/image/triangle verification in `evidence/lod-file-verification.json`. Same-light/camera front-angle and steel-damage closeup comparisons finished successfully (Blender exit 0); all six images were viewed. Final judgement below.


## FINAL: actual LOD visual decision
**Use the original 23,822-triangle mesh only for current separate integration evaluation (2–4 instances: 47,644–95,288 triangles). Reject both direct-decimated variants.** This is a quality-first resource decision, not a runtime/Mac approval.

Evidence: `evidence/lod-comparison.png`, individual `lod-{original,6k,2k}-{angle,rebar}.png`; all rendered from the actual source/derived mesh, identical 48-sample CPU Cycles light rig, exposure -1.3, source 1K maps and same cameras. Six renders completed, terminal log `render-lods.log` ends Blender quit; process exit 0. GLB audit copies and verification retained; failed variants clearly marked, not mixed with approved source.

| Variant | Front angled view | Broken concrete / steel closeup | Decision |
|---|---|---|---|
| Original 23,822 | Irregular chipped outline, lifting loops and staining intact | No new split-boundary cracks. 1K base/normal soft at macro scale; material detail acceptable at medium tank-camera framing | Shortlist sparse near/medium checkpoint accent; do not call macro hero-quality |
| Direct decimate 5,999 | Superficially very similar at whole-object size | New black slits/triangular cracks down left edge and along bottom face boundary, absent from original; source-map detail remains but geometry join fails | **Reject** current 6k conversion for near use, not approved for shipping |
| Direct decimate 1,999 | Coarser left/right outline, flatter sliced bevels and lifting loops; dark edge becomes apparent | Much larger black boundary cracks at left and bottom, local flattening around damage | **Reject** current 2k conversion, including as assumed-ready far LOD |

The defect likely results from independently collapsed split vertices along imported mesh boundaries; this is a diagnosis hypothesis, not a proved topology repair. Dimensions staying similar did **not** establish visual quality. No normal-map rebake, UV repairs or welding are silently applied. A weld-by-position/re-decimate experiment can be a separate future audit if needed, with UV/loop normal preservation and same-camera checks; it is not needed to preserve the safe original baseline now.

Current scope is complete: one source downloaded/integrity checked, actual mesh/maps measured, neutral/contact/detail images rendered and viewed, direct LOD variants saved/tested/rejected, rights and exact blockers preserved. No integration, WebGL/browser perf or Mac acceptance claim. Parent may evaluate the original only in a separate version.
