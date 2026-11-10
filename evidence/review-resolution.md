# Review resolution

Independent review checked the shared replay/provenance logic and the legacy reporting entry points. Four source-validation loads succeeded, the 33-module gameplay import closure was covered by pinned source files, and production imports occur after verification. No production or fixture edits were requested.

The following audit-helper gaps were reproduced with small negative tests and fixed:

1. Impact/damage could precede the shot in one tick. Events now process in order; impact requires an already recorded shot.
2. A projectile could report repeated impacts/damage chains. First impact consumes its audit identity; a repeated impact fails.
3. A live projectile could have the correct ID but the wrong owner. The owner must now equal the shot entity.
4. An arrival event was checked only against final position. Its actual event-frame supply must now be alive, arrived, have arrived status, match the event position, and be at the real destination.
5. A matching historical count/name report with unexpected process exit 137 could match exit-1 baseline. The audit now requires exact expected exit status as well. This was treated as an audit-correctness issue rather than cosmetic reporting.

These were independent invariant-audit gaps, not evidence that original real replays were mocked or that their exact state/event comparisons were wrong.

Evidence:
- `review-event-order-red.tap`: 2 new tests fail against the prior helper.
- `review-frame-and-exit-red.tap`: 4 new tests fail against the prior frame/parser guards.
- `review-complete-green.tap`: 61 fast tests pass after all fixes.
- `current-suite-verified.log`: final complete new suite with four real replays after the reviewed code is fixed.

No review findings were deferred. The original 29 historical gameplay/source-binding failures are outside this change and remain visible and failing.
