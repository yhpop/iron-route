# Crafted 20 — authored content handoff

Exactly twenty explicit, immutable schema:1 records, four connected industrial
canal districts of five. No generated level family, randomized map, transformed
copy, or alternate old-campaign ID is exported.

```js
import {
  CAMPAIGN_ID,             // 'crafted20-v1'
  PROGRESS_NAMESPACE,      // 'iron-route:crafted20:v1'
  listCraftedMissions,     // frozen array, exactly 20
  getCraftedMission,       // 'crafted20-001' … 'crafted20-020'; unknown => undefined
  validateCraftedMission,
} from './content/crafted20/index.js';
```

The production `src/main.js` now imports this provider as its default campaign.
Its explicit progress namespace is passed to both loading and saving; the old
303 registry and its stored bytes remain untouched. The two optional historical
experiments are labeled separately and cannot unlock or save this campaign.

## Structure

- `south-wharf.js`: first three, implemented and production-clearance checked
  before the remaining seventeen.
- `south-wharf-advanced.js`: missions 04–05.
- `lockside.js`: missions 06–10.
- `rail-works.js`: missions 11–15.
- `north-harbor.js`: missions 16–20.
- `authoring.js`: constructors and explicit step-to-witness bookkeeping only;
  no algorithm chooses map dimensions, objects, routes, enemies or objectives.
- `validate.js`: new-ID adapter around the unmodified old validator plus
  alternative firing angles/routes and actual safe planning-position checks.

The exact progression and per-level decision differences live in
`docs/20关设计.md`. Each record also contains
its own `design` identity, sequence, alternative, learning beat and 1–3 minute
**target**, not a measured timing claim. `proposedMechanics: []` means every rule
used exists in the current runtime; no magic switches, generators, moving
bridges, ammo systems or enemy vehicle AI are assumed.

## Art contract

World units are metres; X/Z ground plane; yaw zero points toward -Z. The following
renderer-neutral metadata changes no gameplay state:

- `sceneDressing.ground.material`: concrete base.
- `roads`: explicit `points:[[x,z],...]`, `width`, asphalt material, `curb:false`.
  Crossings are connected road surfaces. A road may intentionally contain an
  explicitly destructible fence; do not auto-clear it.
- `landmarks`: `{geometryId,assetKey,role}`. Building shells use the corresponding
  collider pose/dimensions, not mesh-derived collision. Keys are
  `warehouse-sawtooth`, `pump-station`, `service-workshop`.
- `aprons` (only when authored): `{id,polygon:[[x,z],...],material}` flush paved service areas. These are rendering metadata, never traction surfaces or colliders.
- `markings` (only when authored): `{id,points:[[x,z],...],width}` flat paint polylines.
- A landmark may specify `yawOffset` to rotate its visual shell inside the same collision footprint.
- `drains`: sparse explicit flush `{x,z,width,depth,yaw}` plates, never raised.
- `props`: currently empty. Any future cosmetic prop must stay outside driving
  and firing envelopes and declare `collision:'none'`.
- `water`: `polygon:[[x,z],...]` and `enclosedBy:[geometryIds]`. Missions 06 and 16
  have continuous boundary-to-boundary retaining walls. Missions 10 and 17 have
  four closed physical walls. No tank/truck route traverses decorative water.
  Renderer water stays below the drive plane; it does not create collision.

Walls, quay edges and fences remain walls, not stretched building models.
Cargo-truck and sentry-turret art correspond to their existing entity kinds.

## Decisions that should survive integration

01 sheltered L-turn / stop then aim; 02 asphalt versus screened gravel flank;
03 clear, return for waiting truck, then escort; 04 bypass an optional gun;
05 choose which cargo court to clear first; 06 exposed quay versus inland cover;
07 optional breached shortcut versus intact detour; 08 **separate berth releases**
allow one-at-a-time delivery; 09 read a north-facing shield, not the old compass
habit; 10 choose which arc of a basin to use; 11 pre-align a diagonal shot;
12 enter a real dead end and escort back out; 13 separate two armored crossfire
arms; 14 leave the convoy safely waiting while scouting past a wall;
15 one optional fence opens a useful side-firing pocket; 16 inside versus outside
a C-shaped retaining wall; 17 shared release of two banks with end crossings;
18 independently solve hull turns and different armor facings; 19 prepare the
retreat with no surprise enemy spawn; 20 choose clearance order before releasing
the final delivery.

## What the evidence means

```sh
node --test tests/crafted20-content.test.mjs campaign/tests/crafted20-runtime.test.mjs
node --test tests/*.test.mjs
```

Checks use the **production** collision world's hull, attached barrel and turret
sweeps, including alternate approaches. Planar witnesses additionally verify
objective order, reachable firing endpoints, sightlines and armor arcs. Truck
probes run the real route/traffic code to actual destination arrival, including
separate parking bays and independent berth release.

The truck probe deliberately clears threats and repositions a tank alongside a
truck in a clear pose. Waypoint sweeps do not drive the actual acceleration or
input policy. Therefore these are **clearance, dependency and routing checks**,
not input-driven combat wins, human playtests or proof of pacing, balance, mobile
readability or enjoyment. Those remain `unverified` in every record. Actual browser/device acceptance remains separate from these tests.
