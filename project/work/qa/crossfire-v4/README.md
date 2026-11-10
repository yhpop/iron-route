# V4 final route evidence

`acceptance-inputs.json` explicitly selects three final flat-ground attempt04 tapes. `acceptance-summary.json` binds their exact identities and successful independent full-state replays. Raw pilot reports and gzip inputs are not sufficient by themselves: every accepted tape has a separate `*-independent.json` and a terminal replay log under `evidence/v4-replays/`.

Run from `work`: `CROSSFIRE_V4_REPLAY_FULL=1 node --test tests/crossfire-v4-replay.test.mjs`. This replays all whitelisted routes; normal aggregate tests skip only the expensive full replays. Optional `CROSSFIRE_V4_TAPE=<exact whitelisted basename>` selects one full replay while global route presence is still checked against the entire whitelist.

Historical diagnostics are excluded. Attempt03 transport outcomes remain uncertain; any late output is not accepted. This is offline production simulation, not browser/GPU/Mac/human-play proof. See `evidence/v4-replays/TASK3_REPORT.md` for scope, RED/GREEN, actual results and limitations.
