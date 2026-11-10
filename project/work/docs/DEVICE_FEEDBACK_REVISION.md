# Mac feedback revision inside the Crossfire integration

Parent-reported V1 device result, 2026-10-30 21:16 UTC: all four vehicles actually selected, moved and fired effectively; Tiger destroyed a real enemy; failure/retry worked. Simulated narrow viewport had no obvious HUD overlap; true touch remains untested. **Battlefield visuals failed:** broad uniform dirt, neat pale walls, sparse facilities/training-ground impression, too few scorch/debris damage cues, camouflage vs dark low-poly finish mismatch, weak hit/destruction readability. Parent owns screenshots/device session; these are reported facts, not a cloud browser test.

Decision under the user's already-authorized autonomous sprint: revise the existing V2 integration, not branch into disconnected art demos. Keep its deterministic mission/spec, routes, heightfield, solid geometry and all physics/combat inputs unchanged while gameplay recordings finish. Preserve V1 frozen package. Preserve pre-visual rendering sources separately for comparison.

## Selected approach
- Bounded shallow battle-scar ground using already-licensed PBR maps/noise; no fake deep crater geometry or changed contact surface.
- Static merged warfield: irregular scorch/debris film flush to terrain; existing solid-wall face damage without fake traversable openings; damaged industrial context strictly outside playable bounds. Do not hide real collision walls behind empty holes or show non-colliding cover on the road.
- Reversible owned material finish for actual vehicles: retain source textures/joints, common restrained dust/desaturation/roughness, readable allied/hostile cues. Never dispose shared source textures, and restore original player material when leaving V2.
- Existing real multi-direction combat and HP-derived smoke remain authoritative. No fake ambient shots, no altered enemy HP/DPS to manufacture intensity.

Rejected for this pass: wholesale asset style replacement (would invalidate model ownership/device tests), fake damaged geometry on solid-box colliders, unbounded dynamic debris/smoke, new physics obstacles without new input acceptance. All remain distinguishable from later genuine level design.

## Verification and limitation
RED/GREEN structural, shader hook/cache, material ownership/disposal, deterministic geometry/ground attachment and old-appearance tests; full suite and bilingual builds; repeat preservation audit. Final rendered colors/readability/shader execution, GPU cost, actual battle impression and hit visibility require parent-owned ego-browser Mac recheck. This revision is not an accepted war-scene visual until that happens.
