# Crossfire Front: input-level acceptance

Mission-9050 uses the original Scorched Front terrain, geometry, routes and escort objectives, with explicit team relations and two stationary western vehicles. Allied support is not protected and is not a victory requirement. New player selections remain serialized in spec.playerVehicle.

## Final recordings

```
node scripts/record-crossfire-front.mjs direct vanguard locked
node scripts/record-crossfire-front.mjs direct pz3 locked
node scripts/record-crossfire-front.mjs direct newc-leichttraktor locked
node scripts/record-crossfire-front.mjs direct newc-tiger locked
node scripts/record-crossfire-front.mjs covered vanguard locked-westlane
CROSSFIRE_REPLAY_FULL=1 node --test tests/crossfire-replay.test.mjs
```

Use a new attempt name for exploratory recordings; the obsolete `initial` name is deliberately rejected. The recorder supplies only normal controls through createGame/stepGame and the actual terrain/world. No pose, HP, target, collider or gameplay parameter repairs. It records resolved full spec, source SHA fingerprints, control runs, full terminal hash, and events. Independent replay checks current runtime bindings, exact full hashes and reciprocal support/flanker shot **and damage** histories.

## Preserved failed/superseded attempts

`*-initial-*` files/logs predate the finalized charge-commitment gate or belong to that superseded batch; none are acceptance evidence. Later entries in that batch were explicitly stopped rather than recording obsolete attempts.

`vanguard-covered-locked` uses the old x=-26 escort pilot and ends **playing**, not won, at tick8315 with player76/truck100. It stops moving toward(-26,4), with actual `allied-support` collision contact at player(-25.786,7.025). The convoy itself is still moving on its x=-22 centreline. This is an unsuitable pilot route beside a real ally, not proof the mission is blocked.

The successful `locked-westlane` attempt uses normal tactics: fire at the hostile flanker from(-22,9), proceed to the ridge gun, then escort along x=-22 instead of driving into the ally. No scenario parameters or body positions were changed. Its terminal tick is11186, player/truck HP100/100.

## Actual opening and pause

`idle-mutual-fire-locked.json` is a real unmodified mission opening: start input then1,800 empty-control ticks(30s), with actual reciprocal shots/damage. Another120ticks after a real pause command keep the complete paused state hash unchanged. The test uses actual geometry and terrain, not manually inserted shots or HP assignments.

## Legacy compatibility

`legacy20-regression.json` covers one original accepted main tape for each of20 formal missions: all won and all spec hashes match.19 full historical hashes match; mission015 retains its previously documented historical event-metadata mismatch. Its current complete final hash was independently checked against the frozen Scorched V1 runtime and matches exactly. Original expected files were not rewritten.

`v1-five-regression.json` and `v1-*-independent.json` show all five V1 vehicle/route tapes independently replay to their original complete hashes. The first invocation used the copied V1 test, which rewrote five independent-report timestamps inside the candidate's copied old QA directory; those copies were restored byte-for-byte from frozen V1 and new results retained here. The frozen V1 directory/package was never modified. Future reproduction writes only here:
```
node qa/crossfire-front/regress-legacy.mjs
SCORCHED_REPLAY_FULL=1 node --test qa/crossfire-front/regress-v1-readonly.test.mjs
```

These are deterministic simulation acceptance results. They do not establish correct rendered team colors, model loading, HUD, camera, browser/mobile/Mac performance, or screenshot acceptance.

## Explicit validation-source revision

The first two final east-route recordings (Vanguard/PzIII) captured `combat-relations.js` SHA `bb652310a071634b48b75f55436d65e4d7adf32c077f3634cd06deaf9e6ea4aa`. During subsequent recordings the owner added validation rejecting asymmetric hostilePairs, yielding `10554eaa82bc585b662707c63d649732e291932d2ffe5e5c155480bd42472bd2`. These mission relations are reciprocal. The first strict source-gate run is preserved and reports those two mismatches; it is not silently relabelled as a successful identical-code run.

The replay test permits **only this exact file/hash pair**, records both hashes plus the explicit validation-change explanation in `sourceDifferences`, and still requires the original complete final-state hash. It does not edit recorded source hashes, controls, spec or expected results. Other runtime differences remain hard failures. Separate results/logs are in `independent-validation-compatibility.log` and the affected `*-independent.json`. The other three winning tapes have no runtime-source difference. This proves exact trajectory compatibility for these inputs, not that arbitrary validation changes are safe.

## Additional vehicle west-route checks

