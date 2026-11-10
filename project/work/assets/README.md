# Articulated original V5 tank

`tank_v5_articulated.glb` is a **separately named derivative** of the preserved V5 Blender source. No original file is overwritten. It contains the original 49,748 triangles and both original embedded 1024px PNG atlases. Provenance is reconstructed production V5; this work adds no ownership or license claim.

## Runtime contract

```js
import { loadTank } from '../src/tank-view.js';
import tankBytes from './tank_v5_articulated.glb'; // e.g. esbuild binary loader
const view = await loadTank(scene, { data: tankBytes });
view.update(nestedTankState, dt);
view.dispose();
```

The optional `data` accepts ArrayBuffer or any typed-array slice and avoids a URL fetch, including offline bundles. Without it, `loadTank` resolves `../assets/tank_v5_articulated.glb` relative to its module. A bundled application can instead pass an explicit `url` matching its copied asset location. No Draco/Meshopt decoder or external texture file is needed.

`tank-rig.js` provides importable measured raw and game-space metadata (`TANK_ASSET`) and the exact original path constants. Root scale is 0.455, +Y is up, and yaw zero faces -Z. The chain is hull → turret yaw → mantlet-centered X elevation → positive-Z recoil. The mantlet remains on the elevation hinge while only the tube recoils. Runtime has no sine bob and never spins the fixed chassis.

The adapter replaces the export's neutral running-gear nodes with **two instanced complete-link material batches** (112 links total), six wheel material batches (12 complete tire/hub/cap/bolt sets) and one end-guide batch (four guides). The original static links/wheels are removed, not left under duplicates. Every phase and wheel angle derives exclusively from signed **accepted** `trackL` / `trackR` metres; `dt`, throttle, input intent and render-frame count do not advance the tracks.

## Re-export from the original source (optional)

Run from the branch root (the preserved source and QA hash list are two directories above):

```sh
blender -b --disable-autoexec ../../source_v5/project/Tank_City_V5_Production.blend \
  --python campaign/scripts/export_asset_articulated.py
python campaign/scripts/check_asset_geometry.py
node --test campaign/tests/asset-structure.test.mjs campaign/tests/tank-view.test.mjs
blender -b --factory-startup --python campaign/scripts/render_asset_inspection.py
```

The exporter preserves the original armor unwrap object set/order and only changes final source-aware grouping. The independent binary checker compares indexed neutral triangle corners, material assignment, original paint UVs, embedded PNG hashes, and canonical instanced track/wheel/guide geometry. `geometry-validation.json` is tied to the exact derivative SHA-256. Original seven hashes are checked before and after export and by the repository-only campaign/qa/original-preservation.test.mjs. Portable tests validate the derivative without requiring the original source archive.

The source does not need to be opened/saved interactively. No new asset, dependency or network download is used. The standalone checker uses already-installed NumPy.

## Evidence limits

`inspection-neutral.png` and `inspection-articulated.png` are **offline Blender asset inspection**, clearly labeled within each image. They are not browser screenshots, gameplay validation, performance evidence, phone/Safari tests or evidence of physical suspension/traction. Runtime tests parse the actual derivative geometry in Node (texture references omitted only for that CPU test because Node has no image decoder); texture bytes and UVs are independently checked from the unmodified GLB. The rendered muzzle is cross-checked against the collision/fire transform across 72 joint/pose combinations.

The standalone game package includes the self-contained articulated GLB and runtime metadata. It does not include the original 36 MB Blender production file or historical rescue assets; those remain preserved in the original project. Rebuilding the game does not need Blender or those originals.
