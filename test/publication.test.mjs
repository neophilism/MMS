import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPublicationStore} from '../storage/publication-store.mjs';
import {createPublicationService,checkedPublication} from '../domain/publication-service.mjs';
const principal={verified:true,subject:'producer-1',tenantId:'tenant-a',roles:new Set(['producer'])};
const event={eventId:'event-1',title:'Final monologues',status:'completed',published:true,championDisplayName:'Champion',recordingUrl:'https://media.example/recording'};
const input={principal,tenantId:'tenant-a',event,expectedVersion:0,permissions:{results:true,recording:true,live:false},captions:{url:'https://media.example/captions.vtt',language:'en',label:'English'},liveUrl:null};
function fixture(t){const dir=mkdtempSync(join(tmpdir(),'mms-archive-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'archive.sqlite')}
function setup(t,verifyPublication=()=>true){const store=createPublicationStore(fixture(t));t.after(()=>store.close());return {store,service:createPublicationService({store,verifyPublication})}}
test('publication is durable, tenant-scoped and public DTOs omit source permission data',async t=>{
 const file=fixture(t);let store=createPublicationStore(file),service=createPublicationService({store,verifyPublication:()=>true});
 await service.publish(input);store.close();store=createPublicationStore(file);t.after(()=>store.close());service=createPublicationService({store,verifyPublication:()=>true});
 const result=await service.get({tenantId:'tenant-a',eventId:'event-1'});assert.equal(result.championDisplayName,'Champion');assert.equal(result.captions.language,'en');
 assert.deepEqual(Object.keys(result).sort(),['captions','championDisplayName','eventId','liveUrl','recordingUrl','status','title']);
 assert.equal(await service.get({tenantId:'tenant-b',eventId:'event-1'}),null);
 await assert.rejects(service.managed({principal:{...principal,tenantId:'tenant-b'},tenantId:'tenant-a',eventId:'event-1'}),/Not authorized/);
});
test('unverified, truthy and failed publication evidence never persist',async t=>{
 for(const result of [false,null,{verified:true},'true']){const {service}=setup(t,()=>result);await assert.rejects(service.publish(input),/evidence rejected/);assert.equal(await service.get({tenantId:'tenant-a',eventId:'event-1'}),null)}
 const {service}=setup(t,()=>{throw new Error('upstream unavailable')});await assert.rejects(service.publish(input),/upstream unavailable/);
});
test('rights and result gates suppress media and champion without silent completion',()=>{
 let record=checkedPublication({...input,permissions:{results:false,recording:false,live:false}});assert.equal(record.projection.championDisplayName,null);assert.equal(record.projection.recordingUrl,null);assert.equal(record.projection.captions,null);
 record=checkedPublication({...input,captions:null});assert.equal(record.projection.recordingUrl,null);
 record=checkedPublication({...input,event:{...event,status:'live'},permissions:{results:true,recording:true,live:true},liveUrl:'https://stream.example/watch'});assert.equal(record.projection.championDisplayName,null);assert.equal(record.projection.recordingUrl,null);assert.equal(record.projection.liveUrl,'https://stream.example/watch');
 for(const url of ['http://media.example/v','https://u:p@media.example/v','https://media.example/v?secret=token'])assert.throws(()=>checkedPublication({...input,liveUrl:url}));
 assert.throws(()=>checkedPublication({...input,event:{...event,email:'private@example.test'}}));
});
test('withdrawal tombstones block in-flight publication and old version replay',async t=>{
 let unblock,entered;const ready=new Promise(ok=>entered=ok);
 const {service}=setup(t,async()=>{entered();return await new Promise(ok=>unblock=ok)});
 const pending=service.publish(input);await ready;
 assert.deepEqual(await service.withdraw({principal,tenantId:'tenant-a',eventId:'event-1'}),{version:1,withdrawn:true});
 unblock(true);await assert.rejects(pending,/Version conflict/);
 assert.equal(await service.get({tenantId:'tenant-a',eventId:'event-1'}),null);
});
test('producer scope and versions reject unauthorized or malformed publications',async t=>{
 const {service}=setup(t);
 for(const user of [null,{...principal,verified:false},{...principal,roles:new Set(['industry'])},{...principal,tenantId:'tenant-b'},{...principal,subject:''}])await assert.rejects(service.publish({...input,principal:user}),/Not authorized/);
 for(const expectedVersion of [-1,0.5,Number.MAX_SAFE_INTEGER])await assert.rejects(service.publish({...input,expectedVersion}));
 await service.publish(input);await assert.rejects(service.publish(input),/Version conflict/);
});
test('public list pagination and status filters are stable and exclude withdrawals',async t=>{
 const {service}=setup(t);for(let n=1;n<=5;n++)await service.publish({...input,event:{...event,eventId:'event-'+n,status:n===4?'cancelled':'completed'}});
 let page=await service.list({tenantId:'tenant-a',limit:2,status:'completed'});assert.deepEqual(page.events.map(e=>e.eventId),['event-1','event-2']);assert.equal(page.nextCursor,'event-2');
 page=await service.list({tenantId:'tenant-a',limit:2,status:'completed',after:page.nextCursor});assert.deepEqual(page.events.map(e=>e.eventId),['event-3','event-5']);assert.equal(page.nextCursor,null);
 await service.withdraw({principal,tenantId:'tenant-a',eventId:'event-3'});assert.equal((await service.list({tenantId:'tenant-a',status:'completed'})).events.length,3);
 await assert.rejects(service.list({tenantId:'tenant-a',limit:51}));await assert.rejects(service.list({tenantId:'tenant-a',status:'draft'}));
});
test('stalled verifier has a bounded deadline and cannot publish later',async t=>{
 const {store}=setup(t);let release;const service=createPublicationService({store,timeoutMs:10,verifyPublication:()=>new Promise(ok=>release=ok)});
 await assert.rejects(service.publish(input),/verification unavailable/);release(true);await new Promise(ok=>setImmediate(ok));
 assert.equal(await service.get({tenantId:'tenant-a',eventId:'event-1'}),null);
});
