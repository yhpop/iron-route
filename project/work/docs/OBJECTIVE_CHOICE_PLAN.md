# Objective Choice Implementation Plan

> Native execution with independent review; superpowers:executing-plans. Directory-copy isolation (no Git repo), source/archive SHA preservation.

Goal: make existing parallel tactical choices explicit and player-owned without changing completion rules.
Architecture: new pure presentation tracker; main owns its lifecycle and uses one focus for HUD/bearing; UI contextual44px objective-strip button/Q; English inventory updated. Existing world-marker function stays untouched.
Spec: OBJECTIVE_CHOICE_DESIGN.md.

1. Write tests/objective-guidance.test.mjs and tests/objective-choice-ui.test.mjs; observe missing-feature failures. Baseline721 clean first.
2. Add src/objective-guidance.js with createObjectiveTracker.update/selectNext/reset; objective→point mapping retains ownership. Main uses update through one guidance path and resets at loadSelection. UI consumes status.objectiveGuidance and invokes actions.cycleObjective; no state/save writes.
3. Add compact CSS and bilingual labels, preserve warning priorities. Tests for lifecycle, input guards, route-choice, semantic parallel count and absent locations. Full regression and both builds.
4. Evidence: actual saved mission5 main/alternative controls with UI/model observations; real convoy replay unaffected; independent source/preservation review. Package separate candidate with limitations, resources/license research, hashes and no real-device claim.
