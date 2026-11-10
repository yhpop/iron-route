# Scorched Front: real-input vehicle acceptance

The recorder starts from `createGame(withPlayerVehicle(createScorchedFront().spec, id))`, creates the production terrain combat world, and supplies only normal controls to `stepGame`. It does not mutate tank pose, hit points, enemies, colliders, objectives or combat state. Turret alignment uses the selected `playerRig(spec)`, not the old default. Camera/renderer/main asset loading is not exercised here.

## Record
```
node scripts/record-scorched-front.mjs direct vanguard initial
node scripts/record-scorched-front.mjs direct pz3 initial
node scripts/record-scorched-front.mjs direct newc-leichttraktor initial
node scripts/record-scorched-front.mjs direct newc-tiger initial
node scripts/record-scorched-front.mjs covered vanguard maneuver
```
Use a fresh final argument to retain a different attempt. Only this new QA directory is written; never run the historical vertical-slice recorder to generate these outputs.

Tapes contain compressed `{n,input}` runs, fixed dt, full embedded spec, spec SHA256, player vehicle id/version, full final-state SHA256 and final phase. Reports retain events, physical checkpoints, HP and any pilot failure. Only terminal `won` counts as successful completion. Closed-loop pilot budgets are not proofs that a level is impossible.

## Independent replay
```
SCORCHED_REPLAY_FULL=1 node --test tests/scorched-replay.test.mjs
```
Optional `SCORCHED_TAPE=<filename>-inputs.json.gz` selects one. This independently reconstructs the current production spec/world and replays the saved inputs with **no pilot**. It asserts exact spec and complete final-state hashes and terminal won. Each result is saved as `*-independent.json`; run logs include explicit start/end timestamps. Ordinary unit tests check config/control integrity and skip these long replays.

The covered maneuver is part of its authentic input tape: hold convoy, drive to near the live truck, pivot, reverse away, then proceed around the covered route. Its report gives before/after poses and distances. These are collision-authoritative simulation results, not a browser screenshot, GPU benchmark or a claim of model/render/UI acceptance.
