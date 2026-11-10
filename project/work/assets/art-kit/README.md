# Industrial canal art kit

Original authored Blender meshes and seeded PBR raster surfaces, made for the campaign art overhaul. No downloaded assets; no package installs. The existing user's tank is not modified or included in this kit. Its imported derivative is used only in one clearly labelled offline scale-reference render.

## Runtime files and stable names

| Asset key / GLB | Root | Nominal metre dimensions (X, height, Z) |
|---|---|---|
| `warehouse-sawtooth` | `WarehouseSawtooth` | 8 × 4 × 8 |
| `pump-station` | `PumpStation` | 8 × 4 × 8 |
| `service-workshop` | `ServiceWorkshop` | 8 × 4 × 8 |
| `cargo-truck` | `CargoTruck` | Inside 1.8 × 2.2 × 3.6 body |
| `sentry-turret` | `SentryTurret` | Inside radius 0.8 × height 2.2 |

All GLBs: +Y up, -Z forward, metre units, base-centre root pivot, PNG maps embedded, no Draco/Meshopt/KTX decoder. `manifest.json` is the measured binary contract (hashes, exact bounds, triangle/material/image/draw budgets). It is authoritative over rounded dimensions here.

### Buildings

Scale visual root by `(collider.width / 8, collider.height / 4, collider.depth / 8)` and position at the authored collider's base. All windows, lintels, canopy, pipes, gutters and trim are inset in the nominal footprint. No detail can project into an adjacent lane. Mesh shape is visual only; the existing authored box stays authoritative. Default design range: width/depth 5.2–14.4 m, height 2.8–5 m; sawtooth warehouse can stretch longitudinally to 16 m. Do not stretch narrow barriers into buildings.

These are three different constructed silhouettes, not three material swaps: paired sawtooth northlights, stepped concrete pump hall with service roof, gabled brick repair hall. Shared material family and datum course keep them coherent.

### Cargo vehicle

Body fits the existing `combat.js` / dynamic-world default 1.8 × 3.6 × 2.2 m; content's 2.2 × 4 m route envelope remains conservatively larger. Base-centre pivot, -Z forward. `WheelLFront`, `WheelLRear`, `WheelRFront`, `WheelRRear` are independent pivots; spin about local X using 0.36 m effective rolling radius. Truck includes formed/sloped cab, split glazing and wipers, radiator/lights, chassis/axles, steps, utility lockers, tread blocks, wheel hardware, wheel arches, framed sideboards and tied bowed canvas cargo cover.

### Sentry

`SentryTurret > TurretYaw > GunPitch > Recoil > Muzzle` is the articulation chain. GLB yaw uses +Y; positive elevation uses +X; recoil translates +Z (rearward), from 0 to 0.07 m. Declared pitch range -0.08 to +0.35 rad. Optional `Shield` is a separate sibling under the root and may be hidden without changing the physics proxy. Complete moving silhouette is checked against radius 0.8 for all yaw and motion endpoints; there is no cosmetic barrel overhang requiring a new collider. Nodes carry no nonuniform design scale.

## Reproduce and verify

Run these commands from the standalone `campaign/` directory (the folder containing `package.json`). All kit assets and scripts are now inside this directory; no historical parent assets are required.

```sh
python scripts/art-kit/generate_textures.py
blender -b --factory-startup --python scripts/art-kit/author_kit.py
python scripts/art-kit/validate_kit.py --write-manifest
blender -b --factory-startup --python scripts/art-kit/render_kit.py
python scripts/art-kit/validate_kit.py
node --test tests/art-kit-contract.test.mjs
```

The `.blend` source intentionally contains all five asset roots at the origin, isolated through root selection for export. The render script starts fresh and re-imports the actual shipping GLBs. Its staging ground, camera, lights and annotation are not runtime art or collision evidence. No screenshot is a browser capture or proves runtime performance.

## Performance / limitations

- Shared source materials, branch-consolidated indexed meshes, at most 512 px textures. No scene lighting baked into albedo.
- Native glTF loading only. glTF Transform was not installed; no external optimization package was added. No claim of compressed or mobile-benchmarked delivery.
- Three building modules are reusable architecture, not 20 unique buildings. Material scale may stretch with large nonuniform building transforms; use within recommended range.
- Existing collision volumes are deliberately simpler than roof/window surface geometry.


## 可编辑交付源

本包 `.blend` 是交付规范化副本：图片内嵌、路径相对化，不重导出 GLB。原 `.blend`、`.blend1` 和全部生成器原件仍留原工程。规范化清单见 `industrial-canal-kit-portable.json`。历史保存检查脚本依赖原工程，普通构建和可移植测试不需要它。
