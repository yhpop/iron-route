# Canal-industry terrain kit

**The `terrain-lookdev-*.png` images are Blender material/geometry inspections, NOT game-browser screenshots or gameplay verification.** `lookdev-geometry.json` contains the actual runtime-generated meshes used in those renders. `terrain-lookdev.blend` is the reproducible inspection scene.

## Integration

```js
import {createTerrainView} from './terrain-view.js';
const terrain = createTerrainView(scene, mission, {
  maxAnisotropy: renderer.capabilities.getMaxAnisotropy(),
});
// Remove the former campaign ground/road-box/surface-paint blocks.
// Do not change mission collision or simulation to match this view.
await terrain.ready; // {loaded, failed}; optional host capture/load boundary
terrain.diagnostics; // drawCalls, triangles, warnings, raisedFootprints
terrain.dispose();
```

Original PBR maps are embedded through `runtime-textures.js`: no file loader, decoder, CDN, texture-copy step, or external runtime texture requests. Each material has an sRGB WebP albedo, tangent-space PNG normal, and packed PNG ORM (R=AO, G=roughness, B=metalness). MeshStandardMaterial uses the G roughness channel. No displacement: the authoritative drive plane remains **Y=0**. UVs use U=X/4, V=-Z/4 (one repeat per 4 metres), including across junctions.

```js
sceneDressing: {
  ground: {material:'concrete'}, // asphalt | concrete | earth
  roads: [{id:'haul', points:[[-12,20],[-12,-8],[16,-8]],
    width:8, material:'asphalt', markings:true, curb:false}],
  drains:[{x:-8.6,z:2,width:.7,depth:1.1,yaw:0}], // flush
  // Optional, ONLY inside an existing box blocker (strict footprint test):
  curbs:[{id:'quay-cap',colliderId:'quay-solid',x:0,z:20,
    width:11.8,depth:.8,height:.16,yaw:0}],
  // Optional, physically enclosed, not a traversable fake river:
  water:[{id:'canal',polygon:[[...],[...],[...]],enclosedBy:['quay-solid', '...']}],
}
```

`spec.routes` is a compatibility fallback. `spec.surfaces` retain their declared polygon and receive concrete/earth aggregate materials (`class:'rubble'` -> earth). The adapter never mutates the mission. Road `curb` settings do not silently raise anything; they issue an authoring warning. Raised curb boxes require `colliderId`, fit entirely inside that existing collider's rotated footprint, and cannot exceed its height. Water requires declared enclosure IDs. Level authors remain responsible for proving those colliders really enclose the water. Landmarks/buildings belong to the art kit, not this module.

## What replaces the old patches

- Rounded, mitred road ribbons are split at every intersection and Boolean-unioned before triangulation; crossroads are one connected paved shape, not stacked rectangles.
- Paving types clip against higher-priority paving (asphalt > concrete > earth), preventing coplanar overlap.
- Courtyard loops retain holes instead of filling the whole block.
- Slab foundations, narrow concrete shoulders and dark bitumen edge joints give coherent road-to-yard transitions.
- Metre-scale vertex-colour wear follows the road's wheel lanes and dusty margins, not random floating patch decals.
- Flush drains, saw-cut slab joints and restrained faded ochre road markings support the district's industrial use.
- No added solid props or visual rocks outside collision authority.

## Explicit mobile budgets

| Item | Cap / shipped value |
|---|---|
| PBR source resolution | 512×512 |
| Physical repeat | 4 m (7.8 mm/texel) |
| PBR materials / map images | max 3 / max 9 |
| GPU map allocation incl. mipmaps | max 12 MiB RGBA8 estimate; typical asphalt+concrete 8 MiB |
| Anisotropy | max 4 (also bounded by device limit supplied by caller) |
| Terrain draws | 14 target ceiling (lookdev network 7) |
| Terrain geometry | 18,000 triangles ceiling (lookdev network 1,884) |
| Runtime downloads / external decoders | 0 / 0 |

These are **terrain-only** allocations. Diagnostics report actual per-mission counts; excess authoring produces a warning, not hidden LOD or a simulation change. Shadows are received, never cast by flat terrain. Texture failure produces a diagnostic warning. `loadTextures:false` provides a deterministic DOM-free geometry/testing path.

## Reproduction and provenance

All imagery is original deterministic procedural synthesis, authored by `scripts/terrain/bake_materials.py` (seed 27641). No web imagery, copied texture, third-party material, or external service was used. Aggregate/pore normals have millimetre-scale relief; slabs represent 4 m cast concrete. No installs are needed.

```sh
cd campaign # or use the root of the standalone campaign source package
python scripts/terrain/bake_materials.py
node scripts/terrain/export-lookdev.mjs
/usr/bin/blender -b --python scripts/terrain/render_lookdev.py
node --test tests/terrain-view.test.mjs
```

The system Blender build lacks OpenImageDenoise, so source renders use 48 Cycles samples without denoising. The overview and closeup have been visually inspected and the bright border was corrected to a dark joint; geometry-normal winding is regression-tested. These material previews do not substitute for a browser render or mobile gameplay test.
