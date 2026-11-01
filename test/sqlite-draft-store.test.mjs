import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync,chmodSync,statSync,symlinkSync,linkSync,writeFileSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {createSqliteDraftStore} from '../storage/sqlite-draft-store.mjs';
import {createDraftSettingsService} from '../domain/draft-settings.mjs';
import {MMS_DEFAULTS} from '../domain/defaults.mjs';

function fixture(t){const dir=mkdtempSync(join(tmpdir(),'mms-settings-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));return {dir,path:join(dir,'drafts.sqlite')}}
const principal={verified:true,subject:'p1',tenantId:'tenant-a',roles:new Set(['producer'])};
const args={principal,tenantId:'tenant-a',eventId:'event-1'};
test('durable settings survive close/reopen and maintain independent tenant/event versions',async t=>{
 const {path}=fixture(t);let store=createSqliteDraftStore(path);let service=createDraftSettingsService(store);
 const saved=await service.save({...args,expectedVersion:0,settings:MMS_DEFAULTS});
 assert.equal(statSync(path).mode&0o777,0o600);store.close();
 store=createSqliteDraftStore(path);t.after(()=>store.close());service=createDraftSettingsService(store);
 assert.deepEqual(await service.read(args),saved);
 await assert.rejects(service.save({...args,expectedVersion:0,settings:MMS_DEFAULTS}),/Version conflict/);
 assert.equal(await service.read({...args,eventId:'event-2'}),null);
 assert.equal(await service.read({...args,tenantId:'tenant-b',principal:{...principal,tenantId:'tenant-b'}}),null);
 const updated=await service.save({...args,expectedVersion:1,settings:{...MMS_DEFAULTS,entrantWindowDays:21}});
 assert.equal(updated.version,2);assert.equal((await service.read(args)).settings.entrantWindowDays,21);
});
test('invalid mutation and adapter rows cannot alter previously saved settings',async t=>{
 const {path}=fixture(t),store=createSqliteDraftStore(path);t.after(()=>store.close());
 const service=createDraftSettingsService(store);await service.save({...args,expectedVersion:0,settings:MMS_DEFAULTS});
 for(const expectedVersion of [Number.MAX_SAFE_INTEGER,Infinity,-1,1.5])await assert.rejects(service.save({...args,expectedVersion,settings:MMS_DEFAULTS}),/Invalid version/);
 assert.throws(()=>store.compareAndSwap('tenant-a','event-1',1,{version:3,settings:MMS_DEFAULTS}));
 assert.throws(()=>store.compareAndSwap('tenant-a','event-1',1,{version:2,settings:{...MMS_DEFAULTS,qualifierSeconds:0}}));
 assert.throws(()=>store.read('../a','event-1'));
 for(const subject of ['',null,undefined,'x'.repeat(257)])await assert.rejects(service.read({...args,principal:{...principal,subject}}),/Not authorized/);
 assert.equal((await service.read(args)).version,1);
});
test('private path requirements reject permissive directories and links',t=>{
 const {dir,path}=fixture(t);assert.throws(()=>createSqliteDraftStore('relative.sqlite'));
 chmodSync(dir,0o755);assert.throws(()=>createSqliteDraftStore(path),/Private owned/);chmodSync(dir,0o700);
 const target=join(dir,'target.sqlite');writeFileSync(target,'',{mode:0o600});symlinkSync(target,path);
 assert.throws(()=>createSqliteDraftStore(path),/Private regular/);rmSync(path);linkSync(target,path);
 assert.throws(()=>createSqliteDraftStore(path),/Private regular/);rmSync(path);rmSync(target);
 writeFileSync(path,'',{mode:0o644});assert.throws(()=>createSqliteDraftStore(path),/Private regular/);
});
test('unknown or corrupted schema and stored payload fail closed',t=>{
 const {path}=fixture(t);writeFileSync(path,'',{mode:0o600});let db=new DatabaseSync(path);db.exec('PRAGMA user_version=99');db.close();
 assert.throws(()=>createSqliteDraftStore(path),/Unsupported draft schema/);
 db=new DatabaseSync(path);db.exec('PRAGMA user_version=1; CREATE TABLE mms_drafts(tenant TEXT,event TEXT,version INTEGER,settings TEXT)');db.close();
 assert.throws(()=>createSqliteDraftStore(path),/Invalid draft schema/);
 rmSync(path);const store=createSqliteDraftStore(path);t.after(()=>store.close());
 db=new DatabaseSync(path);db.prepare('INSERT INTO mms_drafts VALUES(?,?,?,?)').run('tenant-a','event-1',1,'{}');db.close();
 assert.throws(()=>store.read('tenant-a','event-1'),/Invalid MMS defaults/);
});
test('separate processes racing to create a draft yield one durable winner',async t=>{
 const {path}=fixture(t);createSqliteDraftStore(path).close();
 const storeUrl=new URL('../storage/sqlite-draft-store.mjs',import.meta.url).href;
 const defaultsUrl=new URL('../domain/defaults.mjs',import.meta.url).href;
 const script='import {createSqliteDraftStore} from '+JSON.stringify(storeUrl)+';import {MMS_DEFAULTS} from '+JSON.stringify(defaultsUrl)+';const s=createSqliteDraftStore(process.argv[1]);console.log(s.compareAndSwap("tenant-a","event-1",0,{version:1,settings:MMS_DEFAULTS}));s.close();';
 const run=()=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['--input-type=module','-e',script,path],{stdio:['ignore','pipe','pipe']});let out='',err='';
  const timer=setTimeout(()=>{child.kill();reject(new Error('child timeout'))},5000);
  child.stdout.on('data',c=>out+=c);child.stderr.on('data',c=>err+=c);child.on('error',reject);
  child.on('exit',code=>{clearTimeout(timer);code===0?resolve(out.trim()):reject(new Error(err))});
 });
 const results=await Promise.all(Array.from({length:4},run));assert.equal(results.filter(x=>x==='true').length,1);
 const store=createSqliteDraftStore(path);t.after(()=>store.close());assert.equal(store.read('tenant-a','event-1').version,1);
});
