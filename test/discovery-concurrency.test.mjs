import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync,writeFileSync,symlinkSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteDiscoveryStore} from '../storage/sqlite-discovery.mjs';
import {createDiscoveryService} from '../domain/discovery-service.mjs';
const profile={tenantId:'t1',applicantId:'p1',displayName:'Performer',publicPortfolioUrl:'https://portfolio.example/',consentRevision:1,consentActive:true};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'mms-discovery-race-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,file:join(dir,'discovery.sqlite')}}
function child(file,operation){
 const moduleUrl=new URL('../storage/sqlite-discovery.mjs',import.meta.url).href;
 const source='import {createSqliteDiscoveryStore} from '+JSON.stringify(moduleUrl)+';const store=createSqliteDiscoveryStore(process.argv[1]);const profile='+JSON.stringify(profile)+';console.log(JSON.stringify('+operation+'));store.close();';
 return new Promise((resolve,reject)=>{
  const proc=spawn(process.execPath,['--input-type=module','-e',source,file],{stdio:['ignore','pipe','pipe']});let out='',err='';
  const timer=setTimeout(()=>{proc.kill();reject(new Error('Child runtime exceeded test deadline'))},5000);
  proc.stdout.on('data',data=>out+=data);proc.stderr.on('data',data=>err+=data);proc.on('error',reject);
  proc.on('exit',code=>{clearTimeout(timer);if(code===0)resolve(JSON.parse(out));else reject(new Error(err))});
 });
}
test('independent SQLite processes produce one publication winner and one contact-decision winner',async t=>{
 const {file}=fixture(t);createSqliteDiscoveryStore(file).close();
 const publications=await Promise.all(Array.from({length:4},()=>child(file,'store.saveProfile("t1",profile,0)')));assert.equal(publications.filter(Boolean).length,1);
 let store=createSqliteDiscoveryStore(file);assert.equal(store.getProfile('t1','p1').consentGeneration,1);store.requestContact('t1','p1','i1',1);store.close();
 const decisions=await Promise.all(['APPROVED','DECLINED'].map(decision=>child(file,'store.decideContact("t1","p1","i1",1,'+JSON.stringify(decision)+')')));assert.equal(decisions.filter(Boolean).length,1);
 store=createSqliteDiscoveryStore(file);t.after(()=>store.close());assert.equal(store.readContact('t1','p1','i1').status,decisions.find(Boolean).status);
});
test('revocation racing after bookmark profile read refuses the stale bookmark',async t=>{
 const {file}=fixture(t),store=createSqliteDiscoveryStore(file);t.after(()=>store.close());store.saveProfile('t1',profile,0);
 const wrapped={...store,saveBookmark(tenant,industry,applicant,g){store.revokeAndDeleteBookmarks(tenant,applicant);return store.saveBookmark(tenant,industry,applicant,g)}};
 const service=createDiscoveryService(wrapped);
 await assert.rejects(service.bookmark({principal:{verified:true,industryVerified:true,subject:'i1',tenantId:'t1',roles:new Set(['industry'])},tenantId:'t1',applicantId:'p1'}),/Profile unavailable/);
 store.saveProfile('t1',profile,2);assert.deepEqual(store.listBookmarks('t1','i1'),[]);
});
test('revocation remains possible at generation exhaustion and cannot be republished',t=>{
 const {file}=fixture(t),store=createSqliteDiscoveryStore(file);t.after(()=>store.close());store.saveProfile('t1',profile,0);
 const db=new DatabaseSync(file);db.prepare('UPDATE profiles SET generation=?').run(Number.MAX_SAFE_INTEGER);db.close();
 store.revokeAndDeleteBookmarks('t1','p1');store.revokeAndDeleteBookmarks('t1','p1');
 assert.equal(store.getProfile('t1','p1').consentActive,false);assert.equal(store.getProfile('t1','p1').consentGeneration,Number.MAX_SAFE_INTEGER);
 assert.throws(()=>store.saveProfile('t1',profile,Number.MAX_SAFE_INTEGER));
});
test('unsafe paths and unknown schema are rejected without recreating records',t=>{
 const {dir,file}=fixture(t);assert.throws(()=>createSqliteDiscoveryStore('relative.sqlite'));
 chmodSync(dir,0o755);assert.throws(()=>createSqliteDiscoveryStore(file),/Private owned/);chmodSync(dir,0o700);
 const target=join(dir,'target');writeFileSync(target,'',{mode:0o600});symlinkSync(target,file);assert.throws(()=>createSqliteDiscoveryStore(file),/Private regular/);rmSync(file);
 writeFileSync(file,'',{mode:0o600});const db=new DatabaseSync(file);db.exec('PRAGMA user_version=99');db.close();assert.throws(()=>createSqliteDiscoveryStore(file),/Unsupported discovery schema/);
});
