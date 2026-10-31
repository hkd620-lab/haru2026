"""의도치 않게 올라간 런타임 전이 패키지 항목을 main lock 값으로 되돌린다."""
import json
import pathlib
import subprocess

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
KEYS = ['node_modules/' + n for n in ['@floating-ui/core', '@floating-ui/dom', '@floating-ui/react-dom', '@floating-ui/utils',
                                      'fast-equals', 'framer-motion', 'motion-dom', 'motion-utils']]
base = json.loads(subprocess.run(['git', 'show', 'a8a8a6b8:frontend/package-lock.json'], cwd=WORK, capture_output=True, text=True, check=True).stdout)['packages']
path = WORK / 'frontend/package-lock.json'
lock = json.loads(path.read_text(encoding='utf-8'))
for key in KEYS:
    before = lock['packages'][key]['version']
    lock['packages'][key] = base[key]
    print(key, before, '->', base[key]['version'])
path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
