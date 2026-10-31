"""공식 이행 문서 원문을 증거 폴더에 저장하고 텍스트로 변환한다."""
import html
import pathlib
import re
import urllib.request

out = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/official-docs')
out.mkdir(parents=True, exist_ok=True)
urls = dict(
    vite_migration='https://vite.dev/guide/migration.html',
    vite7_migration='https://v7.vite.dev/guide/migration',
    react_router_upgrading_v7='https://reactrouter.com/upgrading/v7',
    react19_upgrade='https://react.dev/blog/2024/04/25/react-19-upgrade-guide',
    react_router_changelog='https://raw.githubusercontent.com/remix-run/react-router/main/CHANGELOG.md',
)
for name, url in urls.items():
    try:
        req = urllib.request.Request(url, headers=dict(Accept='text/html,text/markdown,*/*'))
        raw = urllib.request.urlopen(req, timeout=40).read().decode('utf-8', 'replace')
    except Exception as e:
        print(name, 'ERR', e)
        continue
    t = raw
    if '<html' in raw[:2000].lower():
        t = re.sub(r'(?is)<(script|style|svg)[^>]*>.*?</\1>', ' ', raw)
        t = re.sub(r'(?i)<(/p|/h\d|/li|br|/pre|/tr)[^>]*>', '\n', t)
        t = html.unescape(re.sub(r'<[^>]+>', '', t))
        t = re.sub(r'\n\s*\n+', '\n\n', t)
    (out / f'{name}.txt').write_text(f'# source: {url}\n# fetched: 2026-10-31\n\n{t}', encoding='utf-8')
    print(name, len(raw), len(t))
