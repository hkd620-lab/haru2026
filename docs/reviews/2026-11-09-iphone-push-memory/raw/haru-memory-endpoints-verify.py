import subprocess,pathlib,os,json,datetime
env=os.environ.copy();env.update(PATH='/opt/homebrew/opt/node@22/bin:'+env.get('PATH',''),GCLOUD_PROJECT='demo-haru-push-test',GOOGLE_CLOUD_PROJECT='demo-haru-push-test',FIREBASE_CONFIG=json.dumps({'projectId':'demo-haru-push-test'}),FIRESTORE_EMULATOR_HOST='127.0.0.1:8399',FUNCTIONS_EMULATOR='true')
script='/private/tmp/haru-push-memory-verify-20261109/endpoint-compare.js'
paths=['/private/tmp/haru-deploy-chatwithresult-20261109/functions/lib/index.js','/private/tmp/haru-push-memory-20261109/functions/lib/index.js']
values=[]
for p in paths:
 r=subprocess.run(['node',script,'dump',p],env=env,text=True,stdout=subprocess.PIPE,stderr=subprocess.PIPE)
 if r.returncode:raise RuntimeError('Endpoint metadata dump failed: exit '+str(r.returncode))
 values.append(json.loads(r.stdout))
a,b=values
changed=lambda x,y:sorted(k for k in set(x or {})|set(y or {}) if (x or {}).get(k)!=(y or {}).get(k))
pick=lambda x:{k:x.get(k) for k in ['platform','region','availableMemoryMb','cpu','timeoutSeconds']}
other=[{'name':k,'changedFields':changed(a.get(k),b.get(k))} for k in sorted(set(a)|set(b)) if k!='sendTestNotification' and a.get(k)!=b.get(k)]
out={'recordedAt':datetime.datetime.now(datetime.timezone.utc).isoformat(),'baselineExportCount':len(a),'candidateExportCount':len(b),'exportNamesEqual':set(a)==set(b),'otherEndpointDifferences':other,'sendTestNotification':{'before':pick(a['sendTestNotification']),'after':pick(b['sendTestNotification']),'changedFields':changed(a['sendTestNotification'],b['sendTestNotification'])},'rawMetadataPersisted':False,'actualAIRequests':False,'productionWrites':False,'fcmSent':False}
assert out['exportNamesEqual'] and len(a)==100 and not other
assert b['sendTestNotification'].get('availableMemoryMb')==512
assert out['sendTestNotification']['changedFields']==['availableMemoryMb']
dest=pathlib.Path('/private/tmp/haru-memory-endpoints-verified-summary.json');dest.write_text(json.dumps(out,ensure_ascii=False,indent=2));print(json.dumps(out,ensure_ascii=False))
