import concurrent.futures
import hashlib
import json
import pathlib
import subprocess
import zipfile

root = pathlib.Path('/private/tmp/haru-pr328-20261103')
plan = json.loads((root / 'source-download-plan.json').read_text())
candidate = root / 'functions'
target = root / 'live-source-comparison'
target.mkdir(exist_ok=True)

def compare(item):
    index, group = item
    archive = target / f'group-{index:02d}.zip'
    result = subprocess.run(['gcloud', 'storage', 'cp', group[0]['url'], str(archive)], capture_output=True, text=True)
    if result.returncode:
        return {'group': index, 'functions': [x['function'] for x in group], 'error': 'source download failed', 'exit': result.returncode}
    changed, missing, extra = [], [], []
    packages = {}
    with zipfile.ZipFile(archive) as z:
        entries = {name for name in z.namelist() if not name.endswith('/')}
        # Compare only deployable compiled code and manifests; never read or output .env values.
        selected = {n for n in entries if n.startswith('lib/') and n.endswith(('.js', '.js.map', '.json'))}
        selected |= entries & {'package.json', 'package-lock.json'}
        for name in sorted(selected):
            data = z.read(name)
            local = candidate / name
            if not local.is_file():
                extra.append(name)
            elif hashlib.sha256(local.read_bytes()).digest() != hashlib.sha256(data).digest():
                changed.append(name)
            if name == 'package-lock.json':
                lock = json.loads(data)
                packages = {k: v.get('version') for k, v in lock.get('packages', {}).items() if k in ['node_modules/node-forge', 'node_modules/firebase-admin']}
        local_names = {str(p.relative_to(candidate)) for p in (candidate / 'lib').rglob('*') if p.is_file() and p.suffix in ['.js', '.map', '.json']}
        missing = sorted(local_names - entries)
    return {'group': index, 'functions': [x['function'] for x in group], 'zipSha256': hashlib.sha256(archive.read_bytes()).hexdigest(), 'archiveBytes': archive.stat().st_size, 'comparedFiles': len(selected), 'changed': changed, 'onlyLive': extra, 'onlyCandidate': missing, 'liveLockVersions': packages}

with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
    results = []
    for result in pool.map(compare, enumerate(plan['groups'], 1)):
        results.append(result)
        (root / 'live-source-comparison.json').write_text(json.dumps(results, ensure_ascii=False, indent=2) + '\n')
        print(json.dumps({'group': result['group'], 'functions': len(result['functions']), 'changedFiles': len(result.get('changed', [])), 'error': result.get('error')}, ensure_ascii=False), flush=True)
print('Completed groups', len(results), flush=True)
