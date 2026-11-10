#!/usr/bin/env python3
"""Exclusive private packaging after review; invoked only by registered group runner.
No build/install/network/simulation. Partial outputs are retained, never overwritten.
"""
from pathlib import Path
import datetime, gzip, hashlib, json, os, zipfile

ROOT = Path(__file__).resolve().parents[3]
OUT = Path(__file__).resolve().parent
SOURCE = ROOT / 'iron-route-grounded-freight-yard-source-candidate.zip'
DEVICE = ROOT / 'iron-route-grounded-freight-yard-device-candidate.zip'
MANIFEST = ROOT / 'grounded-source-entry-manifest.json'
HANDOFF = ROOT / 'GROUNDED_ARTIFACT_HANDOFF.json'
EXCLUDED_DIRS = {'node_modules', '.git', '__pycache__', 'replay-mirror'}
EXCLUDED_ROOT = {SOURCE.name, DEVICE.name, MANIFEST.name, HANDOFF.name,
                 'GROUNDED_LIBRARY_HANDOFF.json'}


def now():
    return datetime.datetime.now(datetime.timezone.utc).isoformat()


def digest(data):
    return hashlib.sha256(data).hexdigest()


def row(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for block in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(block)
    return {'bytes': path.stat().st_size, 'sha256': h.hexdigest()}


def read(path):
    return json.loads(path.read_text())


def save_new(path, value):
    with path.open('x') as stream:
        json.dump(value, stream, ensure_ascii=False, indent=2)
        stream.write('\n')


def tree(root):
    for folder, dirs, files in os.walk(root, followlinks=False):
        dirs[:] = sorted(d for d in dirs if d not in EXCLUDED_DIRS
                         and not (Path(folder) / d).is_symlink())
        for name in sorted(files):
            p = Path(folder) / name
            if p.is_file() and not p.is_symlink():
                yield p


def source_selected(path):
    rel = path.relative_to(ROOT)
    if len(rel.parts) == 1 and (path.name in EXCLUDED_ROOT or path.suffix == '.zip'):
        return False
    if path.parent == OUT and (path.name.startswith('01-freeze')
                              or path.name == 'freeze-registration.json'):
        return False
    return True


def audit_zip(path, expected):
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        assert len(names) == len(set(names)) == len(expected)
        assert set(names) == set(expected)
        assert archive.testzip() is None
        for name in names:
            parts = Path(name).parts
            assert not name.startswith('/') and '..' not in parts
            assert not EXCLUDED_DIRS.intersection(parts)
            data = archive.read(name)
            assert {'bytes': len(data), 'sha256': digest(data)} == expected[name], name
    return {'archive': path.name, **row(path), 'entries': len(expected),
            'allEntryHashesVerified': True, 'crcVerified': True}


def main():
    registration = read(OUT / 'freeze-registration.json')
    assert registration['exclusiveAttempt'] == 1
    assert registration['workerSHA256'] == row(Path(__file__))['sha256']
    for p in [SOURCE, DEVICE, MANIFEST, HANDOFF, OUT / 'pre-freeze-audit.json']:
        assert not p.exists(), ('Inspect prior outcome; never overwrite', str(p))
    approval = read(OUT / 'freeze-approval.json')
    assert approval['privateFreezeApproved'] and approval['requiredFindingsOpen'] == 0
    assert approval['compositeGateAccepted'] and not approval['zeroFailureFullSuiteClaim']
    review = ROOT / approval['wholeReviewPath']
    assert row(review)['sha256'] == approval['wholeReviewSHA256']
    assert 'Ready to freeze private Mac/source candidate: YES.' in review.read_text()
    head_path = ROOT / approval['reviewHeadPath']
    assert row(head_path)['sha256'] == approval['reviewHeadSHA256']
    head = read(head_path)
    for name, expected in head['files'].items():
        assert row(ROOT / name) == expected, ('Reviewed head drift', name)

    identity_path = ROOT / 'evidence/grounded/final/final-identity.json'
    identity = read(identity_path)
    assert row(identity_path)['sha256'] == approval['finalIdentitySHA256']
    actual_head = {str(p.relative_to(ROOT)): row(p)['sha256']
                   for folder in ['work/src', 'work/tests', 'work/scripts', 'work/assets']
                   for p in tree(ROOT / folder)}
    assert actual_head == identity['sourceHead']
    assert digest(json.dumps(actual_head, sort_keys=True, separators=(',', ':')).encode()) == identity['sourceHeadSHA256']
    pre = read(ROOT / 'evidence/grounded/final/pre-suite-identity.json')
    drift = {n for n in actual_head if actual_head[n] != pre['sourceHead'][n]}
    assert drift == {'work/tests/battlefront-depot-scope.test.mjs',
                     'work/tests/crossfire-v4-front.test.mjs'}
    results = read(ROOT / 'evidence/grounded/final/test-results.json')
    assert results['fullSuite']['counts'] == {'tests': 1117, 'pass': 1094, 'fail': 2,
                                            'cancelled': 0, 'skipped': 21}
    assert not results['fullSuiteIsZeroFailure']
    for name, expected_exit in [('06-full-suite', 1), ('08-guards', 0), ('09-final-integrity', 0)]:
        terminal = read(ROOT / f'evidence/grounded/g2/{name}-terminal.json')
        assert terminal['exitCode'] == expected_exit and not terminal['timedOut']
        assert terminal['sourceIdentityUnchanged'] and not terminal['livingGroupAfterWait']
    assert results['finalFocusedRecovery']['pass'] == 2
    assert results['finalFocusedRecovery']['fail'] == 0

    base = read(ROOT / 'evidence/grounded/BASE.json')
    changes = {e['path']: e['new'] for e in identity['inheritedChanges']}
    for e in base['entries']:
        assert row(ROOT / e['path'])['sha256'] == changes.get(e['path'], e['sha256']), e['path']
    expected_work = {e['path'] for e in base['entries'] if e['path'].startswith('work/')}
    expected_work.update(actual_head)
    assert {str(p.relative_to(ROOT)) for p in tree(ROOT / 'work')} == expected_work
    parent = ROOT.parent / 'battlefront_depot_candidate'
    for e in base['entries']:
        if any(e['path'].startswith(prefix) for prefix in ['work/src/', 'work/tests/', 'work/scripts/', 'work/assets/']):
            assert row(parent / e['path']) == {'bytes': e['bytes'], 'sha256': e['sha256']}
    for name, expected in identity['protectedPredecessorArchives'].items():
        assert row(ROOT.parent / name)['sha256'] == expected, ('Predecessor archive drift', name)
    for route in ['direct', 'covered']:
        p = ROOT / f'evidence/battlefront/bf1/route-qa/sandfalcon-{route}-result.json.gz'
        raw = json.loads(gzip.decompress(p.read_bytes()))
        assert len(raw['sourceSnapshot']) == 31
        for name, source in raw['sourceSnapshot'].items():
            data = (ROOT / 'work' / name).read_bytes()
            assert data.decode() == source and digest(data) == raw['sourceHashes'][name]

    builds = read(ROOT / 'evidence/grounded/final/full-suite-builds.json')
    for folder, files in builds.items():
        for name, expected in files.items():
            assert row(ROOT / 'work' / folder / name) == expected
        manifest = read(ROOT / 'work' / folder / 'build-manifest.json')
        assert manifest['browserVerified'] is False and manifest['runtimeRequestsMeasured'] is False
        assert manifest['sweepAcceleration']['resolved'] == 'src/ruined-depot-world-accelerated.js'
    gate = {'utc': now(), 'privateFreezeApproved': True, 'requiredFindingsOpen': 0,
            'compositeGateAccepted': True, 'zeroFailureFullSuiteClaim': False,
            'fullSuite': results['fullSuite']['counts'], 'focusedRecovery': {'pass': results['finalFocusedRecovery']['pass'], 'fail': results['finalFocusedRecovery']['fail']},
            'sourceHeadSHA256': identity['sourceHeadSHA256'], 'wholeReviewSHA256': approval['wholeReviewSHA256'],
            'browserVerified': False, 'macPerformanceFixProved': False, 'publicReleaseApproved': False}
    save_new(OUT / 'pre-freeze-audit.json', gate)
    selected = [p for p in tree(ROOT) if source_selected(p)]
    rows = {str(p.relative_to(ROOT)): row(p) for p in selected}
    assert {e['path'] for e in base['entries']}.issubset(rows)
    for name, expected in head['files'].items():
        assert rows[name] == expected
    save_new(MANIFEST, {'candidate': 'grounded-freight-yard-private-source', 'reviewGate': gate,
                        'files': rows, 'excluded': sorted(EXCLUDED_DIRS),
                        'sourceScope': 'Current runtime/source/tests/fixtures/evidence; historical authoring originals remain in unchanged predecessor source packages.',
                        'privateOnly': True})
    selected.append(MANIFEST)
    rows[MANIFEST.name] = row(MANIFEST)
    with zipfile.ZipFile(SOURCE, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for p in selected:
            archive.write(p, str(p.relative_to(ROOT)))
    source_result = audit_zip(SOURCE, rows)

    device = {}
    offline = ['dist/铁流_电脑浏览器离线版.html', 'dist-en/Iron_Route_Desktop_Offline.html']
    for name in offline:
        device[name] = (ROOT / 'work' / name).read_bytes()
    for folder in ['dist', 'dist-en']:
        for name in ['THREE_LICENSE.txt', 'game.js.LEGAL.txt', 'build-manifest.json', 'build-metafile.json']:
            device[f'{folder}/{name}'] = (ROOT / 'work' / folder / name).read_bytes()
    for p in tree(ROOT / 'work/licenses'):
        device[str(p.relative_to(ROOT / 'work'))] = p.read_bytes()
    for p in tree(ROOT / 'credits'):
        device[str(p.relative_to(ROOT))] = p.read_bytes()
    for folder in ['art-kit', 'armor', 'terrain', 'ruined-depot']:
        device[f'credits/assets-{folder}.md'] = (ROOT / 'work/assets' / folder / 'README.md').read_bytes()
    device['credits/ORIGINAL_TANK_PROVENANCE.md'] = (ROOT / 'work/assets/PROVENANCE.md').read_bytes()
    for p in tree(ROOT / 'work/src/terrain-candidate/vendor'):
        if 'license' in p.name.lower() or 'readme' in p.name.lower():
            device['credits/vendor/' + str(p.relative_to(ROOT / 'work/src/terrain-candidate/vendor'))] = p.read_bytes()
    for locale, target in zip(['CN', 'EN'], offline):
        device[f'Open_Grounded_Freight_Yard_{locale}.html'] = f'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url={target}?sortie=battlefront-depot"><a href="{target}?sortie=battlefront-depot">Open Grounded Freight Yard ({locale})</a>'.encode()
    device['MAC_ACCEPTANCE_PENDING.md'] = (ROOT / 'evidence/grounded/MAC_ACCEPTANCE_PENDING.md').read_bytes()
    device['WHOLE_REVIEW.md'] = review.read_bytes()
    device['CONTROLLER_DISPOSITION.json'] = (OUT / 'freeze-approval.json').read_bytes()
    device['RULINGS_MADE.md'] = (ROOT / 'evidence/grounded/RULINGS_MADE.md').read_bytes()
    device['README.txt'] = (ROOT / 'START_HERE_GROUNDED.md').read_bytes()
    device_rows = {n: {'bytes': len(data), 'sha256': digest(data)} for n, data in device.items()}
    dm = {'candidate': 'grounded-freight-yard-private-device', 'sourceArchive': source_result,
          'reviewGate': gate, 'files': device_rows, 'browserVerified': False,
          'macPerformanceFixProved': False, 'publicReleaseApproved': False}
    data = (json.dumps(dm, ensure_ascii=False, indent=2) + '\n').encode()
    device['grounded-device-exact-manifest.json'] = data
    device_rows['grounded-device-exact-manifest.json'] = {'bytes': len(data), 'sha256': digest(data)}
    with zipfile.ZipFile(DEVICE, 'x', zipfile.ZIP_DEFLATED, compresslevel=6) as archive:
        for name, data in device.items():
            archive.writestr(name, data)
    device_result = audit_zip(DEVICE, device_rows)
    for p in selected:
        assert row(p) == rows[str(p.relative_to(ROOT))], ('Changed during freeze', str(p))
    for name, expected in identity['protectedPredecessorArchives'].items():
        assert row(ROOT.parent / name)['sha256'] == expected
    for e in base['entries']:
        if any(e['path'].startswith(prefix) for prefix in ['work/src/', 'work/tests/', 'work/scripts/', 'work/assets/']):
            assert row(parent / e['path']) == {'bytes': e['bytes'], 'sha256': e['sha256']}
    save_new(HANDOFF, {'utc': now(), 'status': 'frozen-and-ZIP-verified', 'source': source_result,
                       'device': device_result, 'reviewGate': gate,
                       'allSelectedCurrentAndZipBytesExact': True, 'predecessorArchivesExact': 12,
                       'sourceEntryManifestSHA256': row(MANIFEST)['sha256'], 'uploadAttempted': False})
    print(json.dumps(read(HANDOFF), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    main()
