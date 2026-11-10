> Historical 0.8.1 reconstruction record. This 0.8.2 candidate adds the separately reviewed startup-diagnostic patch; see docs/startup-diagnostics-082.md. The preserved baseline archive remains unchanged.

# Iron Route — English editable source (reconstructed 2026-10-28)

This is **newly reconstructed source**, not a recovered copy of lost Git commit
`6cf0ea2`. The earlier English worktree was unavailable after the workspace reset.
We preserved the supplied Chinese 0.8.1 source and rebuilt its English-only
localization inventory, build plugin and tests. The resulting five runtime files
are byte-for-byte identical to the preserved English candidate.

## Build

From this `源码` directory:

```sh
node build-english.mjs  # English: dist-en/
node build.mjs          # Original Chinese: dist/
```

The public English title is **Iron Route**. The selector lists only the twenty
handcrafted missions; historical explicit `?sortie=` URLs remain compatible. The
Chinese default build is unchanged. Both locales retain `iron-route:crafted20:v1`;
no migration, combat, camera or input change is hidden in this reconstruction.

Edit English copy in `locales/en-ui.json` and `locales/en-missions.json`. Exact
source-snippet occurrence guards and final Chinese-character rejection make new
untranslated or drifted copy fail the English build. This is a build-time layer,
not a runtime DOM patch. Templates retain their dynamic expressions.

## What each archive contains

- **English Editable Master:** all source, original runtime assets, supplied
  Blender authoring scenes, textures, recipes, tests and accepted input tapes.
  No installed dependencies or duplicate build outputs.
- **English Source Core:** the same source and runtime build inputs, except the
  30 unchanged authoring/preview files already supplied in archives **03** and
  **04**. It is **not the complete editable-art master**. Its exact missing paths,
  SHA-256 values and source archive names are in
  `recovery/core-omitted-existing-assets.json`.
- **Linux x64 Dependencies:** optional, pinned packages for this cloud environment
  only. It is **not a Mac/Windows build kit** and does not include Node or Python.
  Extract beside the source archives to produce `源码/node_modules/`. No package
  installation or lifecycle script is needed on a compatible Linux x64 host.

All three use the same `源码/` top-level directory. Archives 03 and 04 also use
`源码/assets/...`. Merge into a **new empty release directory**. Do not erase an
existing working directory. If a destination file already exists, compare its
SHA-256 first: leave identical bytes alone; stop on a mismatch rather than
silently overwriting newer source, README files, or assets. The 03/04 bytes were
independently compared with this master and are identical. Their unchanged asset
README is deliberately not edited in the core.

The separately preserved `Iron_Route_Basic_Launch_candidate.zip` is the original
five-file browser runtime. It is not duplicated or replaced by these source
archives. Rebuilding this source reproduces it; do not mistake the authoring
archives or dependency archive for a platform submission.

## Dependencies and verification

Pinned: three 0.186.1, esbuild 0.28.2, @dimforge/rapier3d-compat 0.21.0; package-lock
is unchanged. Four official npm tarballs (including @esbuild/linux-x64 0.28.2)
were verified against their SHA-512 lock integrities. Lifecycle scripts were
not run. Other operating systems require their matching esbuild binary through
the unchanged lock in an authorized dependency-restore environment.

Verified here with Node 24.22.1, Python and NumPy:

```sh
node --test tests/*.test.mjs                  # 567 passed
node --test qa/accepted40/verify.test.mjs      # 41 passed
node tests/english-replay-check.mjs           # 40 tapes / 20 missions
```

The English checker compares **207,149 simulation snapshots** with the original
Chinese game and all forty input tapes end in a win. Original Chinese whole-spec
and final-state hashes still match the recordings; English presentation changes
are assigned their own hashes, never grafted onto old recording metadata.
The fourteen English-focused tests run actual localized main/UI/input/simulation
paths with the existing fake-browser boundaries. Synthetic terminal UI checks are
not counted as combat wins. See `recovery/` for fresh evidence.

Expected English JS SHA-256:
`2ce95915eebbbabb976050af1bdc3064382c54c8b83a7cf857cad965d8ab5c11`

Expected original Chinese JS SHA-256:
`7382ddf943f904402e6d3b6b752c0b6b766e3e27ee058d7998a8d484811b695e`

## Boundaries

No browser/GPU/audio/device acceptance or commercial/platform approval is claimed.
No platform upload or account action occurred. The separately prepared startup
WebGL diagnostic patch is **not included**; that is a later reviewed change.
The supplied source includes the articulated tank GLB and environment Blender
scenes; it does not manufacture a missing original V5 tank authoring master.
Keep the supplied asset provenance and third-party licenses. Historical Chinese
README text describes the supplied baseline, not this recovery's dependency
restore. This README and `recovery/reconstruction-manifest.json` identify the new
reconstruction and its actual verification scope.
