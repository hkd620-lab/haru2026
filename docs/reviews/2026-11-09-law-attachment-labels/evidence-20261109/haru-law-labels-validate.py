import subprocess,pathlib,os,json,datetime,hashlib,sys,re
suffix=('-'+sys.argv[1]) if len(sys.argv)>1 else ''
cwd='/private/tmp/haru-law-attachment-labels-20261109/functions'
env=os.environ.copy();env.update(PATH='/opt/homebrew/opt/node@22/bin:'+env.get('PATH',''),GCLOUD_PROJECT='demo-haru-result-chat',GOOGLE_CLOUD_PROJECT='demo-haru-result-chat',FIRESTORE_EMULATOR_HOST='127.0.0.1:8399',FUNCTIONS_EMULATOR='true',GEMINI_API_KEY='test-gemini-key',HARU_RESULT_CHAT_REAL_GEMINI='0',HARU_RESULT_CHAT_REAL_SMOKE='0')
cmds=[['node','--version'],['npm','run','build'],['node','--test','test/haruLawAttachmentLabels.test.js','test/haruLawAttachmentPipeline.test.js','test/haruLawErrorCore.test.js'],['node','-e','console.log("EXPORTS_JSON="+JSON.stringify(Object.keys(require("./lib/index.js")).sort()))']]
rows=[]
for i,c in enumerate(cmds):
 pth=pathlib.Path('/private/tmp/haru-law-labels-validation'+suffix+'-'+str(i)+'.log')
 with pth.open('w') as f:r=subprocess.run(c,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 rows.append({'command':c,'exitCode':r.returncode,'log':str(pth)});print(json.dumps(rows[-1]),flush=True)
 if r.returncode:break
out={'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=cwd,text=True).strip(),'results':rows,'actualAIRequests':False,'productionWrites':False}
if len(rows)==4 and all(row['exitCode']==0 for row in rows):
 baseline=json.loads(re.search(r'EXPORTS_JSON=(\[.*\])',pathlib.Path('/private/tmp/haru-pending-major-validation-combined-6.log').read_text()).group(1))
 current=json.loads(re.search(r'EXPORTS_JSON=(\[.*\])',pathlib.Path(rows[-1]['log']).read_text()).group(1))
 out['exportsComparison']={'baselineCount':len(baseline),'currentCount':len(current),'same':baseline==current,'added':sorted(set(current)-set(baseline)),'removed':sorted(set(baseline)-set(current))}
pathlib.Path('/private/tmp/haru-law-labels-validation'+suffix+'-summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
