# Controller authorization received 2026-10-31 14:26:58 UTC

Only two historical identity guards may change: `work/tests/battlefront-depot-scope.test.mjs` and `work/tests/crossfire-v4-front.test.mjs`. No production or G1 test changes. Explicitly distinguish candidate view SHA56e855b45a6ce89dffdccc80fb08122e190a115398344f5fe481425cb3eaf1ab from preserved historical view SHA2e7da33acb99251e1a5b098c2d779749e43c9ce13f3efab8c4121607cfe1587c. Keep all other hashes/spec assertions. Preserve both old tests and original failed full suite. Run the two exact-name guards once, not the full suite or builds. Prove all final production/assets/config/other tests match full-suite identity; reuse outputs exact. Report1117total/1094pass/2historical-pin failures/21skips plus repaired2guard pass; do not claim zero-failure full suite. Independent review decides whether this composite gate is sufficient.

Original text retained in `old-guards/`; unchanged historical source is `authored-scene-view.before.js`. G1 terrain test required no exemption: its path was absent from the BF2 historical workFiles baseline, so the actual BF2 failure listed only authored-scene-view.js.

## Additional precise authorization received 14:28:56 UTC

First recovery07 yielded1pass/1fail: BF2 guard detected the authorized V4 guard edit. Controller independently confirmed the dependency, BASE includes V4test but not BF2scope itself. Authorized a single extra exact branch: current V4test SHA95098da030f0efa120d4d1da48133857b2117c002762113569468610291831dd and preserved original SHA6a900c689224b4285b4ebe103465051a514a6324b49b6fb2d24709e1ec1f83da, plus one two-guard recovery run. No broad tests-directory exemption; preserve07 failure and all other files/full-suite/build outputs.
