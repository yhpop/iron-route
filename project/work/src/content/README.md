# Campaign content and evidence boundaries

`index.js` exports `getMission(id)`, `listMissions()` and `validateMission(spec)`.
Records and nested data are immutable. Unknown mission IDs return `undefined`.
Validation returns `{valid, errors, warnings, audit}` and never equates geometric
clearance with combat survivability or human acceptance.

## Authored records and generated records

- `mission-001` — freight breach, actual opening, actual freight delivery. The
  tutorial truck explicitly has `escortRange:100`; clearing the gate does not
  silently strand it behind an unintroduced proximity rule.
- `mission-002` — shield flank, rubble routing and a physical west-flank screen.
- `mission-003` — two actual trucks, separated threats and distinct parking bays.
- `mission-004` through `mission-303` — 30 compiled road-region graphs × 10
  objective DAGs. These are 300 generated structural variants, **not a claim of
  300 human-playtested, enjoyable or combat-proven levels**.

Runtime imports the baked `generated-records.js`. It does not execute authoring
pathfinding, mission generation or topology analysis. Regenerate after ANY source
change with:

    node campaign/src/content/build-records.mjs

The build refuses to write a replacement if any record fails the geometry/phase
checks, a graph is unrealized or the 300 combined signatures are not unique.
`generated-audit.json` preserves the machine-checkable counts and explicit gaps.

## What the structural evidence establishes

The route family is a chain of physically separated branching corridors and
roomy shared junctions. Block count (2–7) and one block's branch count (2–6) produce
30 different unlabelled graphs. Tarjan biconnected decomposition independently
recomputes these graphs from actual adjacency; recipe names and coordinates are
not accepted as evidence. This is exact canonicalization for this constrained
family, not a general graph-isomorphism claim. The family may still feel
repetitive; structural uniqueness does not establish good level design.

All declared road edges and junction links are swept against the same solid
geometry consumed by renderer/collision. Phase witnesses respect actual live
barriers, required dependency order, reachable firing poses, shot lines and
fixed shield arcs. Tank clearance uses a conservative 1.9×2.82 m hull, 3.15 m gun,
turn sweeps and skin. Convoy checks use a 2.2×4 m envelope, not point paths.

Objective signatures exactly canonicalize small typed dependency DAGs independent
of IDs and declaration order. No coordinate-only exception is used to establish
uniqueness. Protection variants use actual vehicle travel, not empty timer holds.
Choose-order variants alter convoy exposure and gate-release/ambush consequences.

## Evidence that remains separate

`content-convoy-runtime.test.mjs` uses actual world/route code to catch parked
truck and crossing-route deadlocks. It intentionally disables hostiles and places
the tank alongside trucks; it is a **routing-only check**, not a driving/combat
playthrough. The longer automated witness checks also do not establish health,
ammunition, response-time budgets, interesting choices, mobile camera legibility,
or human enjoyment. These remain explicit `unverified` audit fields.

The first three hand-authored maps are not included in the 30-family topology
canonicalization claim. Their signature says so explicitly. No tank-only-width
claim is made: the runtime truck hull is narrower than this tank.

Run:

    node --test campaign/tests/content*.mjs
    node --test campaign/tests/*.mjs
