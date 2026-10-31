"""frontend/dist의 파일 목록·크기·해시·SW 정책을 JSON으로 기록해 빌드 전후를 비교한다.

사용: python3 web-upgrade-distinfo.py <라벨>
"""
import hashlib
import json
import pathlib
import re
import sys

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
DIST = WORK / 'frontend/dist'
label = sys.argv[1]
files = dict()
for p in sorted(DIST.rglob('*')):
    if p.is_file():
        rel = str(p.relative_to(DIST))
        files[rel] = dict(size=p.stat().st_size, sha256=hashlib.sha256(p.read_bytes()).hexdigest())
sw = (DIST / 'sw.js').read_text(encoding='utf-8')
precache_urls = re.findall(r'url:"([^"]+)"', sw)
assets = [f for f in files if f.startswith('assets/')]
index_html = (DIST / 'index.html').read_text(encoding='utf-8')
info = dict(
    label=label,
    file_count=len(files),
    total_bytes=sum(f['size'] for f in files.values()),
    asset_count=len(assets),
    js_count=sum(1 for f in assets if f.endswith('.js')),
    legacy_js_count=sum(1 for f in assets if '-legacy' in f and f.endswith('.js')),
    css_count=sum(1 for f in assets if f.endswith('.css')),
    largest=sorted(((files[f]['size'], f) for f in files), reverse=True)[:8],
    over_6mib_files=[f for f in files if files[f]['size'] > 6 * 1024 * 1024],
    sw=dict(
        precache_count=len(precache_urls),
        import_scripts=re.findall(r'importScripts\(([^)]*)\)', sw),
        skip_waiting='skipWaiting' in sw,
        clients_claim='clientsClaim' in sw,
        cleanup_outdated='cleanupOutdatedCaches' in sw,
        navigation_route='NavigationRoute' in sw,
        unprecached_js=[f for f in assets if f.endswith('.js') and f not in precache_urls],
        missing_targets=[u for u in precache_urls if not (DIST / u.split('?')[0]).exists()],
    ),
    index_html=dict(
        modulepreload=len(re.findall(r'rel="modulepreload"', index_html)),
        module_scripts=re.findall(r'<script[^>]*type="module"[^>]*>', index_html),
        nomodule_scripts=re.findall(r'<script[^>]*nomodule[^>]*>', index_html),
    ),
    files=files,
)
out = WORK / f'docs/reviews/2026-10-31-web-major-completion/dist-info/{label}.json'
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(json.dumps(info, ensure_ascii=False, indent=1), encoding='utf-8')
brief = dict((k, v) for k, v in info.items() if k != 'files')
print(json.dumps(brief, ensure_ascii=False, indent=1)[:3500])
