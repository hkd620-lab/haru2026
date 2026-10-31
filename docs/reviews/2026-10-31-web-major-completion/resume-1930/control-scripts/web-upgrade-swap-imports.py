"""react-router-dom import를 react-router로 바꾼다. 실제 소스 파일과 시험 mock 키만 대상이다."""
import pathlib
import re

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/frontend')
FORBIDDEN = ('routes.tsx', 'HaruRawPage.tsx')
targets = list((WORK / 'src').rglob('*.tsx')) + list((WORK / 'src').rglob('*.ts'))
targets += list((WORK / 'test').rglob('*.tsx')) + [WORK / 'test/householdSummary.test.mjs', WORK / 'Navigation.tsx']
changed = []
for p in targets:
    text = p.read_text(encoding='utf-8')
    if p.name in FORBIDDEN:
        # 금지 파일은 절대 쓰지 않는다. 대상 문자열이 있으면 수동 판단이 필요하므로 멈춘다.
        if 'react-router-dom' in text:
            raise SystemExit(f'forbidden file imports react-router-dom: {p}')
        continue
    new, n = re.subn(r"""(['"])react-router-dom\1""", r'\1react-router\1', text)
    if n:
        p.write_text(new, encoding='utf-8')
        changed.append((str(p.relative_to(WORK)), n))
print(len(changed), 'files', sum(n for _, n in changed), 'replacements')
print([c for c in changed if c[1] != 1])
