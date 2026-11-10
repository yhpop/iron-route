# Exact execution versus persisted evidence versus speed

- `core.mjs`: independently constructs original/accelerated front, spec, world and
  createGame state; true transitive source closure; independently derived metadata;
  receiver-preserving whole-query recorder. No game source edits or oracle repair.
- `replay.mjs paired direct|covered LABEL`: original and accelerated actual states
  step separately from their own previous states. Every public call, arguments and
  full result (including setEntities/setDestroyed) are compared in order; full live
  GameState deepStrictEqual preserves signed zero. Final dispose is also recorded.
- `replay.mjs independent direct|covered LABEL`: separate fresh accelerated process,
  no paired oracle; full generated artifact including metadata must reproduce all
  gzip bytes, uncompressed bytes and JSON of the first accelerated run.
- `replay.mjs fleet direct fleet`: each of the unchanged five roster entries gets
  start +120 idle inputs; this is not five complete-route acceptance.
- `benchmark.mjs paired-v1`: fresh worlds per run, discarded equal 60-input warmups,
  three sequential alternating A/B pairs per 228/600 idle workload and first600
  actual direct controls. Timed loop directly invokes unchanged stepGame with one
  actual original or accelerated world; no wrapper/counter/assertion/serialization.

Original persisted artifacts match the ENTIRE historical JSON using its existing
roundtrip helper. Only boundary/sourceSnapshot/sourceHashes/provenance may differ
between original and accelerated artifacts. These are derived from actual roots,
source files, source-map and input file bytes, not copied from actual to expected.
Historical JSON equivalence is **not** a signed-zero live-execution assertion.

Compressed traces are concatenated gzip members of JSONL and can be streamed by
standard gzip readers. Original and actual accelerated calls are both retained.
`$scalar` markers encode undefined, -0 and nonfinite numeric leaves in trace/hash
serialization; ordinary JSON artifact serialization remains historically exact.
The live deepStrictEqual assertion, not a hash, is the equality authority. Full
live-state snapshots are saved every1000 paired inputs and at route completion.
`progress.jsonl` stores per-input full-state hash pairs and query counts. Full
runs/events/checkpoints/final states are in each complete result artifact.

Use `python qa-tools/run-performance-recorded.py LABEL . node ...` from candidate
root. Labels never overwrite. The recorder captures exact code and source maps at
start, stdout, PID/command/cwd, terminal code and after maps. Each job is sequential,
bounded to14400seconds and retains failures. A `CANCEL` file inside a route output
directory is honored at60-input boundaries and marks the result incomplete.
Never edit a running harness. No browser/Mac/network/install/account/Git use.

The `wholeQueryCalls` paired summary is recorded before disposal; its method
`counts` includes the final dispose. The independent streamed trace audit reports
input-query and final-disposal counts separately, and their complete sum.
Temporary verification mirrors are preserved locally but excluded from all source
and device archives, as are all node_modules trees. Packaging is controller-only
after independent task and strongest whole-candidate review. See the final gates
under `evidence/performance/final/` and device checklist in candidate docs.
