# Water / industrial attachment integration

These are view-only adapters. Do not add collision shapes, change authored polygons, raise water, or mutate mission data. The shipping GLBs are unmodified.

## Terrain glue

```js
import {createWaterMaterial} from './water-material.js';
// After the existing isWaterEnclosed filtering, only if waters.length:
const waterView = waters.length ? createWaterMaterial(options) : null;
// Replace ONLY the old MeshStandardMaterial expression in the existing water loop:
const mesh = add(geometryFromContours([waterPolygons[i]], 8),
  waterView.material, 'enclosed-canal-water', -.065);
// Keep every other water line (enclosedBy, geometry, holes, UV, y) unchanged.
// View ready includes waterView.ready. View update(dt, options) forwards to it.
// View disposal calls waterView?.dispose() exactly once.
```

The water adapter owns its material/maps; do not additionally put those resources into the terrain-owned material/texture sets. Diagnostic totals should include water's `textureCount` (3) and `textureGpuMiB` (1) once, even if multiple basins share the adapter. No image loading is needed, including in `loadTextures:false` exports: the pixels are synchronous DataTextures. `ready` resolves `{loaded:3,failed:0}`. `update(dt,{reducedMotion})` only changes the normal-map UV offset; clamp is .1 seconds, finite positive dt only. Constructor `reducedMotion:true` is respected unless explicitly overridden per update.

The campaign render update should forward render delta, not infer a second wall clock. There are no custom vertex/fragment shaders and no positional motion. Transparent, transmission, emissive and displacement are not used.

## Authored scene glue

```js
import {createIndustrialDetails} from './industrial-details.js';
// Inside existing createAuthoredSceneView try/cleanup boundary:
const industrial = createIndustrialDetails(root, spec);
// In existing update(state,...):
industrial.update(state);
// Both failure cleanup and normal dispose:
industrial.dispose();
```

The adapter's root becomes a child of `root`, so ordinary production scene export sees its meshes. Do not attach it under scaled `solid:*` roots: it already applies authoritative world position/yaw/scale. Its `colliderId` metadata corresponds to `spec.geometry`. Quarter-turn pump facade yaw applies beneath nonuniform shell scale, exactly like the GLB. Its `ready` resolves immediately. Destruction visibility follows the authoritative state. If the authored adapter adds asynchronous readiness later, include `industrial.ready` there.

Resource footprint from all 20 authored scenes: maximum +19 material-batched draw calls and +4608 triangles (mission 10), up to 4 shared materials. Identical pump geometries are shared within a view. All allocations are per-view and all resources are disposed once. No new package/network dependency, no persistent global resource registry.

## Verified surface placement

Actual shipping `pump-station.glb` downward raycasts at local `(x,z)=(1.52,-2.63), (3.35,-2.63), (2.05,-1.83)` hit lower roof at `Y=2.80999994`. Assembly pipe/chamber tops are over .25m above that roof and below authoritative Y=4. The raised hall stops at X=1.10; no new equipment uses it. The existing vents remain untouched. Basin inspection panels/valve face are inside the collision prism but outside the recessed masonry face. Hazard coping is exactly coplanar with wall top and uses a tiny negative polygonOffset; it is not extra wall height.

## Offline lookdev

Material name `industrial-basin-water` uses `assets/terrain/water-basecolor.png` (sRGB), `water-normal.png` (linear normal, strength .8) and `water-roughness.png` (linear green × .47). Base factor white, metalness 0. Existing UVs are world metres / 8; repeat 1 and initial offset 0. PNG rows are flipped relative to raw DataTexture bytes so Blender UV orientation matches exactly, tested pixel-for-pixel. Only the runtime normal offset drifts `[.004,.0015]` UV/s; static offline output should use initial phase and disclose that animation is not rendered.

Regenerate exact PNGs with `node scripts/export-water-textures.mjs`; hashes and provenance live in `assets/terrain/water-manifest.json`. Label all Blender output **OFFLINE BLENDER LOOKDEV — NOT A GAME/BROWSER SCREENSHOT**. Automated tests establish bounds and resource contracts, not final visual quality or GPU behavior; integrated image inspection remains required.
