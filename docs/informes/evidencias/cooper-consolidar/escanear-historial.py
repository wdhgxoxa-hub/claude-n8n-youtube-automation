import subprocess,re,json,pathlib
repo=str(pathlib.Path(__file__).resolve().parents[4])
def git(*args):return subprocess.check_output(['git','-C',repo,*args])
base=git('merge-base','ed02763965e1286630b0b4014ea18855824feccd','cooper-final').decode().strip()
rules={
 'anthropic':rb'sk-ant-[A-Za-z0-9_-]{15,}',
 'openai':rb'\bsk-(?!ant-)[A-Za-z0-9_-]{20,}',
 'google_oauth':rb'GOCSPX-[A-Za-z0-9_-]{15,}',
 'google_api':rb'AIza[A-Za-z0-9_-]{25,}',
 'github':rb'(?:gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{25,})',
 'slack':rb'xox[baprs]-[A-Za-z0-9-]{15,}',
 'jwt':rb'eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}',
 'private_key':rb'-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----',
 'aws':rb'\bAKIA[A-Z0-9]{16}\b',
}
objects={}
for l in git('rev-list','--objects','cooper-final','version-chatgpt').decode().splitlines():
 oid,_,p=l.partition(' ');objects[oid]=p
proc=subprocess.Popen(['git','-C',repo,'cat-file','--batch'],stdin=subprocess.PIPE,stdout=subprocess.PIPE)
findings=[]; blobs=0; scanned=0
for oid,path in objects.items():
 proc.stdin.write((oid+'\n').encode());proc.stdin.flush()
 hdr=proc.stdout.readline().decode().split();size=int(hdr[2]);data=proc.stdout.read(size);proc.stdout.read(1)
 if hdr[1] not in ('blob','commit','tag'):continue
 scanned+=1
 if hdr[1]=='blob':blobs+=1
 for rule,pat in rules.items():
  for m in re.finditer(pat,data):
   findings.append({'object':oid,'path':path,'rule':rule,'line':data[:m.start()].count(b'\n')+1})
 if hdr[1]=='blob' and re.search(r'(^|/)\.env(?:$|\.(?!example$|sample$|template$))',path):
  findings.append({'object':oid,'path':path,'rule':'tracked_real_env','line':0})
proc.stdin.close();proc.wait()
# Revisar cada árbol también: un blob puede haber tenido varios nombres en Git.
paths_checked=set()
for commit in git('rev-list','cooper-final','version-chatgpt').decode().splitlines():
 for entry in git('ls-tree','-r','-z',commit).split(b'\0'):
  if not entry:continue
  meta,path=entry.split(b'\t',1);path=path.decode(errors='replace')
  if path in paths_checked:continue
  paths_checked.add(path)
  if re.search(r'(^|/)\.env(?:$|\.(?!example$|sample$|template$))',path):
   findings.append({'commit':commit,'path':path,'rule':'real_env_in_tree','line':0})

result={'base':base,'cooper_final':git('rev-parse','cooper-final').decode().strip(),'version_chatgpt':git('rev-parse','version-chatgpt').decode().strip(),'commits_new':int(git('rev-list','--count',base+'..cooper-final')),'objects_scanned':scanned,'blobs_scanned':blobs,'findings':findings}
print(json.dumps(result,indent=2))

raise SystemExit(1 if findings else 0)
