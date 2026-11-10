# Player-owned objective tracking

Independent choice under the user's explicit autonomous sprint instruction. Base: combat_feedback_candidate/work (5c40c90a…); contains grass/weathered-road/hit feedback, NOT committed-aim or stochastic-road. Existing versions untouched. No Mac/browser operation.

Known gap:20 authored missions have real spatial and objective choices, but main HUD always picks first active objective while the directional hint independently selects nearest marker by type/distance. Mission5 allows east-first or west-first; contradictory headings obscure this freedom. Representative convoy has physical route-choice circles that must not be turned into a menu decision.

Implement local presentation-only objective tracking. Current active objective identities (not marker count) are eligible. Default selection preserves existing type/nearest priority; after Q or tapping the objective strip, selected identity remains until completion/invalidity. Text and bearing consume the same chosen objective and point. Completion of a different objective must not steal selection. A missing point clears the old arrow but keeps valid objective text. Same-ID retry/load explicitly resets; pause preserves but disables cycling. Do not write simulation state, mission specs, input tapes or saved progress.

Route-choice mode remains physical: use nearest circle guidance, disable objective cycling. Single objective with multiple targets/trucks is not multiple objectives. Within a chosen multi-target objective, use its remaining nearest valid marker. Sharing an entity across objectives must not lose objective ownership.

Compact UI: reuse existing HUD objective slot, replacing its plain line with a native44px-min button only while multiple tasks are active. No new panel, map, modal or central overlay. Current title on first line; second line signals all tasks still required and Q/tap cycles. Only all-disable/breach combinations may say clearing order is free; mixed escort/defend goals say parallel, never imply serial safety. Existing urgent-warning > hit-feedback > direction priority remains. In briefing, give a short contextual Q/tap hint without changing the mission's dependency list.

Input: unused Q, no modifiers/repeats/editable targets; only playing, view ready, menu closed, legal active count>1. Native click supports touch and keyboard. No data-control field that could conflict with drive/fire.

Alternatives considered: dumping every objective on screen adds clutter; changing mission prerequisites would erase intended decisions; adding new weapons/enemy types before closing this known guidance mismatch adds unproven balance. Explicit tracking offers an actual player navigation choice with zero simulation mutation.

Research: CDDA uses separate active mission selection/target lookup (CC BY-SA3.0, not copied); SPT-QuestTracker uses separate tracked IDs and invalidation (MIT plugin, not an independently licensed host game). Borrow design, no source/assets/dependencies imported. License/source links recorded in final report.

Verification: RED→GREEN pure model and real UI adapter tests; east/west pin survives opposite-side movement; completion, missing targets, multi-truck, shared markers, mixed objectives, route-choice, pause/retry/selection, modifiers and disposal. Full tests and bilingual builds. Replay existing mission5 two strategies and representative escort tapes without altering state/hashes; add presentation events separately. DOM fixture evidence is not browser layout, Mac or human readability acceptance. CPU inspection must never be called a screenshot.
