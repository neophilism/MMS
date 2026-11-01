import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {mkdtempSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {makeDiscoveryServer} from '../http/discovery-server.mjs';
import {createDiscoveryService} from '../domain/discovery-service.mjs';
import {createContactPermissionService} from '../domain/contact-permissions.mjs';
import {createSqliteDiscoveryStore} from '../storage/sqlite-discovery.mjs';
test('real HTTP binds trusted identities, persists across server restart, and denies header/path ambiguity',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'mms-discovery-net-'));chmodSync(dir,0o700);const file=join(dir,'discovery.sqlite');t.after(()=>rmSync(dir,{recursive:true,force:true}));
 let store=createSqliteDiscoveryStore(file),server;let authCalls=0;
 const start=async()=>{
  server=makeDiscoveryServer({origin:'https://mms.test',consentRevision:1,service:createDiscoveryService(store),contacts:createContactPermissionService({profiles:store}),authenticate:req=>{
   authCalls++;assert.equal(new URL(req.url).origin,'https://mms.test');
   return req.headers.get('authorization')==='Bearer applicant'?{verified:true,subject:'p1',tenantId:'t1',roles:new Set(['applicant'])}:{verified:true,industryVerified:true,subject:'i1',tenantId:'t1',roles:new Set(['industry'])};
  }});
  await new Promise(ok=>server.listen(0,'127.0.0.1',ok));return 'http://127.0.0.1:'+server.address().port;
 };
 let base=await start();t.after(async()=>{await new Promise(ok=>server.close(ok));store.close()});
 const path='/api/t/t1/discovery/';
 let response=await fetch(base+path+'me',{method:'PUT',headers:{authorization:'Bearer applicant',origin:'https://mms.test','content-type':'application/json','x-forwarded-host':'attacker.test'},body:JSON.stringify({displayName:'Performer',publicPortfolioUrl:'https://portfolio.example/',consentAccepted:true,consentRevision:1,expectedGeneration:0})});assert.equal(response.status,200);
 await new Promise(ok=>server.close(ok));store.close();store=createSqliteDiscoveryStore(file);base=await start();
 response=await fetch(base+path+'profiles',{headers:{authorization:'Bearer industry'}});assert.equal(response.status,200);assert.equal((await response.json()).profiles[0].displayName,'Performer');
 const before=authCalls;
 const raw=(target,headers)=>new Promise((resolve,reject)=>{const req=http.request(base,{path:target,headers},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});req.on('error',reject);req.end()});
 assert.equal(await raw(path+'profiles',['Authorization','Bearer one','Authorization','Bearer two']),400);
 assert.equal(await raw('//attacker.test'+path+'profiles',[]),400);assert.equal(await raw('/api/t/t1/../t1/discovery/profiles',[]),400);assert.equal(authCalls,before);
});
