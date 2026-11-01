"""동반 패키지의 최소 호환·최신 패치를 판단하기 위한 버전별 peer/의존성 조회."""
import json
import pathlib
import subprocess

out = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/npm-metadata')
env = dict(PATH='/opt/homebrew/opt/node@22/bin:/usr/bin:/bin', HOME=str(pathlib.Path.home()), NO_COLOR='1')


def view(spec, *fields):
    r = subprocess.run(['npm', 'view', spec, '--json'] + list(fields), capture_output=True, text=True, env=env)
    return r.stdout


report = dict()
for spec, fields in [
    ('vite-plugin-pwa@1', ['version', 'peerDependencies', 'engines']),
    ('@tailwindcss/vite@4', ['version', 'peerDependencies']),
    ('react-day-picker@9', ['version', 'peerDependencies', 'dependencies']),
    ('recharts@2', ['version', 'peerDependencies', 'dependencies']),
    ('vite@8', ['version']),
    ('react@19', ['version']),
    ('react-router@8', ['version']),
]:
    raw = view(spec, *fields)
    report[spec] = json.loads(raw) if raw.strip() else None
(out / 'version-ranges.json').write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
for spec, data in report.items():
    rows = data if isinstance(data, list) else [data]
    if rows and isinstance(rows[0], dict):
        print(spec)
        for row in rows[-30:]:
            peer = row.get('peerDependencies', dict())
            brief = dict((k, v) for k, v in peer.items() if k in ('vite', 'react', 'react-is', 'react-dom'))
            print('  ', row.get('version'), brief, 'react-is dep', row.get('dependencies', dict()).get('react-is'))
    else:
        print(spec, rows[-8:])
