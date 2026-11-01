import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync} from 'node:fs';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {createSqliteDiscoveryStore} from '../storage/sqlite-discovery.mjs';
import {createDiscoveryService} from '../domain/discovery-service.mjs';
import {createContactPermissionService} from '../domain/contact-permissions.mjs';
import {createDiscoveryHandler} from '../http/discovery.mjs';
const origin='https://mms.test',prefix='/api/t/t1/discovery/';
const applicant={verified:true,subject:'p1',tenantId:'t1',roles:new Set(['applicant'])};
const industry={verified:true,industryVerified:true,subject:'i1',tenantId:'t1',roles:new Set(['industry'])};
const publicBody={displayName:'Performer',publicPortfolioUrl:'https://portfolio.example/',consentAccepted:true,consentRevision:1,expectedGeneration:0};
function req(resource,{method='GET',body,token='industry',headers={}}={}){
 return new Request(origin+prefix+resource,{method,headers:{authorization:'Bearer '+token,...(method!=='GET'?{origin,'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})});
}
function setup(t,extra={}){
 const dir=mkdtempSync(join(tmpdir(),'mms-discovery-http-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));
 const store=createSqliteDiscoveryStore(join(dir,'discovery.sqlite'));t.after(()=>store.close());
 const service=createDiscoveryService(store),contacts=createContactPermissionService({profiles:store});
 const handle=createDiscoveryHandler({origin,consentRevision:1,service,contacts,authenticate:request=>{
  const token=request.headers.get('authorization');return token==='Bearer applicant'?applicant:token==='Bearer industry'?industry:null;
 },...extra});
 return {store,service,contacts,handle};
}
test('HTTP publish/search/save/request/approve/revoke/republish workflow cannot revive old permissions',async t=>{
 const {handle}=setup(t);
 assert.equal((await handle(req('me',{method:'PUT',token:'applicant',body:publicBody}))).status,200);
 let result=await handle(req('profiles?q=perform&limit=1'));assert.equal(result.status,200);let data=await result.json();assert.equal(data.profiles.length,1);assert.equal(data.nextCursor,null);
 assert.deepEqual(Object.keys(data.profiles[0]).sort(),['applicantId','displayName','publicPortfolioUrl','tenantId']);
 assert.equal((await handle(req('bookmarks/p1',{method:'PUT'}))).status,200);
 assert.equal((await handle(req('contacts/p1',{method:'POST'}))).status,200);
 data=await (await handle(req('requests',{token:'applicant'}))).json();assert.equal(data.requests[0].consentGeneration,1);
 result=await handle(req('contacts/i1',{method:'PUT',token:'applicant',body:{decision:'APPROVED',expectedGeneration:1}}));assert.equal(result.status,200);
 assert.deepEqual(await (await handle(req('contacts/p1'))).json(),{status:'APPROVED'});
 await handle(req('me',{method:'DELETE',token:'applicant'}));
 assert.deepEqual(await (await handle(req('bookmarks'))).json(),{profiles:[]});assert.deepEqual(await (await handle(req('profiles'))).json(),{profiles:[],nextCursor:null});
 result=await handle(req('me',{method:'PUT',token:'applicant',body:publicBody}));assert.equal(result.status,409);
 const own=await (await handle(req('me',{token:'applicant'}))).json();assert.equal(own.profile.consentGeneration,2);
 await handle(req('me',{method:'PUT',token:'applicant',body:{...publicBody,expectedGeneration:2}}));
 assert.deepEqual(await (await handle(req('contacts/p1'))).json(),{status:'REVOKED'});
 await handle(req('contacts/p1',{method:'POST'}));
 // An old applicant tab cannot approve the new consent generation.
 assert.equal((await handle(req('contacts/i1',{method:'PUT',token:'applicant',body:{decision:'APPROVED',expectedGeneration:1}}))).status,404);
 assert.deepEqual(await (await handle(req('contacts/p1'))).json(),{status:'PENDING'});
 assert.deepEqual(await (await handle(req('bookmarks'))).json(),{profiles:[]});
});
test('server verification cannot be substituted with role, tenant or subject request fields',async t=>{
 const {handle}=setup(t);
 for(const resource of ['profiles','bookmarks','contacts/p1'])assert.equal((await handle(req(resource,{token:'applicant'}))).status,403);
 for(const resource of ['me','requests'])assert.equal((await handle(req(resource))).status,403);
 assert.equal((await handle(req('profiles',{token:'unknown'}))).status,403);
 assert.equal((await handle(req('profiles',{headers:{authorization:''}}))).status,401);
 assert.equal((await handle(new Request(origin+'/api/t/t2/discovery/profiles',{headers:{authorization:'Bearer industry'}}))).status,403);
 for(const field of ['principal','industryVerified','tenantId','applicantId','email','unionStatus']){
  assert.equal((await handle(req('me',{method:'PUT',token:'applicant',body:{...publicBody,[field]:'injected'}}))).status,400);
 }
 assert.deepEqual(await (await handle(req('profiles'))).json(),{profiles:[],nextCursor:null});
});
test('unverified industry and cross-origin calls cannot reach private data',async t=>{
 let calls=0;const {handle}=setup(t,{authenticate:()=>{calls++;return {...industry,industryVerified:false}}});
 assert.equal((await handle(req('profiles'))).status,403);
 assert.equal((await handle(req('bookmarks/p1',{method:'PUT',headers:{origin:'https://evil.test'}}))).status,403);
 assert.equal((await handle(req('contacts/p1',{method:'POST',headers:{origin:''}}))).status,403);
 assert.equal((await handle(req('profiles',{headers:{'sec-fetch-site':'cross-site'}}))).status,403);
 assert.equal(calls,1);
});
test('notice revision, explicit consent and strict body/query limits fail closed',async t=>{
 const {handle}=setup(t);
 assert.equal((await handle(req('me',{method:'PUT',token:'applicant',body:{...publicBody,consentRevision:2}}))).status,409);
 assert.equal((await handle(req('me',{method:'PUT',token:'applicant',body:{...publicBody,consentAccepted:false}}))).status,400);
 for(const body of ['{',' '.repeat(8193),'null','[]'])assert.equal((await handle(req('me',{method:'PUT',token:'applicant',body}))).status,400);
 for(const query of ['?limit=51','?limit=0','?limit=1e1','?q=x&q=y','?role=admin','?after=../a'])assert.equal((await handle(req('profiles'+query))).status,400);
 assert.equal((await handle(req('me',{method:'PUT',token:'applicant',body:publicBody,headers:{'content-type':'text/plain'}}))).status,415);
});
test('provider failures and deadlines return no secret details',async t=>{
 let {handle}=setup(t,{authenticate:()=>{throw new Error('SECRET credential')}});
 let response=await handle(req('profiles'));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/SECRET/);
 ({handle}=setup(t,{authenticate:()=>new Promise(()=>{}),timeoutMs:10}));assert.equal((await handle(req('profiles'))).status,503);
 ({handle}=setup(t,{service:{searchPage(){throw new Error('SECRET database')}}}));response=await handle(req('profiles'));assert.equal(response.status,503);assert.doesNotMatch(await response.text(),/SECRET/);
});
