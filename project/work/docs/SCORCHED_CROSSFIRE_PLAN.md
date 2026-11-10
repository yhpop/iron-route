# Scorched Crossfire integrated revision
Base is frozen four-vehicle candidate SHA41d2ffa8a840..., never edited. New optional sortie `crossfire-front` keeps original20 and Scorched Front v1 available. Add actual team-aware support fire and route-specific second hostile position; never fake background projectiles.

1. RED/GREEN pure relationship rules and opt-in combat: allied player/truck/support vs hostile, explicit default hostility, stable valid-target ordering, friendlies never acquire one another. Friendly shells physically collide and are absorbed without damage/shield effects. Legacy absent policy byte-identical. Ghost/unknown team policy rejects auto-acquisition.
2. RED/GREEN telegraph and feedback semantics: hostile-to-player/truck warning only; allied fire not painted as an incoming threat; friendly absorption gets meaningful impact classification, not false confirmed damage. No pause/terminal side effects.
3. Compose new mission with1allied PzIII support and1additional hostile PzIII, terrain/cover checked, same convoy objective. The friend can be destroyed but isn't a protected escort failure. Initial2legacy hostile units retained. No source geometry added blindly to roads.
4. State-driven damage/wreck effects and faction recognition, bounded own pool/material copies; actual artillery/art adapter must reflect team while never changing oldmissions.
5. Independent input-only simulations prove allied-vs-hostile actual shots/damage/destruction, player contribution,4chassis+bothroutes viable; fail clearly rather than tune until green. No fake win mutation.
6. Full legacy unit/bilingual builds, frozen-v1 hash and asset preservation; separate package and review. Mac v1 still independently verifies visuals; no local Mac operation here.
