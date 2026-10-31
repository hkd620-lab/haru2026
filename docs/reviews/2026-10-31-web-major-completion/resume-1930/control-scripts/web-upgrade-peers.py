"""lock의 모든 패키지 peer 범위를 후보 버전과 대조하고 react-is 사용처를 찾는다.

사용: python3 web-upgrade-peers.py [react버전] [vite버전]
"""
import json
import pathlib
import subprocess
import sys

WORK = pathlib.Path('/private/tmp/haru-completion-web-upgrade-20261031')
react_v = sys.argv[1] if len(sys.argv) > 1 else '19.3.1'
vite_v = sys.argv[2] if len(sys.argv) > 2 else '8.3.5'
lock = json.loads((WORK / 'frontend/package-lock.json').read_text())
pkgs = lock['packages']
check = dict(react=react_v, vite=vite_v)
check['react-dom'] = react_v
check['@types/react'] = '19.3.0'
items = []
for key, meta in pkgs.items():
    if not key:
        continue
    for name, version in check.items():
        rng = meta.get('peerDependencies', dict()).get(name)
        if rng:
            items.append([key.replace('node_modules/', '', 1), meta.get('version'), name, version, rng,
                          bool(meta.get('peerDependenciesMeta', dict()).get(name, dict()).get('optional'))])
js = """
const semver=require('semver');
const items=JSON.parse(require('fs').readFileSync(0,'utf8'));
for(const [pkg,ver,name,target,rng,opt] of items){
  if(!semver.satisfies(target,rng,{includePrerelease:true})) console.log('CONFLICT',pkg+'@'+ver,name,'needs',rng,'target',target,opt?'(optional)':'');
}
console.log('checked',items.length);
"""
env = dict(PATH='/opt/homebrew/opt/node@22/bin:/usr/bin:/bin', HOME=str(pathlib.Path.home()), NODE_PATH=str(WORK / 'frontend/node_modules'))
r = subprocess.run(['node', '-e', js], input=json.dumps(items), text=True, capture_output=True, env=env, cwd=WORK / 'frontend')
print(r.stdout, r.stderr[:800])
print('--- react-is')
for key, meta in pkgs.items():
    if key.endswith('node_modules/react-is'):
        print(key, meta.get('version'))
    d = meta.get('dependencies', dict())
    if 'react-is' in d or 'react-is' in meta.get('peerDependencies', dict()):
        print(' used by', key, meta.get('version'), d.get('react-is'), meta.get('peerDependencies', dict()).get('react-is'))
