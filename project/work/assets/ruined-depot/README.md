# Reauthored ruined depot — closed local asset

LFA's three real ruin meshes, reauthored with Fleurman's acquired CC0 concrete
colour. Credit/license/change disclosure: `../../licenses/LFA_RUINED_DEPOT_CC_BY_3.md`.
The new material is a stylized industrial interpretation, not source-material
fidelity or a measured PBR scan.

- `workshop` ← polySurface1011: 291 triangles.
- `broken-corner` ← polySurface773: 308 triangles.
- `window-wall` ← polySurface806: 158 triangles.
- Total: 757 unchanged source triangles, 3 meshes, one shared standard material,
  three embedded 2048² PNG images. No external texture/buffer URI.
- Metres, applied .8 scale, X/Z footprint-centred and minimum Y=0 (float epsilon).
  Proper axis rotation: runtime `(x,y,z)=(Blender x,Blender z,-Blender y)`.
  Exact emitted bounds and per-source hashes are in `manifest.json`.
- Runtime `loadRuinedDepotArt(bytes,{loader})` validates before admitting;
  `.clone(moduleId)` borrows shared geometry/material/maps. The library alone
  owns and disposes those resources, once, at application shutdown. Dispose or
  detach an instance's Object3D only; never dispose its borrowed material/maps.

## Material and limits

An unchanged copy of `Ciment_brisé.png` is packaged as input. Blender box-projects
it at a deliberate 3.333 m tile, phase-shifted per module, then bakes a new atlas.
Low-frequency weather variation and uneven base grime are artist-authored;
original upward/sloped fracture facets receive darker, rougher aggregate. No
ambient occlusion, directional light or fake opening is baked into colour.
Fine normal and roughness are explicitly authored approximations. Source UV1
and UV2 remain unchanged in the packed authoring evidence; export uses the new
atlas. The shipping mesh contains only the new atlas UV channel0; material bindings
and decoded geometry coordinates are validated together.

Shared atlas coverage is about47%, with30° SmartUV projection, .012 UV island margin and16-pixel bake
dilation. Area-weighted density is about77.5 texels/metre; very thin original
fragments vary. This supports gameplay-distance surfaces, not macro photography.
The 3 RGBA8 maps cost48 MiB raw / about64 MiB with mipmaps; lossless PNG transfer
is intentionally not a mobile-performance claim. No new optimizer was installed
or downloaded. Repeated source motifs remain possible despite restrained
weather/phase variation; original topology is intentionally low-poly.

## Evidence and reproduction

From the candidate root, using installed Blender4.3.2, no network/install:

    blender --background --disable-autoexec originals/ruined-depot/evidence/lfa-recovered-two-uv-audit.blend --python evidence/ruined-depot/asset/author_ruins.py
    blender --background --disable-autoexec originals/ruined-depot/evidence/lfa-recovered-two-uv-audit.blend --python evidence/ruined-depot/asset/audit_geometry.py
    python evidence/ruined-depot/asset/write_manifest.py
    node --test work/tests/ruined-depot-art.test.mjs

`evidence/ruined-depot/asset` contains packed source-node and baked-UV authoring
scenes, actual fresh GLB reimport, material/UV/source checks, and matched baseline
vs revised gameplay-scale and closeup renders. `render_matched_proof.py` can
rerender the controlled comparison without rebaking. CPU tests parse the actual
binary with native GLTFLoader but inject clearly marked test-only Texture
placeholders because Node has no browser image decoder. Actual PNG decoding and
material appearance are separately verified by fresh Blender import/renders.
No browser/GPU/touch/performance acceptance is claimed. Collision apertures,
terrain grounding and world placements belong to Task2, not this library.
