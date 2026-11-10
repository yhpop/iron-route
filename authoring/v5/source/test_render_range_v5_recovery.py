"""CPU-light contract tests. All media decode/render/probe work is mocked."""
import contextlib
import copy
import io
import json
from pathlib import Path
import shutil
import sys
import tempfile
import unittest
from unittest.mock import patch

sys.dont_write_bytecode = True
import render_common_v5 as common
import encode_validate_v5 as encoder
import render_range_v5_recovery as runner
from render_sequence_v5 import Controller, ProcessFailure


class SimController(runner.RangeController):
    def publish(self):
        self.last_snapshot = self.snapshot()

    def run(self, cmd, log, phase, timeout):
        self.calls.append((cmd, phase, timeout))
        self.on_run(cmd, Path(log), phase)


class RangeTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='range_qa_contract_')
        self.addCleanup(self.temp.cleanup)
        self.project = Path(self.temp.name)/'future_corrected_project'
        source = self.project/'source'
        source.mkdir(parents=True)
        for name in ('render_common_v5.py', 'render_chunk_v5.py'):
            shutil.copyfile(Path(runner.__file__).with_name(name), source/name)
        blend = self.project/'frozen.blend'
        blend.write_bytes(b'NOT A BLEND: synthetic source identity only')
        audio = source/'audio.wav'
        audio.write_bytes(b'NOT AUDIO: synthetic soundtrack identity only')
        self.config = {
            'schema_version': 1, 'production_id': 'synthetic-v5-range',
            'blender_version': '4.3.2', 'blend_file': 'frozen.blend',
            'blend_sha256': common.sha256(blend), 'audio_file': 'source/audio.wav',
            'audio_sha256': common.sha256(audio),
            'render': {'width': 1280, 'height': 720, 'fps': 24, 'frame_start': 1,
                       'frame_end': 720, 'engine': 'BLENDER_EEVEE_NEXT', 'samples': 96,
                       'raytracing': True, 'raytracing_resolution': '1',
                       'temporal_denoise': False, 'threads': 8},
            'shot_starts': [1, 121, 265, 385, 505, 601],
            'events': {'stop_fire': 481, 'impact': 510, 'restart': 601},
        }
        self.config_path = self.project/'production_config.json'
        common.atomic_json(self.config_path, self.config)
        self.c, self.fp, self.root = common.load_config(self.config_path)
        self.decoded = {'width': 1280, 'height': 720, 'bit_depth': 8, 'channels': 3, 'bytes': 12}
        # Actual frame identity/hash checks stay live; no real PNG/media is made.
        self.enterContext(patch.object(common, 'png_decode', return_value=self.decoded))
        self.enterContext(patch('subprocess.Popen', side_effect=AssertionError('No subprocess permitted')))
        self.enterContext(patch('subprocess.run', side_effect=AssertionError('No subprocess permitted')))
        self.enterContext(patch.object(runner.time, 'sleep'))

    def frame(self, number, **changes):
        png, sidecar = common.frame_paths(self.root, number)
        png.parent.mkdir(parents=True, exist_ok=True)
        png.write_bytes(f'fake-frame-{number}'.encode())
        meta = {'schema_version': 1, 'frame': number, 'complete': True,
                'provenance': 'blender_render_v5', 'blender_version': '4.3.2',
                'config_sha256': self.fp, 'source_sha256': self.c['blend_sha256'],
                'render_settings': self.c['render'], 'png': self.decoded,
                'png_sha256': common.sha256(png)}
        meta.update(changes)
        common.atomic_json(sidecar, meta)
        return meta

    def controller(self, start=481, end=484):
        lock = self.enterContext(common.render_lock(self.config_path))
        ctl = SimController(self.config_path, self.c, self.fp, self.root, lock, start, end)
        ctl.calls = []
        ctl.on_run = lambda cmd, log, phase: [self.frame(f) for f in self.batch(cmd)]
        return ctl

    def args(self, start=481, end=484, *extra):
        return runner.parse_args(['--config', str(self.config_path), '--start', str(start),
                                  '--end', str(end), *extra])

    @staticmethod
    def batch(cmd):
        return [int(f) for f in cmd[cmd.index('--frames')+1].split(',')]

    def fake_encoder(self, *args, **kwargs):
        self.encoded = args
        self.assertFalse(kwargs.get('final', False))
        return self.root/'checkpoints'/'fake.mp4', {'file_sha256': 'f'*64}

    def test_range_bounds_and_attempt_limits(self):
        for start, end in [(0, 1), (2, 1), (1, 121), (1, 720), (700, 721)]:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                self.args(start, end)
        for flag, value in [('--max-attempts', '0'), ('--max-attempts', '5'),
                            ('--batch-timeout', '0'), ('--batch-timeout', '1801')]:
            with contextlib.redirect_stderr(io.StringIO()), self.assertRaises(SystemExit):
                self.args(481, 600, flag, value)
        self.assertEqual(self.args(481, 600).end, 600)
        self.assertEqual(self.args(1, 48).start, 1)

    def test_strict_version_quality_and_soundtrack(self):
        for version in [None, '4.3.3']:
            bad = {**self.c, 'blender_version': version}
            with self.assertRaises(ValueError):
                runner.require_range_config(bad)
        with self.assertRaises(ValueError):
            runner.require_range_config({**self.c, 'audio_file': None})
        bad = copy.deepcopy(self.c)
        bad['render']['samples'] = 48
        common.atomic_json(self.config_path, bad)
        with self.assertRaisesRegex(ValueError, 'render settings'):
            common.load_config(self.config_path)

    def test_existing_frames_reuse_and_selected_project_paths(self):
        for frame in (1, 484, 700):
            self.frame(frame)
        ctl = self.controller()
        with patch.object(runner, 'encode_segment', side_effect=self.fake_encoder):
            ctl.render(self.args())
        self.assertEqual([self.batch(call[0]) for call in ctl.calls], [[481, 482], [483]])
        cmd = ctl.calls[0][0]
        self.assertEqual(cmd[cmd.index('--python')+1], str(self.project/'source'/'render_chunk_v5.py'))
        self.assertEqual(cmd[cmd.index('-b')+1], str(self.project/'frozen.blend'))
        self.assertEqual(self.encoded[5:8], (481, 484, 'motion_QA_0481_0484'))
        self.assertEqual(ctl.snapshot()['requested_complete'], 4)
        self.assertEqual(ctl.snapshot()['total_complete'], 6)
        self.assertEqual(ctl.snapshot()['contiguous_complete'], 1)
        self.assertFalse(ctl.state['visual_approval'])
        self.assertFalse(ctl.state['full_film_authorized'])
        # The unmodified standard scanner accepts the exact same paths/sidecars.
        good, bad = common.scan_frames(self.root, self.c, self.fp)
        self.assertEqual(set(good), {1, 481, 482, 483, 484, 700})
        self.assertEqual(bad, {})

    def test_false_trueframe_and_old_identity_are_quarantined(self):
        self.frame(481, frame=480)
        self.frame(482, config_sha256='0'*64)
        ctl = self.controller(481, 482)
        with patch.object(runner, 'encode_segment', side_effect=self.fake_encoder):
            ctl.render(self.args(481, 482))
        quarantined = list((self.root/'failed_artifacts').iterdir())
        self.assertEqual(len(quarantined), 4)
        old = [json.loads(p.read_text()) for p in quarantined if '.json.' in p.name]
        self.assertIn(480, [m['frame'] for m in old])
        self.assertIn('0'*64, [m['config_sha256'] for m in old])
        self.assertEqual([self.batch(c[0]) for c in ctl.calls], [[481, 482]])

    def test_partial_failure_retries_only_missing_with_bounded_threads(self):
        ctl = self.controller(481, 483)
        def fail_then_recover(cmd, log, phase):
            if len(ctl.calls) == 1:
                self.frame(481)
                raise ProcessFailure('synthetic memory guard', guard=True)
            if len(ctl.calls) == 2:
                raise ProcessFailure('synthetic timeout')
            for f in self.batch(cmd):
                self.frame(f)
        ctl.on_run = fail_then_recover
        with patch.object(runner, 'encode_segment', side_effect=self.fake_encoder):
            ctl.render(self.args(481, 483))
        self.assertEqual([self.batch(c[0]) for c in ctl.calls], [[481, 482], [482], [482], [483]])
        self.assertEqual([c[0][c[0].index('--threads')+1] for c in ctl.calls], ['8', '8', '4', '4'])
        self.assertTrue(all(c[2] == 1800 for c in ctl.calls))

    def test_exhaustion_preserves_artifact_and_never_encodes(self):
        ctl = self.controller(481, 481)
        def fail(cmd, log, phase):
            common.frame_paths(self.root, 481)[0].write_bytes(b'partial-render')
            raise ProcessFailure('synthetic failure')
        ctl.on_run = fail
        with patch.object(runner, 'encode_segment') as encode:
            with self.assertRaisesRegex(RuntimeError, 'retry budget exhausted'):
                ctl.render(self.args(481, 481, '--max-attempts', '2'))
            encode.assert_not_called()
        self.assertEqual(len(ctl.calls), 2)
        self.assertEqual(len(list((self.root/'failed_artifacts').iterdir())), 2)
        self.assertEqual(ctl.state['status'], 'failed')

    def test_midrun_source_change_is_fatal_before_encode(self):
        ctl = self.controller(481, 481)
        def change_source(cmd, log, phase):
            self.frame(481)
            (self.project/'frozen.blend').write_bytes(b'changed')
        ctl.on_run = change_source
        with patch.object(runner, 'encode_segment') as encode:
            with self.assertRaisesRegex(ValueError, 'SHA256 mismatch'):
                ctl.render(self.args(481, 481))
            encode.assert_not_called()

    def test_midrun_config_change_is_fatal_before_encode(self):
        ctl = self.controller(481, 481)
        def change_config(cmd, log, phase):
            self.frame(481)
            common.atomic_json(self.config_path, {**self.c, 'production_id': 'different-v5-source'})
        ctl.on_run = change_config
        with patch.object(runner, 'encode_segment') as encode:
            with self.assertRaisesRegex(RuntimeError, 'config changed'):
                ctl.render(self.args(481, 481))
            encode.assert_not_called()

    def test_verify_only_preserves_invalids_and_no_process(self):
        self.frame(481, blender_version='4.3.3')
        ctl = self.controller(481, 482)
        with patch.object(runner, 'encode_segment') as encode:
            ctl.render(self.args(481, 482, '--verify-only'))
            encode.assert_not_called()
        self.assertEqual(ctl.calls, [])
        self.assertTrue(common.frame_paths(self.root, 481)[0].exists())
        self.assertEqual(ctl.snapshot()['requested_missing'], [481, 482])

    def test_encode_only_refuses_missing_without_render(self):
        ctl = self.controller(481, 482)
        with patch.object(runner, 'encode_segment') as encode:
            with self.assertRaisesRegex(RuntimeError, 'missing 2'):
                ctl.render(self.args(481, 482, '--encode-only'))
            encode.assert_not_called()
        self.assertEqual(ctl.calls, [])

    def test_inherits_guards_and_shared_lock(self):
        self.assertIs(runner.RangeController.run, Controller.run)
        self.assertIs(runner.RangeController.terminate_child, Controller.terminate_child)
        with common.render_lock(self.config_path):
            with self.assertRaisesRegex(RuntimeError, 'busy'):
                with common.render_lock(self.config_path):
                    pass

    def test_refuses_different_selected_project_helper(self):
        (self.project/'source'/'render_chunk_v5.py').write_text('changed helper')
        with self.assertRaisesRegex(RuntimeError, 'helper mismatch'):
            runner.configured_chunk(self.config_path)

    def test_real_encoder_contract_audio_offset_full_decode_and_reuse(self):
        # Execute the existing encoder logic, replacing external media processing.
        ctl = self.controller(481, 482)
        good = {f: self.frame(f) for f in (481, 482)}
        commands = []
        def fake_run(cmd, log, phase, timeout):
            commands.append((cmd, phase))
            Path(log).write_text('')
            if phase == 'encode':
                Path(cmd[-1]).write_bytes(b'NOT MEDIA: encoder contract output')
        with patch.object(encoder, 'probe_media', return_value={'mocked': True}) as probe:
            output, meta = encoder.encode_segment(self.config_path, self.c, self.fp, self.root,
                                                 good, 481, 482, 'test_contract', fake_run)
            encoder.encode_segment(self.config_path, self.c, self.fp, self.root,
                                   good, 481, 482, 'test_contract', fake_run)
        cmd = commands[0][0]
        self.assertEqual(cmd[cmd.index('-ss')+1], '20.000000000')
        self.assertEqual(cmd[cmd.index('-start_number')+1], '481')
        self.assertEqual(cmd[cmd.index('-frames:v')+1], '2')
        self.assertEqual([phase for _, phase in commands], ['encode', 'decode', 'decode'])
        self.assertTrue(all('-xerror' in c and '-err_detect' in c
                            for c, phase in commands if phase == 'decode'))
        self.assertEqual(probe.call_count, 2)
        self.assertEqual(meta['config_sha256'], self.fp)
        self.assertEqual(meta['first_frame'], 481)
        self.assertTrue(meta['full_decode_zero_errors'])

    def test_encoder_decode_diagnostics_prevent_publication(self):
        self.controller(481, 481)
        good = {481: self.frame(481)}
        def bad_decode(cmd, log, phase, timeout):
            Path(log).write_text('synthetic decode error' if phase == 'decode' else '')
            if phase == 'encode':
                Path(cmd[-1]).write_bytes(b'NOT MEDIA: deliberately invalid test output')
        with patch.object(encoder, 'probe_media', return_value={'mocked': True}):
            with self.assertRaisesRegex(RuntimeError, 'Full decode reported diagnostics'):
                encoder.encode_segment(self.config_path, self.c, self.fp, self.root,
                                       good, 481, 481, 'bad_decode_contract', bad_decode)
        self.assertFalse((self.root/'checkpoints'/'bad_decode_contract.mp4').exists())
        self.assertFalse((self.root/'checkpoints'/'bad_decode_contract.json').exists())
        self.assertEqual(len(list((self.root/'checkpoints').glob('*.partial.mp4'))), 1)


if __name__ == '__main__':
    unittest.main(verbosity=2)
