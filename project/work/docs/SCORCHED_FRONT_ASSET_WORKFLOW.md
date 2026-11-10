# Reuse decisions and license boundary

## Accepted in this candidate
- **Newc42 German Low Poly WWII Tanks**, original author page: https://newc-42.itch.io/german-low-poly-wwii-tanks . Explicit CC0 page archived with legal text and original Blender/FBX archives in `originals/newc42`. No standalone license file in the download, so the author page is retained as the source of the grant. Blender4.3.2 cannot read the newer authored blend; the same author's FBX is the accepted import. Used light tank and Tiger; alternate Pz.III saved but not exposed/count-inflated.
- **konserwa Panzerkampfwagen III**, original author page: https://opengameart.org/content/panzerkampfwagen-iii . Existing candidate's CC0 geometry reused, with its already-derived rig/running gear and owner texture maps. No claim of a new source model.
- Original project terrain shader, combat FX, industrial art kit, controller, world and UI are extended. No proprietary game extraction. The inherited player model's independent public/commercial redistribution authorization remains unresolved; private development/testing scope retained.

## Reuse method implemented, not just a link list
1. Archive author statement and original bytes; hash imports and output GLBs.
2. Normalize game-scale axes (-Z forward/+Y up), preserving actual geometry rather than scaling the old chassis collider blindly.
3. Author explicit turret, elevation, recoil and muzzle nodes; measure hull/turret proxies and wheel radii.
4. Partition the long barrel by actual connected geometry. Sweep the mantlet over validated elevation/recoil ranges into a turret envelope; keep a slender measured shaft capsule. Tests cover189joint pose combinations/model, plus exact render/simulation muzzle transforms.
5. Declare actual capabilities. Newc has independently animated wheels, not moving track links. Roster embeds resolved versioned physics/weapon config in mission/replay state.
6. Parse assets only when selected, validate declared texture maps (Three GLTFLoader can otherwise resolve missing images), and keep library-shared vs player-owned cleanup explicit.
7. Ship an independently replayable input acceptance tape for each exposed chassis, not merely a model gallery.

## Considered, not used or counted
- Quaternius Animated Tanks: official pack historically CC0,4vehicles; global/current QAL wording requires per-file/source-version reconciliation before another import. Not downloaded/integrated here.
- 3DAssets.dev Armoured Column and Field Camp: https://3dassets.dev/api/v1/packs/armoured-column-and-field-camp . Official list says74GLBs/12vehicle designs/CC0, AI-generated; visual quality/articulation unverified. Not accepted into playable roster.
- Lotnik T-34/85: https://opengameart.org/content/t-3485 , CC0 source candidate, not imported.
- Retgun9tank pack excluded because its project-use restrictions conflict with this AI-assisted workflow.
- Poly Haven / ambientCG CC0 textures and Kenney CC0 particle packs are candidates, not downloaded/claimed integrated. Public preview images are not automatically covered by downloadable asset CC0 terms.
- OpenRA and Warzone2100 are useful architectural/design references, but their engine licenses do not grant rights to proprietary original-game art. No GPL engine code or extracted art copied into this Three runtime.

The delivered models are readable military low-poly assets, not photoreal battle-damaged PBR. Offline Blender inspections demonstrate geometry and neutralized historical markings only; actual game aesthetics and GPU performance need the separately authorized screen test.
