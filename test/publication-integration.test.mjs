import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtempSync,chmodSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createPublicationStore} from '../storage/publication-store.mjs';
import {createPublicationService,checkedPublication} from '../domain/publication-service.mjs';
import {makePublicationServer} from '../http/publication-server.mjs';
const producer={verified:true,subject:'producer',tenantId:'t1',roles:new Set(['producer'])};
const event={eventId:'e1',title:'Test monologues',status:'live',published:true,championDisplayName:null,recordingUrl:null};
const record=checkedPublication({tenantId:'t1',event,permissions:{results:false,recording:false,live:true},captions:null,liveUrl:'https://stream.example/watch'});
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'mms-public-net-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,file:join(dir,'archive.sqlite')}}
test('actual HTTP publishes a verified live view and withdrawal removes stream access',async t=>{
 const {file}=fixture(t),store=createPublicationStore(file);t.after(()=>store.close());let verified=0;
 const service=createPublicationService({store,verifyPublication:({record})=>{verified++;return record.event.status==='live'&&record.liveUrl==='https://stream.example/watch'}});
 const server=makePublicationServer({origin:'https://mms.test',service,authenticate:req=>req.headers.get('authorization')==='Bearer producer'?producer:null});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>new Promise(ok=>server.close(ok)));const base='http://127.0.0.1:'+server.address().port;
 const path='/api/t/t1/events/e1/publication';
 let response=await fetch(base+path,{method:'PUT',headers:{authorization:'Bearer producer',origin:'https://mms.test','content-type':'application/json','x-forwarded-host':'evil.test'},body:JSON.stringify({event,expectedVersion:0,permissions:record.permissions,captions:null,liveUrl:record.liveUrl})});assert.equal(response.status,200);assert.equal(verified,1);
 response=await fetch(base+'/t/t1/events/e1');assert.match(await response.text(),/Open the cleared live stream/);
 response=await fetch(base+'/t/t1/events/e1',{method:'HEAD'});assert.equal(await response.text(),'');
 const raw=(target,headers)=>new Promise((resolve,reject)=>{const req=http.request(base,{path:target,headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end()});
 assert.equal(await raw(path,['Authorization','Bearer one','Authorization','Bearer two']),400);assert.equal(await raw('//evil.test/t/t1',[]),400);
 await fetch(base+path,{method:'DELETE',headers:{authorization:'Bearer producer',origin:'https://mms.test'}});assert.equal((await fetch(base+'/t/t1/events/e1')).status,404);
});
test('independent publication writers cannot overwrite the same expected version',async t=>{
 const {file}=fixture(t);createPublicationStore(file).close();const moduleUrl=new URL('../storage/publication-store.mjs',import.meta.url).href;
 const source='import {createPublicationStore} from '+JSON.stringify(moduleUrl)+';const s=createPublicationStore(process.argv[1]);console.log(s.compareAndSwap("t1","e1",0,{version:1,active:true,record:'+JSON.stringify(record)+'}));s.close();';
 const run=()=>new Promise((resolve,reject)=>{const proc=spawn(process.execPath,['--input-type=module','-e',source,file],{stdio:['ignore','pipe','pipe']});let out='',err='';const timer=setTimeout(()=>{proc.kill();reject(new Error('Child timed out'))},5000);proc.stdout.on('data',c=>out+=c);proc.stderr.on('data',c=>err+=c);proc.on('error',reject);proc.on('exit',code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(new Error(err))})});
 const results=await Promise.all(Array.from({length:4},run));assert.equal(results.filter(x=>x==='true').length,1);
 const store=createPublicationStore(file);t.after(()=>store.close());assert.equal(store.read('t1','e1').version,1);
});
test('storage rejects unsafe files and unknown schema; failed withdrawal preserves publication',t=>{
 const {dir,file}=fixture(t);assert.throws(()=>createPublicationStore('relative.sqlite'));
 chmodSync(dir,0o755);assert.throws(()=>createPublicationStore(file));chmodSync(dir,0o700);
 const target=join(dir,'target');writeFileSync(target,'',{mode:0o600});symlinkSync(target,file);assert.throws(()=>createPublicationStore(file));rmSync(file);
 writeFileSync(file,'',{mode:0o600});let db=new DatabaseSync(file);db.exec('PRAGMA user_version=99');db.close();assert.throws(()=>createPublicationStore(file),/Unsupported publication schema/);rmSync(file);
 const store=createPublicationStore(file);t.after(()=>store.close());store.compareAndSwap('t1','e1',0,{version:1,active:true,record});
 db=new DatabaseSync(file);db.exec("CREATE TRIGGER stop_withdraw BEFORE UPDATE ON publications WHEN NEW.active=0 BEGIN SELECT RAISE(ABORT,'injected withdrawal failure'); END");
 assert.throws(()=>store.withdraw('t1','e1'),/injected/);assert.equal(store.read('t1','e1').active,true);assert.equal(store.read('t1','e1').version,1);
 db.exec('DROP TRIGGER stop_withdraw');db.close();store.withdraw('t1','e1');assert.equal(store.read('t1','e1').record,null);
});
