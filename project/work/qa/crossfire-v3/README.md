# V3 fifth-chassis convoy simulation acceptance

These artifacts exercise production `mission-9051` / `createCrossfireV3Front()` with the measured `sandfalcon` configuration from `player-vehicles-v3.js`. They are **offline fixed-step production-simulation evidence**, not browser, WebGL, Mac, visual, or human-play acceptance.

## Record and independent verification

`node scripts/record-crossfire-v3.mjs <direct|covered> sandfalcon <attempt>` uses only `stepGame` controls. No teleport, direct entity/HP edit, collision bypass, damage suppression, or production-source alteration is used by the route pilot. The gzip tape includes the exact selected MissionSpec, run-length encoded controls, exact simulation dependency-closure source hashes and source text, and every retained final state value plus its SHA-256.

Run independent replays in a separate Node process:

```sh
CROSSFIRE_V3_REPLAY_FULL=1 node --test tests/crossfire-v3-replay.test.mjs
```

The independent test re-creates the world and mission from production modules (not the tape's expected final state), feeds only the saved controls, checks every final retained state value and SHA-256, and records reciprocal actual shot/damage events and absence of same-team damage. `CROSSFIRE_V3_TAPE=<exact filename>` filters tapes; the full acceptance manifest still requires both successful route tapes, so do not use the filter for the final full acceptance pass.

Normal unit runs check tape/control/source/config binding and behavior fixtures but skip long full-route replays. Friendly-collision and defeat fixtures are explicitly labeled: the former seeds one projectile to isolate real terrain-world friendly collision; the latter removes support in a copied MissionSpec to make unchanged hostile fire promptly lethal. Neither fixture is represented as a player input tape or production-route win.

## Preserved failures

- `rejected/initial-spawn-contact/`: first V3 placement support(-1,20), flanker(-9,12) overlapped the fifth vehicle's initial barrel/muzzle. Both route attempts stopped at tick244 without movement. Exact rejected source closure and input tapes are preserved and independently replayed by `node qa/crossfire-v3/replay-rejected.mjs`; neither is accepted as a win. `initial-contact-diagnosis.json` additionally records real reverse/pivot/raise/side-aim attempts, all unable to escape that initial overlap.
- `sandfalcon-covered-locked-westlane-straight-clear-spawnclear-*`: new clear-spawn placement support(-4,18), flanker(-10,9), but the old straight initial route physically hit the support body at(-2.949,21.884). This is preserved as an honest pilot failure, not silently replaced with a win. The revised pilot's `southentry` uses a real southern detour through(-10,25),(-10,21), with no collider removal.
- Original V2 narrow-breach and recovery evidence remains untouched in `../crossfire-front/`. Covered clearing uses actual shots against ridge-fence-2/3/4 before advancing the convoy. No claim is made that the unchanged narrow route works.

Final run outcomes and hashes are written to `acceptance-summary.json` only after the independent replay completes.

## Verified result — 2026-10-30

Unfiltered `CROSSFIRE_V3_REPLAY_FULL=1 node --test tests/crossfire-v3-replay.test.mjs`: **10 passed, 0 failed, 0 skipped**, 268.3 seconds, separate process from the recorder. Summary generator then independently checked all file/spec/source/state/report bindings and the complete replay log.

| Route | Inputs | Final tick | Player HP | Convoy HP | Outcome |
|---|---:|---:|---:|---:|---|
| Direct | 8,141 | 8,140 | 100 | 74 | Won, convoy arrived |
| Covered, south entry + real fence clearing | 13,356 | 13,355 | 92 | 100 | Won, convoy arrived |

Both routes recorded actual opposing ally/enemy shots **and damage** and no same-team damage. The direct route genuinely lost the optional support vehicle and took 26 convoy damage; the covered route genuinely took 8 player damage. No damage was suppressed. Three failed attempts remain preserved and exactly independently reproduced. See `acceptance-summary.json` for full hashes, mutual-fire counts, damage ledger, fixture boundaries and artifact paths.
