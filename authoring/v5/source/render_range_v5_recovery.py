#!/usr/bin/env python3
"""Render and technically verify at most 120 native frames for motion review.

This does not approve motion, change the frozen configuration, or launch the
full film. Standard render_sequence_v5.py can later reuse the verified frames.
"""
from __future__ import annotations

import argparse
import os
from pathlib import Path
import signal
import sys
import time

sys.dont_write_bytecode = True
import render_common_v5 as common
from render_common_v5 import (
    append_event, atomic_json, frame_paths, load_config, render_lock,
    scan_frames, sha256, utc, verify_frame,
)
from render_sequence_v5 import Controller, ProcessFailure
from encode_validate_v5 import encode_segment

MAX_QA_FRAMES = 120
BLENDER_VERSION = '4.3.2'


def require_range_config(config):
    # load_config enforces the unchanged native production schema/settings.
    # Recovery additionally requires the runtime pin and matching soundtrack.
    if config.get('blender_version') != BLENDER_VERSION:
        raise ValueError('Recovery motion QA requires a frozen Blender 4.3.2 pin')
    if not config.get('audio_file'):
        raise ValueError('Recovery motion QA requires the frozen soundtrack')


def configured_chunk(config_path):
    """Use the selected project's source, never a historical hard-coded root."""
    source = Path(config_path).resolve().parent / 'source'
    here = Path(__file__).resolve().parent
    # The child imports common from its own directory. Refuse a different helper
    # implementation rather than silently executing a weaker chunk/identity gate.
    references = {'render_chunk_v5.py': here / 'render_chunk_v5.py',
                  'render_common_v5.py': Path(common.__file__).resolve()}
    for name, reference in references.items():
        candidate = source / name
        if not candidate.is_file() or sha256(candidate) != sha256(reference):
            raise RuntimeError(f'Selected project helper mismatch: {candidate}')
    return source / 'render_chunk_v5.py'


class RangeController(Controller):
    """Reuse production locking, process guards, heartbeats and quarantine."""

    def __init__(self, config_path, config, fingerprint, root, lock, start, end):
        if not 1 <= start <= end <= 720 or end - start + 1 > MAX_QA_FRAMES:
            raise ValueError('Motion QA requires 1 <= start <= end <= 720, at most 120 frames')
        require_range_config(config)
        self.start = start
        super().__init__(config_path, config, fingerprint, root, lock, end)
        self.state.update(requested_start=start, requested_frames=end-start+1,
                          purpose='bounded_native_motion_review',
                          visual_approval=False, full_film_authorized=False)

    def snapshot(self):
        with self.mutex:
            state = super().snapshot()
            missing = [f for f in range(self.start, self.end+1) if f not in self.good]
            contiguous = self.start
            while contiguous <= self.end and contiguous in self.good:
                contiguous += 1
            state.update(requested_start=self.start, requested_frames=self.end-self.start+1,
                         requested_complete=self.end-self.start+1-len(missing),
                         requested_contiguous_complete=contiguous-self.start,
                         requested_missing=missing)
            return state

    def check_identity(self):
        config, fingerprint, root = load_config(self.config_path)
        require_range_config(config)
        if fingerprint != self.fp or root != self.root:
            raise RuntimeError('Production config changed during range QA')

    def render(self, args):
        self.heart.start()
        try:
            self.good, bad = scan_frames(self.root, self.c, self.fp)
            if args.verify_only:
                self.set_phase('verification_complete', status='verified_snapshot',
                               invalid_frames=bad)
                return
            self.check_identity()
            for frame, reason in bad.items():
                self.quarantine(frame, reason)
            chunk = configured_chunk(self.config_path)
            identity = {'config': self.c, 'config_sha256': self.fp,
                        'source_sha256': self.c['blend_sha256'], 'started_utc': utc(),
                        'first_frame': self.start, 'last_frame': self.end,
                        'runner_sha256': sha256(__file__),
                        'chunk_sha256': sha256(chunk),
                        'visual_approval': False, 'full_film_authorized': False,
                        'checkpoint_scope': 'Same-workspace only; rollback may remove local artifacts'}
            # Preserve standard run_identity.json and every earlier range record.
            atomic_json(self.root/'runs'/f'range_{time.time_ns()}_{os.getpid()}.json', identity)
            self.set_phase('validated_existing_frames', status='running',
                           invalid_frames_quarantined=len(bad))
            failures = {}
            force_single = False
            thread_limit = 8
            while True:
                missing = [f for f in range(self.start, self.end+1) if f not in self.good]
                if not missing:
                    break
                if args.encode_only:
                    raise RuntimeError(f'Cannot encode: missing {len(missing)} requested frames')
                batch = missing[:1 if force_single else 2]
                self.check_identity()
                configured_chunk(self.config_path)
                if any(failures.get(f, 0) >= args.max_attempts for f in batch):
                    raise RuntimeError(f'Render retry budget exhausted for {batch}; artifacts preserved')
                attempt = max(failures.get(f, 0) for f in batch)+1
                log = self.root/'logs'/f'range_render_{batch[0]:04d}_{batch[-1]:04d}_attempt{attempt}_{time.time_ns()}.log'
                self.state.update(active_frames=batch, actual_threads=thread_limit)
                cmd = [args.blender, '-b', str((self.config_path.parent/self.c['blend_file']).resolve()),
                       '-t', str(thread_limit), '--python-exit-code', '1', '--python', str(chunk),
                       '--', '--config', str(self.config_path), '--fingerprint', self.fp,
                       '--frames', ','.join(map(str, batch)), '--threads', str(thread_limit),
                       '--lock-fd', str(self.lock.fileno())]
                problem = None
                try:
                    self.run(cmd, log, 'rendering', args.batch_timeout)
                except ProcessFailure as exc:
                    problem = exc
                missing_after = []
                for frame in batch:
                    meta, error = verify_frame(self.root, frame, self.c, self.fp)
                    if meta:
                        self.good[frame] = meta
                    else:
                        missing_after.append(frame)
                        failures[frame] = failures.get(frame, 0)+1
                        png, sidecar = frame_paths(self.root, frame)
                        if png.exists() or sidecar.exists():
                            self.quarantine(frame, error)
                self.set_phase('batch_checked', active_frames=[],
                               last_batch_error=str(problem) if problem else None)
                if missing_after:
                    append_event(self.root/'events.jsonl', {'event': 'retry_required',
                                 'frames': missing_after,
                                 'reason': str(problem) if problem else 'exit 0 but frame verification failed'})
                    # Exactly the production recovery policy: batch two/eight
                    # threads, then one/eight, then one/four. Quality never falls.
                    if force_single:
                        thread_limit = 4
                    force_single = True
                    time.sleep(3)
            self.check_identity()
            path, meta = encode_segment(self.config_path, self.c, self.fp, self.root,
                                        self.good, self.start, self.end,
                                        f'motion_QA_{self.start:04d}_{self.end:04d}', self.run)
            self.set_phase('awaiting_visual_motion_review', status='range_complete',
                           preview_file=str(path), preview_sha256=meta['file_sha256'],
                           technical_verification_complete=True,
                           visual_approval=False, full_film_authorized=False)
        except BaseException as exc:
            self.terminate_child()
            self.set_phase('stopped',
                           status='interrupted' if isinstance(exc, (KeyboardInterrupt, SystemExit)) else 'failed',
                           error=str(exc), active_frames=[])
            raise
        finally:
            self.stop.set()
            self.heart.join(timeout=20)
            self.publish()


