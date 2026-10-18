import subprocess,pathlib,json
root=pathlib.Path('/private/tmp/haru-pr270-completion-20261018/frontend')
results=[]
for f in sorted(root.glob('test/*.test.*')):
 if f.suffix not in ('.mjs','.cjs') or 'emulator' in f.name: continue
 cmd=['node','--import','tsx','--test',str(f)] if f.suffix=='.mjs' else ['node',str(f)]
 try:
  r=subprocess.run(cmd,cwd=root,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,timeout=120)
  code,out=r.returncode,r.stdout
 except subprocess.TimeoutExpired as e: code,out=124,str(e.stdout)
 pathlib.Path('/private/tmp/haru-pr270-evidence-20261018',f.name+'.log').write_text(out)
 results.append({'file':f.name,'exit':code})
pathlib.Path('/private/tmp/haru-pr270-evidence-20261018/all-tests.json').write_text(json.dumps(results,indent=2))
print(json.dumps({'files':len(results),'failures':[x for x in results if x['exit']]}))
