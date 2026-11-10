# BF1 fix round 1 — scoped re-review

## Verdict

**I1: ADDRESSED. New Critical/Important findings within the fix diff: none.**

Reviewed the single acceptance-test replacement and the appended fix report against the exact original I1 finding. No untouched production source was re-reviewed and no tests, simulations, builds, Git, network, browser, Mac, or additional workers were run.

## Evidence for closure

All line references below to the test mean `work/tests/battlefront-depot-replays.test.mjs`.

- **Both raw diagnostics now bind to the current candidate.** Lines 23–59 discover the current physical closure and compare its complete source texts/hashes, resolved Sandfalcon spec, final mission/hash, and input accounting. Lines 62–81 load the two named raw files, pin their compressed-byte SHA256, and ensure the parsed object belongs to those bytes. These checks execute for crossfire at lines 167–170 and cover at lines 266–269. This closes the stale-summary/current-route loophole identified by I1.
- **Crossfire claims are located/derived rather than accepted from the summary.** Lines 101–119 locate frame shot events in the raw event stream and retain the actual origins/player poses. Lines 122–155 derive the >=45-degree pair at an identical player pose, require both hostiles alive and targeting the player, locate both selected real projectile IDs together in the later shot frame, and locate their subsequent tank impacts/damage. Lines 157–186 derive the simultaneous projectile frames and require complete summary equality, including the raw digest, spec hash and source hashes. Reciprocal ally/enemy damage remains checked from current-bound covered-route raw at lines 288–297.
- **Cover claims now derive from raw inspection with the correct semantics.** Lines 205–238 validate the production +1.3m hostile origin, resolved player aimHeight, full 3D effective range, recorded segment hit point/distance, actual static-cover bounds and available recorded frame matches. Lines 244–254 locate exactly ticks 2231–3117, 887 consecutive live-enemy/in-range static-wall records, enemy 90HP and player 48HP. Lines 255–262 preserve the outside-range clear→blocked qualification and locate the preceding engaged-clear record plus prior real enemy damage. Lines 270–285 require the entire cover summary to equal these bound raw records and preserve final player/truck HP assertions.
- **Negative controls cover the original failure mode and new binding checks.** Lines 304–337 reject edited summaries, stale bytes, internally rehashed stale spec/source and a missing closure member; lines 340–359 reject missing selected projectile/damage and wrong aim-height/range records. The saved RED test and `fix-1/01-red.log` show the original unsupported +1-degree claim caused an actual missing-exception AssertionError, not a stub/import failure.

## Logs and identity checks

- The supplied review-package SHA256 independently matches `749e3e1335a2719214fc876a77def941983d412694298a158c56bc8c0c8140f0`.
- The current test SHA256 independently matches HEAD `d64d23bba3da2363aa2b5e190829d7325e09d2d036d2bec893e019865ea4d8d6`; its saved after-copy is byte-identical. The saved before-copy matches BASE `8059a8908ab9f268a508b3c12f6a249c116b0e4ed14cf491171d3c243df67106`.
- All six additive evidence digests printed in `evidence/battlefront/bf1/REPORT.md:145–151` match the corresponding files. Both frozen raw digests at report lines 153–155 also independently match.
- `evidence/battlefront/bf1/fix-1/02-green.log:2–16` records the same six tests present in the reviewed diff, 6 passed, 0 failed/skipped, 3382.812498ms and EXIT:0. The report accurately labels this artifact-only run and retains the historical 16/16 run as pre-review evidence (`REPORT.md:69`). No test rerun was performed in this review.
- To resolve the concrete 3D-range/origin/bounds question, inspected only saved cover-raw slices: its recorded combat source uses the +1.3m origin and full 3D distance to resolved target aimHeight; ticks 1370/2230/2231/3117/3118 and the saved static geometry agree with the new interval assertions. No live source/physics re-evaluation was needed.

## Limits and out-of-scope observations

The first clear→blocked transition is still **outside effective range**; the live enemy later returns within range behind the wall. This is retreat/hold-cover evidence, not a same-tick in-range LOS cut. The test explicitly preserves this at lines 255–257, consistent with `REPORT.md:73` and the established task qualification.

No new out-of-scope issue was identified. M1 compressed tooling remains deferred to whole-candidate review as instructed. Device visuals/performance, later Mac work and untouched implementation/physics remain outside this fix review. The saved identity record's all709 assertion was read, not expanded into a new audit of immutable files.