The original diagonal fence approach (-18,18)→(-22,9) leaves ridge-fence-0 intact behind/alongside the PzIII and Leichttraktor hulls after crushing fences1–3. Their saved `locked-westlane` attempts stop progressing while still playing (PzIII tick1781, light tank tick1700), with no player/truck HP loss. Exact failed-terminal hashes were also independently replayed (`fence-failure-diagnosis.json`). The recorder's old route continuation emits one legitimate convoy-advance input after the failure checkpoint, so final-frame blocked flags are cleared; the checkpoint and read-only final world hull-contact query both identify ridge-fence-0. Do not misreport that last stationary frame as a new collision-free driving success.

The bounded adjustment `locked-westlane-straight` adds a normal waypoint at(-22,18) to align before crossing the fence northward. No vehicle, fence, hitbox, damage, ground or mission parameter is changed. Compare the preserved failed attempt to the successful run, if present; a pilot's failure does not establish an impassable mission.

## Eight independently accepted vehicle/route combinations

Recovered and verified from persisted files after the interrupted cloud session. `acceptance-summary.json` now covers all four chassis on both routes. Every row's compressed input SHA, original expected final hash, record final hash and independent replay final hash agree. The two validation-only source exceptions above remain explicitly reported; no tape was rewritten.

| Vehicle | East direct: player/truck HP | West covered: player/truck HP | West support HP |
| --- | --- | --- | --- |
| Vanguard | 100 / 86 | 100 / 100 | 30 |
| PzIII | 75 / 100 | 67 / 100 | 30 |
| Leichttraktor | 60 / 86 | 52 / 100 | 30 |
| Tiger | 125 / 100 | 147 / 100 | 26 |

The western successful player inputs actually destroy hostile-flanker and ridge-gun. PzIII/Leichttraktor additionally shoot the three remaining fence segments before advancing the truck (`locked-westlane-straight-clear`). They do not receive a manually widened opening. On the eastern accepted tapes, support dies in three cases and survives at 2 HP for Leichttraktor; the eastern player did not intervene in that western fight.

### Narrow breach is not enough for the truck

The earlier straight-crossing attempts leave fences 2–4 alive: the player fits through the western gap, while the original diagonal truck route stops around(-18.533,16.133) with `stoppedReason: obstacle`. `convoy-fence-diagnosis.json` reproduces the actual stable blocked microstep. A read-only route query ignoring only fence2 becomes clear; ignoring fence3 or4 does not. This diagnostic ignore list is never supplied to a simulation tick. Successful clear attempts use normal live shells against the remaining fence bodies.

Pre-clearing proves a usable route, **not** recovery after already becoming blocked. The original `straight-recovery` attempt replays the complete blocked prefix but later drives into the stopped supply truck's rear corner; it remains playing, with player67/truck100. That failure is preserved. A final bounded reverse-and-around continuation is tracked separately; only a successful independently replayed result can establish recovery for that exact encountered state. This does not prove every possible player-created blockage is recoverable.

### Final bounded recovery result (not a ninth win)

The `straight-recovery-escape` continuation reproduced the original obstacle ancestor at tick16171 and the actual supply-contact prefix at tick17499, with both original full hashes unchanged. Its final prefix wait reason is `tank`, not `obstacle`; the initial harness assumption was rejected, preserved in `*-obsolete-gate.log`, and replaced by the stronger two-checkpoint verification rather than a relaxed hash check.

Normal reverse moved the PzIII 1.159870242 m and removed supply contact. It then reached(-22,21) and the intended firing position near(-12,24), without a state repair. The subsequent fence2 shot attempt hit `blocked-aim`; final tick19743 remains playing, player67/truck100, fence2 at90 HP. No additional pilot strategy is attempted. This proves a recorded near-truck escape, but **full recovery of the already-blocked convoy remains unverified**. It neither counts as an accepted victory nor proves that the situation is impossible for a player.

`diagnose-recovery-escape.mjs` is a separate no-pilot independent replay of this failed trajectory, including both ancestor hashes, real contact/separation checks and an authoritative final firing-ray query. Its first strict JavaScript pose comparison encountered serialized negative-zero normalization; `recovery-escape-diagnosis-negative-zero.log` preserves this harness failure. The corrected comparison uses the same JSON-based pose hash as the recording format, with original expected values unchanged. The result file, if present, records whether the complete failed-state hash was independently reproduced; it is not a successful-route acceptance file.

Final independent diagnosis completed successfully: all 19,744 inputs reproduce the original failed full-state hash `873673b55a7e933771635ea9127f5059f29e189e1daa4c92f17a85ba28cfbaa6`; both saved ancestor hashes and real reverse separation pass. The cannon is correctly aligned (dot≈1), but the real nearest firing ray hits **supply** before fence2, at about7.305m. The stopped friendly truck physically screens that firing angle. No shot-through-friend repair or further pilot attempt was made. This is a verified failed recovery path, not a verified soft lock and not a ninth win.
