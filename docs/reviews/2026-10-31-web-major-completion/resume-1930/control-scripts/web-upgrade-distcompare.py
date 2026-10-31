"""기준선과 최종 dist의 정적 파일·manifest·SW·번들 역할을 비교해 JSON과 표준출력으로 남긴다.

사용: python3 web-upgrade-distcompare.py <기준dist> <최종dist>
"""
import hashlib
import json
import pathlib
import re
import sys

base, cur = pathlib.Path(sys.argv[1]), pathlib.Path(sys.argv[2])
out = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031/docs/reviews/2026-10-31-web-major-completion/dist-info/final-vs-baseline.json')


def listing(root):
    return {str(p.relative_to(root)): hashlib.sha256(p.read_bytes()).hexdigest() for p in sorted(root.rglob('*')) if p.is_file()}


def role(name):
    return re.sub(r'-[A-Za-z0-9_-]{8}(\.[a-z]+)$', r'\1', name)


def sw_policy(root):
    sw = (root / 'sw.js').read_text(encoding='utf-8')
    urls = re.findall(r'url:"([^"]+)"', sw)
    runtime = re.findall(r'registerRoute\((/.*?/[a-z]*),new [a-zA-Z]+\.(\w+)', sw)
    return dict(
        precache=len(urls),
        non_asset_precache=sorted(u for u in urls if not u.startswith('assets/')),
        import_landing='sw-landing-refresh.js' in sw,
        skip_waiting='skipWaiting' in sw,
        clients_claim='clientsClaim' in sw,
        cleanup='cleanupOutdatedCaches' in sw,
        navigation_route='NavigationRoute' in sw,
        runtime=runtime,
    )


a, b = listing(base), listing(cur)
static_a = {k: v for k, v in a.items() if not k.startswith('assets/')}
static_b = {k: v for k, v in b.items() if not k.startswith('assets/')}
generated = {'index.html', 'sw.js'}
assets_a, assets_b = {k for k in a if k.startswith('assets/')}, {k for k in b if k.startswith('assets/')}
hashed_same = sorted(assets_a & assets_b)
role_a, role_b = {role(k) for k in assets_a}, {role(k) for k in assets_b}
pa, pb = sw_policy(base), sw_policy(cur)
report = dict(
    file_count=[len(a), len(b)],
    static_only_base=sorted(set(static_a) - set(static_b)),
    static_only_final=sorted(set(static_b) - set(static_a)),
    static_changed=sorted(k for k in set(static_a) & set(static_b) if static_a[k] != static_b[k] and k not in generated),
    generated_changed=sorted(k for k in generated if static_a.get(k) != static_b.get(k)),
    manifest_identical=(base / 'manifest.webmanifest').read_bytes() == (cur / 'manifest.webmanifest').read_bytes(),
    asset_count=[len(assets_a), len(assets_b)],
    asset_identical_hash_names=len(hashed_same),
    asset_roles_only_base=sorted(role_a - role_b),
    asset_roles_only_final=sorted(role_b - role_a),
    sw_base=pa,
    sw_final=pb,
    sw_policy_same={k: pa[k] == pb[k] for k in pa if k != 'precache'},
)
out.write_text(json.dumps(report, ensure_ascii=False, indent=1), encoding='utf-8')
print(json.dumps({k: v for k, v in report.items() if k not in ('sw_base', 'sw_final')}, ensure_ascii=False, indent=1)[:5000])
print('runtime base', pa['runtime'])
print('runtime final', pb['runtime'])