def parse_args(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--config', default=str(Path(__file__).resolve().parent.parent/'production_config.json'))
    parser.add_argument('--start', type=int, required=True)
    parser.add_argument('--end', type=int, required=True)
    parser.add_argument('--blender', default='blender')
    parser.add_argument('--batch-timeout', type=int, default=1800)
    parser.add_argument('--max-attempts', type=int, default=4)
    mode = parser.add_mutually_exclusive_group()
    mode.add_argument('--verify-only', action='store_true', help='Only fully verify existing PNGs/sidecars')
    mode.add_argument('--encode-only', action='store_true', help='Never invoke Blender; require the entire selected range')
    args = parser.parse_args(argv)
    if not 1 <= args.start <= args.end <= 720 or args.end-args.start+1 > MAX_QA_FRAMES:
        parser.error('Require 1 <= start <= end <= 720 and at most 120 frames; full-film rendering is separate')
    if not 1 <= args.max_attempts <= 4:
        parser.error('max-attempts must be 1..4 per frame')
    if not 1 <= args.batch_timeout <= 1800:
        parser.error('batch-timeout must be 1..1800 seconds')
    return args


def main(argv=None):
    args = parse_args(argv)
    with render_lock(args.config) as lock:
        config, fingerprint, root = load_config(args.config)
        controller = RangeController(args.config, config, fingerprint, root, lock, args.start, args.end)
        def stop_handler(signum, frame):
            raise KeyboardInterrupt(f'Received signal {signum}')
        previous = signal.signal(signal.SIGTERM, stop_handler)
        try:
            controller.render(args)
        finally:
            signal.signal(signal.SIGTERM, previous)


if __name__ == '__main__':
    try:
        main()
    except KeyboardInterrupt as exc:
        print(str(exc), file=sys.stderr)
        sys.exit(130)
    except Exception as exc:
        print(f'RANGE_QA_FAILED: {exc}', file=sys.stderr, flush=True)
        sys.exit(1)
