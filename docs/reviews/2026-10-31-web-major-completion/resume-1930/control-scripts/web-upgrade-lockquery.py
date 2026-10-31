"""lock에서 지정 패키지 버전과 그 패키지를 요구하는 항목을 출력한다."""
import json
import pathlib
import sys

lock = json.loads(pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/frontend/package-lock.json').read_text(encoding='utf-8'))
for name in sys.argv[1:]:
    print('==', name)
    for key, meta in lock['packages'].items():
        if key.endswith('node_modules/' + name):
            print(' at', key, meta.get('version'), 'dev' if meta.get('dev') else '', 'peer' if meta.get('peer') else '')
        for field in ('dependencies', 'peerDependencies', 'optionalDependencies'):
            rng = meta.get(field, dict()).get(name)
            if rng:
                print('  req', key or '(root)', meta.get('version'), field, rng)
