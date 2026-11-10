# English-only presentation/build boundary

`build-english.mjs` runs the existing esbuild/art-payload pipeline with an explicit
translation plugin. The default `build.mjs`, `src/`, `index.html`, CSS, assets and
lock are preserved. `dist-en/` is separate from `dist/`.

- 147 entries in `locales/en-ui.json`: HTML, menus, HUD, controls, a11y, warnings,
  loading/save/context errors and native-zoom recovery.
- 101 entries in `locales/en-missions.json`: twenty titles, twenty briefings,
  fifty-seven objective titles and two historical optional titles/briefings.
- One English-only profile override passes `optionalMissions:[]` to the UI;
  mechanics and explicit historical sortie URLs are retained.

Only exact reviewed source snippets are replaced. Expected occurrence counts
fail on drift; any remaining Chinese character in reachable source or final JS
aborts the English build. Dynamic numeric/ID expressions are not translated.
Original tapes are read-only; localized spec/state hashes differ because they
contain changed presentation fields. The comparison checker first establishes
that all non-presentation spec fields are identical, then checks all simulation
states, outcomes and original Chinese recording identities.

This reconstruction is not the original lost source commit. The copied Chinese
baseline's per-file hashes are recorded in `recovery/chinese-source-baseline-sha256.json`.
The rebuilt English runtime matches every byte of the recovered original five-file
ZIP. Node/fake-DOM/CPU evidence is not real-browser or player evidence.
