"""npm view 공식 메타데이터 원문을 증거 폴더에 저장하고 요약을 출력한다."""
import json
import pathlib
import subprocess

out = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/npm-metadata')
out.mkdir(parents=True, exist_ok=True)
env = dict(PATH='/opt/homebrew/opt/node@22/bin:/usr/bin:/bin', HOME=str(pathlib.Path.home()), NO_COLOR='1')
fields = ['name', 'version', 'dist-tags', 'engines', 'peerDependencies', 'peerDependenciesMeta', 'dependencies', 'deprecated']
packages = ['vite', 'react-router', 'react-router-dom', 'react', 'react-dom', '@vitejs/plugin-react', '@vitejs/plugin-legacy',
            '@tailwindcss/vite', 'tailwindcss', 'vite-plugin-pwa', 'terser', 'react-day-picker', 'react-popper',
            'react-responsive-masonry', 'react-dnd', 'react-dnd-html5-backend', '@types/react', '@types/react-dom']
for p in packages:
    r = subprocess.run(['npm', 'view', p, '--json'] + fields, capture_output=True, text=True, env=env)
    target = out / (p.replace('/', '__') + '.json')
    target.write_text(r.stdout + (('\n# stderr\n' + r.stderr) if r.stderr else ''), encoding='utf-8')
    try:
        d = json.loads(r.stdout)
    except ValueError:
        print(p, 'ERR', r.stderr[:300])
        continue
    tags = dict((k, v) for k, v in d.get('dist-tags', dict()).items() if k in ('latest', 'next', 'beta', 'rc'))
    print(p, d.get('version'), tags, 'engines', d.get('engines'), 'peer', d.get('peerDependencies'), 'deprecated', d.get('deprecated'))
