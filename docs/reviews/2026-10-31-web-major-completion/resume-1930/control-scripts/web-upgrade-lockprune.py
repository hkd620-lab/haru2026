"""재해결이 필요한 낡은 lock 항목만 제거한다. 인자로 받은 키만 지운다."""
import json
import pathlib
import sys

lock_path = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/frontend/package-lock.json')
lock = json.loads(lock_path.read_text(encoding='utf-8'))
for key in sys.argv[1:]:
    print(key, 'removed' if lock['packages'].pop(key, None) else 'absent')
lock_path.write_text(json.dumps(lock, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
