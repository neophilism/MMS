import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {makeDraftSettingsServer} from '../http/draft-settings-server.mjs';
import {createDraftSettingsService,createMemoryDraftStore} from '../domain/draft-settings.mjs';
import {MMS_DEFAULTS} from '../domain/defaults.mjs';
const origin='https://mms.test',path='/api/t/tenant-a/events/event-1/draft-settings';
async function setup(t){
 let seen=0;
 const server=makeDraftSettingsServer({origin,service:createDraftSettingsService(createMemoryDraftStore()),authenticate:request=>{
  seen++;assert.equal(new URL(request.url).origin,origin);
  return request.headers.get('authorization')==='Bearer test-token'?{verified:true,subject:'producer',tenantId:'tenant-a',roles:new Set(['producer'])}:null;
 }});
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));t.after(()=>new Promise(ok=>server.close(ok)));
 return {base:'http://127.0.0.1:'+server.address().port,calls:()=>seen};
}
test('real HTTP request persists settings and never trusts forwarded origin or request body identity',async t=>{
 const {base}=await setup(t);
 let response=await fetch(base+path,{method:'PUT',headers:{authorization:'Bearer test-token',origin,'content-type':'application/json','x-forwarded-host':'evil.test','x-forwarded-proto':'http'},body:JSON.stringify({expectedVersion:0,settings:MMS_DEFAULTS})});
 assert.equal(response.status,200);assert.equal((await response.json()).draft.version,1);
 response=await fetch(base+path,{headers:{authorization:'Bearer test-token'}});assert.equal(response.status,200);assert.equal((await response.json()).draft.settings.qualifierSeconds,90);
 assert.equal((await fetch(base+path,{headers:{authorization:'Bearer unverified-token'}})).status,403);
 assert.equal((await fetch(base+path.replace('tenant-a','tenant-b'),{headers:{authorization:'Bearer test-token'}})).status,403);
});
test('duplicate credentials and noncanonical paths are rejected before authentication',async t=>{
 const {base,calls}=await setup(t);
 const send=(path,headers=[])=>new Promise((resolve,reject)=>{
  const req=http.request(base,{path,headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end();
 });
 assert.equal(await send(path,['Authorization','Bearer one','Authorization','Bearer two']),400);
 for(const target of ['//evil.test'+path,'/api/t/tenant-a/../tenant-a/events/event-1/draft-settings',path+'\\extra'])assert.equal(await send(target),400);
 assert.equal(calls(),0);
});
