"""Offline candidate preparation only. No upload, deploy, or source deletion."""
import argparse
import copy
import datetime
import difflib
import hashlib
import json
import pathlib
import re
import subprocess
import zipfile

MERGED = '69480ecafdb8b170051e1ea3ae71bb72512f1208'
KEY = 'node_modules/node-forge'
FIELDS = ('version', 'resolved', 'integrity')


def sha(data):
    return hashlib.sha256(data).hexdigest()


def read(path):
    return json.loads(path.read_text())


def save(path, obj):
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2) + '\n')


def patch_lock(original, approved):
    old = json.loads(original)
    assert [k for k in old['packages'] if k.endswith('/node-forge')] == [KEY]
    assert old['packages'][KEY]['version'] == '1.4.0'
    expected = copy.deepcopy(old)
    for field in FIELDS:
        expected['packages'][KEY][field] = approved[field]
    # Preserve every byte outside the three reviewed JSON string values.
    text = original.decode()
    matches = list(re.finditer(r'"node_modules/node-forge"\s*:\s*\{.*?\n    \}', text, re.S))
    assert len(matches) == 1
    match = matches[0]
    block = match.group()
    for field in FIELDS:
        before = json.dumps(old['packages'][KEY][field])
        after = json.dumps(approved[field])
        block, count = re.subn(r'("' + field + r'"\s*:\s*)' + re.escape(before),
                              lambda m: m.group(1) + after, block)
        assert count == 1
    patched = (text[:match.start()] + block + text[match.end():]).encode()
    assert json.loads(patched) == expected
    return patched


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--repo', type=pathlib.Path, required=True)
    parser.add_argument('--originals', type=pathlib.Path, required=True)
    parser.add_argument('--baseline', type=pathlib.Path, required=True)
    parser.add_argument('--build-settings', type=pathlib.Path, required=True)
    parser.add_argument('--output', type=pathlib.Path, required=True)
    args = parser.parse_args()
    prior = args.repo / 'docs/reviews/2026-11-03-pr328-completion'
    comparison = read(prior / 'live-source-comparison.json')
    plan = read(prior / 'source-download-plan.json')
    refs = {x['name']: x for x in read(prior / 'live-source-refs.json')}
    baseline = {x['name']: x for x in read(args.baseline)}
    settings = {x['name']: x for x in read(args.build_settings)}
    approved_bytes = subprocess.check_output(['git', '-C', str(args.repo), 'show',
                                             MERGED + ':functions/package-lock.json'])
    assert sha(approved_bytes) == '76e03c4c6015e6caa55135ef5e4b1bf46460ab433c5627781c33cab5159b40e4'
    approved = json.loads(approved_bytes)['packages'][KEY]
    assert approved['version'] == '1.4.2'
    args.output.mkdir(parents=True, exist_ok=False)
    rows, candidates = [], []
    for group in comparison:
        number = group['group']
        original_path = args.originals / f'group-{number:02d}.zip'
        assert sha(original_path.read_bytes()) == group['zipSha256']
        destination = args.output / f'group-{number:02d}'
        destination.mkdir()
        candidate_path = destination / 'candidate.zip'
        with zipfile.ZipFile(original_path) as original:
            names = original.namelist()
            assert len(names) == len(set(names)), 'Duplicate archive entries'
            assert all(not pathlib.PurePosixPath(n).is_absolute() and '..' not in pathlib.PurePosixPath(n).parts for n in names)
            old_lock = original.read('package-lock.json')
            new_lock = patch_lock(old_lock, approved)
            with zipfile.ZipFile(candidate_path, 'x') as candidate:
                candidate.comment = original.comment
                for info in original.infolist():
                    data = new_lock if info.filename == 'package-lock.json' else original.read(info)
                    candidate.writestr(copy.copy(info), data)
            with zipfile.ZipFile(candidate_path) as candidate:
                assert candidate.namelist() == names
                changed = [n for n in names if sha(original.read(n)) != sha(candidate.read(n))]
                assert changed == ['package-lock.json']
                unchanged_count = len(names) - 1
            (destination / 'package-lock.json').write_bytes(new_lock)
            (destination / 'lock.patch').write_text(''.join(difflib.unified_diff(
                old_lock.decode().splitlines(True), new_lock.decode().splitlines(True),
                fromfile='original/package-lock.json', tofile='candidate/package-lock.json')))
            manifest = json.loads(original.read('package.json'))
            assert not any(manifest.get('scripts', {}).get(k) for k in ['preinstall', 'install', 'postinstall', 'prepare', 'gcp-build'])
            assert not set(names) & {'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb'}
        candidate_info = {
            'group': number, 'functions': group['functions'],
            'originalPath': str(original_path), 'originalSha256': group['zipSha256'],
            'candidatePath': str(candidate_path), 'candidateSha256': sha(candidate_path.read_bytes()),
            'candidateBytes': candidate_path.stat().st_size,
            'originalLockSha256': sha(old_lock), 'candidateLockSha256': sha(new_lock),
            'changedFiles': changed, 'changedLockFields': list(FIELDS),
            'unchangedEntriesVerified': unchanged_count,
            'rebuildDisabledRequired': True,
        }
        candidates.append(candidate_info)
        for item in plan['groups'][number - 1]:
            fn = item['function']
            assert fn in group['functions']
            name = f'projects/haru2026-8abb8/locations/asia-northeast3/functions/{fn}'
            live = baseline[name]
            assert live['buildConfig']['source'] == refs[name]['buildConfig']['source']
            assert live['buildConfig']['runtime'] == 'nodejs22'
            assert live['buildConfig']['entryPoint'] == fn
            assert live['state'] == 'ACTIVE'
            assert settings[name]['buildConfig']['environmentVariables']['GOOGLE_NODE_RUN_SCRIPTS'] == ''
            source = live['buildConfig']['source']['storageSource']
            assert item['url'] == f"gs://{source['bucket']}/{source['object']}#{source['generation']}"
            rows.append({'function': fn, 'group': number, 'name': name,
                         'candidateSha256': candidate_info['candidateSha256'],
                         'priorSource': source, 'priorBuild': live['buildConfig']['build'],
                         'priorRevision': live['serviceConfig']['revision'],
                         'priorUpdateTime': live['updateTime'],
                         'runtime': live['buildConfig']['runtime'],
                         'allTrafficOnLatestRevision': live['serviceConfig'].get('allTrafficOnLatestRevision'),
                         'requiredGoogleNodeRunScripts': '',
                         'proposedUpdateMask': 'buildConfig.source'})
    assert len(rows) == 100 and len({x['function'] for x in rows}) == 100
    save(args.output / 'candidates.json', candidates)
    save(args.output / 'function-matrix.json', sorted(rows, key=lambda x: x['function']))
    summary = {'checkedAt': datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=9))).isoformat(),
               'approvedCommit': MERGED, 'groups': len(candidates), 'functions': len(rows),
               'originalSourceDrift': 0, 'changedFilesPerCandidate': ['package-lock.json'],
               'changedFields': list(FIELDS), 'oldVersion': '1.4.0', 'newVersion': '1.4.2',
               'distinctLockGraphs': len({x['candidateLockSha256'] for x in candidates}),
               'unchangedArchiveEntriesVerified': sum(x['unchangedEntriesVerified'] for x in candidates),
               'candidateBytes': sum(x['candidateBytes'] for x in candidates),
               'buildScriptDisabledForAllTargets': True, 'deployed': False,
               'status': 'LOCAL_CANDIDATES_ONLY_REVIEW_REQUIRED'}
    save(args.output / 'summary.json', summary)
    checksums = {str(p.relative_to(args.output)): sha(p.read_bytes())
                 for p in sorted(args.output.rglob('*')) if p.is_file()}
    save(args.output / 'sha256-manifest.json', checksums)
    assert all(sha((args.output / name).read_bytes()) == digest for name, digest in checksums.items())
    print(json.dumps(summary, ensure_ascii=False))


if __name__ == '__main__':
    main()
