import os
import pathlib
import subprocess

root = pathlib.Path('/private/tmp/haru-issue279-test-contract-20261019')
source = root / 'frontend/src/app/utils/assistantRecommendations.ts'
original = source.read_text()
cases = [
    ('strong2', 'const STRONG_KEYWORD_SCORE = 3;', 'const STRONG_KEYWORD_SCORE = 2;', '강한 단어 3점'),
    ('strong4', 'const STRONG_KEYWORD_SCORE = 3;', 'const STRONG_KEYWORD_SCORE = 4;', '강한 단어 3점'),
    ('weak0', 'const WEAK_KEYWORD_SCORE = 1;', 'const WEAK_KEYWORD_SCORE = 0;', '강한 단어 3점'),
    ('weak2', 'const WEAK_KEYWORD_SCORE = 1;', 'const WEAK_KEYWORD_SCORE = 2;', '강한 단어 3점'),
    ('suffix-anxiety', "'불안감',", "'불안감', '불안감소',", '임의 접미사를 차단한다: 불안감소'),
    ('suffix-worry', "'걱정스럽다',", "'걱정스럽다', '걱정스럽다고',", '임의 접미사를 차단한다: 걱정스럽다고'),
    ('suffix-repeat', "'걱정돼요',", "'걱정돼요', '걱정돼요요',", '임의 접미사를 차단한다: 걱정돼요요'),
]
try:
    for name, before, after, pattern in cases:
        assert before in original
        source.write_text(original.replace(before, after, 1))
        result = subprocess.run(['node', '--import', 'tsx', '--test', '--test-name-pattern', pattern, 'test/assistantRecommendations.test.mjs'], cwd=root / 'frontend', capture_output=True, text=True)
        pathlib.Path(f'/private/tmp/haru-issue279-{name}.log').write_text(result.stdout + result.stderr)
        assert result.returncode == 1 and 'AssertionError' in result.stdout + result.stderr, (name, result.stdout, result.stderr)
        print(f'{name}: regression detected', flush=True)
finally:
    source.write_text(original)

env = os.environ.copy()
for key in ['API_KEY', 'AUTH_DOMAIN', 'PROJECT_ID', 'STORAGE_BUCKET', 'MESSAGING_SENDER_ID', 'APP_ID']:
    env[f'VITE_FIREBASE_{key}'] = 'issue279-build-placeholder'
with open('/private/tmp/haru-issue279-build.log', 'w') as log:
    result = subprocess.run(['npm', 'run', 'build'], cwd=root / 'frontend', env=env, stdout=log, stderr=subprocess.STDOUT)
print(f'build exit: {result.returncode}', flush=True)
raise SystemExit(result.returncode)
