import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createDraftSettingsHandler} from '../http/draft-settings.mjs';
import {createDraftSettingsService,createMemoryDraftStore} from '../domain/draft-settings.mjs';
import {createSqliteDraftStore} from '../storage/sqlite-draft-store.mjs';
import {MMS_DEFAULTS} from '../domain/defaults.mjs';
const origin='https://mms.test',path='/api/t/tenant-a/events/event-1/draft-settings';
const principal={verified:true,subject:'producer-1',tenantId:'tenant-a',roles:new Set(['producer'])};
function request({method='GET',url=origin+path,headers={},body}={}){
 return new Request(url,{method,headers:{authorization:'Bearer test-token',...(method==='PUT'?{origin,'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
}
function setup(overrides={}){return createDraftSettingsHandler({origin,service:createDraftSettingsService(createMemoryDraftStore()),authenticate:async()=>principal,...overrides})}
const payload={expectedVersion:0,settings:MMS_DEFAULTS};
test('HTTP durable draft round-trip, update and restart preserve settings and exact versions',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'mms-http-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const filename=join(dir,'drafts.sqlite');let store=createSqliteDraftStore(filename);
 let handle=setup({service:createDraftSettingsService(store)});
 assert.deepEqual(await (await handle(request())).json(),{draft:null});
 let result=await handle(request({method:'PUT',body:payload}));assert.equal(result.status,200);assert.equal((await result.json()).draft.version,1);
 assert.equal(result.headers.get('cache-control'),'no-store');
 assert.equal((await handle(request({method:'PUT',body:payload}))).status,409);
 store.close();store=createSqliteDraftStore(filename);t.after(()=>store.close());handle=setup({service:createDraftSettingsService(store)});
 const restored=await (await handle(request())).json();assert.equal(restored.draft.settings.qualifierSeconds,90);
 const changed={expectedVersion:1,settings:{...MMS_DEFAULTS,qualifierSeconds:120}};
 result=await handle(request({method:'PUT',body:changed}));assert.equal(result.status,200);
 assert.equal((await (await handle(request())).json()).draft.settings.qualifierSeconds,120);
});
test('authentication is server supplied and tenant/role/subject substitution is denied',async()=>{
 for(const user of [null,{...principal,verified:false},{...principal,tenantId:'tenant-b'},{...principal,roles:new Set(['industry'])},{...principal,subject:''}]){
  let reads=0,writes=0;
  const handle=setup({authenticate:()=>user,service:{read(){reads++},save(){writes++}}});
  assert.equal((await handle(request())).status,403);
  assert.equal((await handle(request({method:'PUT',body:payload}))).status,403);
  assert.equal(reads+writes,0);
 }
 const handle=setup();
 for(const token of ['', 'Basic token','Bearer a b','Bearer '+('x'.repeat(8193))])assert.equal((await handle(request({headers:{authorization:token}}))).status,401);
 assert.equal((await handle(request({method:'PUT',body:{...payload,principal}}))).status,400);
});
test('cross-origin and cross-site writes fail before verifier or storage',async()=>{
 let calls=0;const handle=setup({authenticate(){calls++;return principal}});
 for(const headers of [{origin:'https://evil.test'},{origin:''},{'sec-fetch-site':'cross-site'}])
  assert.equal((await handle(request({method:'PUT',headers,body:payload}))).status,403);
 assert.equal((await handle(request({headers:{origin:'https://evil.test'}}))).status,403);
 assert.equal(calls,0);
});
test('capabilities come only from trusted resolver and errors never publish drafts',async()=>{
 const settings={...MMS_DEFAULTS,audienceVoteEnabled:true,audienceVoteWeightBps:1000};
 const handle=setup();assert.equal((await handle(request({method:'PUT',body:{expectedVersion:0,settings}}))).status,400);
 assert.equal((await handle(request({method:'PUT',body:{expectedVersion:0,settings,enabledCapabilities:['audienceVoteEnabled']}}))).status,400);
 assert.deepEqual(await (await handle(request())).json(),{draft:null});
 const allowed=setup({capabilitiesFor:({principal:p,tenantId,eventId})=>{
  assert.equal(p,principal);assert.equal(tenantId,'tenant-a');assert.equal(eventId,'event-1');return new Set(['audienceVoteEnabled']);
 }});
 assert.equal((await allowed(request({method:'PUT',body:{expectedVersion:0,settings}}))).status,200);
 const failed=setup({capabilitiesFor:()=>{throw new Error('SECRET-KEY')}});
 const response=await failed(request({method:'PUT',body:payload}));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/SECRET/);
});
test('invalid, excessive and unsupported payloads return safe errors',async()=>{
 const handle=setup();
 for(const body of ['{',JSON.stringify({...payload,extra:true}),JSON.stringify({...payload,expectedVersion:Number.MAX_SAFE_INTEGER}),' '.repeat(8193),'null','[]'])
  assert.equal((await handle(request({method:'PUT',body}))).status,400);
 assert.equal((await handle(request({method:'PUT',body:payload,headers:{'content-type':'text/plain'}}))).status,415);
 assert.equal((await handle(request({method:'DELETE'}))).status,405);
 for(const url of [origin+'/api/t/tenant-a/events/event-1/draft-settings/extra',origin+path+'?tenant=tenant-b','https://evil.test'+path])
  assert.equal((await handle(request({url}))).status,404);
});
test('failed and stalled provider calls fail closed with bounded deadlines',async()=>{
 let handle=setup({authenticate:()=>{throw new Error('private-token')}});
 let response=await handle(request());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/private-token/);
 handle=setup({authenticate:()=>new Promise(()=>{}),timeoutMs:10});assert.equal((await handle(request())).status,503);
 handle=setup({capabilitiesFor:()=>new Promise(()=>{}),timeoutMs:10});assert.equal((await handle(request({method:'PUT',body:payload}))).status,503);
 handle=setup({service:{read(){throw new Error('DB secret')},save(){throw new Error('DB secret')}}});
 response=await handle(request());assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/DB secret/);
});
test('streamed UTF-8 and slow request failures never invoke persistence',async()=>{
 let writes=0;const handle=setup({timeoutMs:10,service:{read(){return null},save(){writes++}}});
 const options={method:'PUT',headers:{authorization:'Bearer token',origin,'content-type':'application/json'},duplex:'half'};
 const malformed=new Request(origin+path,{...options,body:new ReadableStream({start(c){c.enqueue(new Uint8Array([0xff]));c.close()}})});
 assert.equal((await handle(malformed)).status,400);
 const slow=new Request(origin+path,{...options,body:new ReadableStream({cancel(){return new Promise(()=>{})}})});
 assert.equal((await handle(slow)).status,400);assert.equal(writes,0);
});
