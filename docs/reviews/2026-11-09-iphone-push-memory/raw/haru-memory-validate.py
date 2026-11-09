import pathlib,subprocess,os,json,datetime
cwd='/private/tmp/haru-push-memory-20261109/functions'
env=os.environ.copy();env.update(PATH='/opt/homebrew/opt/node@22/bin:'+env.get('PATH',''),GCLOUD_PROJECT='demo-haru-push-test',GOOGLE_CLOUD_PROJECT='demo-haru-push-test',FIRESTORE_EMULATOR_HOST='127.0.0.1:8399',FUNCTIONS_EMULATOR='true')
cmds=[['node','--version'],['npm','run','build'],['node','test/scheduledNotificationCore.test.js'],['node','/private/tmp/haru-push-memory-verify-20261109/endpoint-compare.js','/private/tmp/haru-deploy-chatwithresult-20261109/functions/lib/index.js',cwd+'/lib/index.js']]
rows=[]
for i,c in enumerate(cmds):
 pth=pathlib.Path('/private/tmp/haru-memory-validation-'+str(i)+'.log')
 with pth.open('w') as f:r=subprocess.run(c,cwd=cwd,env=env,stdout=f,stderr=subprocess.STDOUT)
 rows.append({'command':c,'exitCode':r.returncode,'log':str(pth)});print(json.dumps(rows[-1]),flush=True)
 if r.returncode:break
out={'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'head':subprocess.check_output(['git','rev-parse','HEAD'],cwd=cwd,text=True).strip(),'results':rows,'actualAIRequests':False,'productionWrites':False,'fcmSent':False,'baselineSourceSha':'92535da23e3bfdbee66b833217748da461b1689c','baselineLimit':'Functions src identical between 92535da2 and main6723b5d4; dependency major upgrade differs, runtime endpoint metadata only compared.'}
pathlib.Path('/private/tmp/haru-memory-validation-summary.json').write_text(json.dumps(out,ensure_ascii=False,indent=2))
