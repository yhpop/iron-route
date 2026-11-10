# Render-only combat FX replacement

## What changed

`src/combat-fx.js` owns a separate `combat-fx` render root. `campaign-view.js` only creates it, forwards borrowed state/events/delta, and disposes it. It also changes the enemy charge warning from a solid red line to a named **dashed amber** line, still driven solely by `charge` and the locked `telegraphTarget`. Static world geometry, objectives, damage, projectile simulation and timings are unchanged.

- A brass shell body and hot nose occupy the **exact** `projectile.position`; its long axis follows `velocity`, or valid `position - previousPosition` when velocity is absent. A translucent hot tail is only 0.5 m long, behind the body. There is no muzzle-to-hit beam and no trajectory extension/interpolation.
- Firing gives two irregular crossed flame cards lasting 52 ms, plus restrained rising grey smoke. The flame never expands into an explosion shape.
- Metal/shield: short outward sparks, a little smoke and two small dark fragments. Masonry: pale directional dust and chunky grey-tan fragments. Reported ground contact: low brown dust. Fragments use cosmetic gravity and stop on the flat visual floor; they cannot damage anything or generate collision events.
- Scorch is a static irregular alpha decal, lasts six seconds and is limited to reported contacts on known static geometry/ground. A destroyed barrier retires its scorch; moving vehicles do not leave floating marks.
- Destroyed/barrier-opened events share one bounded breakup cue per entity in a render batch. Their positions are entity origins, **not impact points**. There is no duplicate polygon flash or extra gameplay hit.

## Actual data and limits

`shot` events have `projectileId`, owner and muzzle position. Current projectiles have ID, owner, velocity, current and previous position. `impact` events currently have owner, target, point and shield/hit value, **but omit projectile ID and collision normal**.

`combat-fx-frame.js` derives a surface orientation from the reported point and the target's known oriented box/cylinder. This is a nearest-face reconstruction, not an assertion that the omitted collision normal was measured; moving-target poses may already have advanced within the render batch. Incoming direction is used only when one cached forward trajectory can be distinguished. A shell born and destroyed before any render may orient its muzzle flame from an unambiguous same-batch shot/impact pair. Missing/ambiguous data gets a compact non-direction-claiming cue, never a guessed aim or an invented hit.

**Production currently removes below-ground projectiles silently.** This adapter does not invent a ground impact when a projectile disappears. The distinct ground response is available to a real reported event; the inspector's ground example is explicitly synthetic. No source change was made to combat.js, world raycasts, damage, reloads or charge times to make FX easier.

## Hard budgets and lifecycle

| Pool | Desktop | Mobile/coarse pointer |
|---|---:|---:|
| Visible shell cores | 24 | 12 |
| Smoke points | 60 | 28 |
| Short sparks | 48 | 20 |
| Gravity fragments | 32 | 16 |
| Flame cards | 12 | 6 |
| Static scorch | 12 | 6 |

Eight draw batches total: three instanced shell layers, flame, sparks, fragments, scorch and one smoke point cloud. Unused batches are hidden. No per-event GPU geometry/material/texture allocation. Overflow recycles old cosmetic particles; shell presentation is capped, without deleting simulation projectiles. Three locally authored 64×64 RGBA masks occupy 48 KiB before GPU overhead. No lights, bloom, camera shake, custom shaders, downloaded images, decoder or external runtime request is added. Smoke uses the installed Three standard PointsMaterial's RGBA vertex-color alpha support.

Mobile is selected once at view construction by coarse-pointer media query; callers can override `createCampaignView(scene, spec, {mobile, reducedMotion})` or `createCombatFx`. Reduced motion is selected once from the OS preference: it retains true shells, removes hot tails/shell smoke/travelling sparks/fragments, uses a 35 ms compact static muzzle glow and stationary impact smoke that expires within 200 ms. No flashing/pulsing charge animation is added. Recreate the view to apply a changed preference; live preference-change listeners are not added.

Dispose is idempotent and releases instanced buffers, shared geometries/materials and all three textures once. Projectile disappearance alone only retires the core. Finite particle pools, 512 remembered event IDs and a bounded recent-trajectory cache avoid session growth. Duplicate events do not replay effects.

## 验证边界

测试夹具只验证 CPU 数据、轨迹与生命周期契约。实际 GPU 画面、音效、iPad/Safari、视觉效果与趣味性仍待验收。

```sh
node --test tests/combat-fx.test.mjs tests/combat-fx-integration.test.mjs
```
