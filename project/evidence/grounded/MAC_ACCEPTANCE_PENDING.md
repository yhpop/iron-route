# Grounded freight yard — real-device acceptance pending

This is a separate view-only successor to the frozen Battlefront Depot package. Final build/package identities must be supplied by the later handoff; this document is not a release or completed acceptance claim.

## Exact intent
- Repair the reported gray west off-map area using one static exterior ground ring sharing existing ground materials. It is optical context outside the existing boundary, not playable terrain or cover.
- Add continuous historic char/ash around the south depot, west loading apron, west workshop and east window wall using the existing mask channel. Road/traction data and physical terrain do not change.
- Neutralize the intact green-roof appearance of the detailed south warehouse and two existing outside-context warehouses. They remain **sealed, damaged warehouses**, not open collapsed ruins. Original geometry and existing collision approximation stay unchanged.

## Device observations still needed (parent-owned authorized workflow)
1. Inspect the west edge while driving and moving the actual camera; also inspect other edges/corners and portrait/landscape views. Check for exposed gray void, visible seam, clamped road stripes, floating buildings, distracting texture repetition or perimeter pop-in. Source frustum coverage is bounded to aspect .25..8, not arbitrary viewports.
2. Inspect the south warehouse at (-25,28), including green sawtooth roof and glass; inspect the two outside warehouses near (-53,-18) and (53,21). Verify damage remains visible when occlusion fades the building and after it restores, without false holes or altered silhouettes. Do not infer exact roof collision from retained coarse envelope.
3. Judge whether the four damaged ground regions read as coherent battlefield wear rather than black paint/confetti, whether roads remain readable, and whether quiet terrain is still too clean. CPU mask histograms and shader swatches are not visual acceptance.
4. Retest normal driving, shooting and two-route combat as appropriate; all existing actors/physical sources remain pinned, but new actual route acceptance is not inferred from source identity. Existing five vehicles only; no Strv or new model.
5. Any frame/memory comparison needs actual build identity and comparable observed conditions. One added ground draw/1,312 triangles also adds PBR fragment cost; there is no zero-cost or performance-fix claim. Earlier sample video without >900ms intervals applies only to that sample; second-scale scheduling root cause remains unresolved.

## Restrictions and known limits
No Mac operation or raw-data upload is performed by the cloud author. Prior small-screen authorization attempts timed out twice without executing; they are not an unsafe denial, but **must not be retried under this handoff without the parent resolving the authorization window**. Existing viewport/UI defects are not claimed fixed by this view-only change. Physical tank-center versus decorative boundary-wall setback, sealed-warehouse collision approximation and previous unverified low/over-wall projectile-ID cases remain limits.

Original Vanguard public/commercial redistribution rights remain unresolved. Private development acceptance only; keep all licenses/credits and preserve all older packages. Full source suite, independent reviews, verified package hashes and Library IDs belong to later fixed evidence, not this pending checklist.
