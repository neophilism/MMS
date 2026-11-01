import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createPublicationStore} from '../storage/publication-store.mjs';
import {createPublicationService} from '../domain/publication-service.mjs';
import {createPublicationHandler} from '../http/publication.mjs';
const origin='https://mms.test',api='/api/t/t1/events/e1/publication';
const event={eventId:'e1',title:'Final <script>unsafe</script>',status:'completed',published:true,championDisplayName:'<img src=x>',recordingUrl:'https://media.example/recording'};
const payload={event,expectedVersion:0,permissions:{results:true,recording:true,live:false},captions:{url:'https://media.example/captions.vtt',language:'en',label:'English'},liveUrl:null};
const producer={verified:true,subject:'producer',tenantId:'t1',roles:new Set(['producer'])};
function fixture(t,{verifyPublication=()=>true,authenticate=()=>producer}={}){
 const dir=mkdtempSync(join(tmpdir(),'mms-public-http-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));const store=createPublicationStore(join(dir,'archive.sqlite'));t.after(()=>store.close());
 const service=createPublicationService({store,verifyPublication});return createPublicationHandler({origin,authenticate,service});
}
function request(path,{method='GET',body,headers={}}={}){return new Request(origin+path,{method,headers:{...(path.endsWith('/publication')?{authorization:'Bearer test-token'}:{}),...(method==='PUT'||method==='DELETE'?{origin,'content-type':'application/json'}:{}),...headers},...(body!==undefined?{body:typeof body==='string'?body:JSON.stringify(body)}:{})})}
test('published HTML/API render escaped authorized results and cleared captions; withdrawal removes every public view',async t=>{
 const handle=fixture(t);assert.equal((await handle(request('/t/t1/events/e1'))).status,404);
 assert.equal((await handle(request(api,{method:'PUT',body:payload}))).status,200);
 let response=await handle(request('/t/t1/events/e1'));let html=await response.text();assert.equal(response.status,200);
 assert.doesNotMatch(html,/<script>|<img/);assert.match(html,/&lt;script&gt;/);assert.match(html,/<track kind="captions"/);assert.match(html,/crossorigin="anonymous"/);assert.doesNotMatch(html,/autoplay/);
 assert.equal(response.headers.get('cache-control'),'no-store');assert.match(response.headers.get('content-security-policy'),/form-action 'none'/);
 response=await handle(request('/api/t/t1/events/e1'));const dto=await response.json();assert.equal(dto.eventId,'e1');assert.ok(!Object.hasOwn(dto,'permissions'));assert.ok(!Object.hasOwn(dto,'principal'));
 assert.equal((await handle(request('/api/t/t2/events/e1'))).status,404);
 await handle(request(api,{method:'DELETE'}));
 assert.equal((await handle(request('/t/t1/events/e1'))).status,404);assert.equal((await handle(request('/api/t/t1/events/e1'))).status,404);
 assert.deepEqual(await (await handle(request('/api/t/t1/events'))).json(),{events:[],nextCursor:null});
 assert.equal((await handle(request(api,{method:'PUT',body:payload}))).status,409);
});
test('all public navigation resolves with honest unconnected apply/vote/sponsor paths and HEAD semantics',async t=>{
 const handle=fixture(t);
 for(const path of ['/t/t1','/t/t1/watch','/t/t1/apply','/t/t1/vote','/t/t1/archive','/t/t1/sponsor','/archive.css']){
  let response=await handle(request(path));assert.equal(response.status,200,path);
  const html=await response.text();if(path!=='/archive.css'){assert.match(html,/Skip to content/);assert.doesNotMatch(html,/<form|<input/)}
  response=await handle(request(path,{method:'HEAD'}));assert.equal(response.status,200);assert.equal(await response.text(),'');
 }
 assert.match(await (await handle(request('/t/t1/apply'))).text(),/Applications are not open/);
 assert.match(await (await handle(request('/t/t1/vote'))).text(),/No ballot is available/);
 assert.match(await (await handle(request('/t/t1/sponsor'))).text(),/No sponsorship or payment/);
});
test('public source gates never leak unverified results, stream or recording',async t=>{
 let handle=fixture(t,{verifyPublication:()=>false});assert.equal((await handle(request(api,{method:'PUT',body:payload}))).status,422);assert.equal((await handle(request('/api/t/t1/events/e1'))).status,404);
 handle=fixture(t);await handle(request(api,{method:'PUT',body:{...payload,permissions:{results:false,recording:false,live:false}}}));
 const html=await (await handle(request('/t/t1/events/e1'))).text();assert.doesNotMatch(html,/media.example|Champion:|<video/);assert.match(html,/results are not available/);
});
test('authenticated producer and exact origin required for publication management',async t=>{
 for(const user of [null,{...producer,verified:false},{...producer,tenantId:'t2'},{...producer,roles:new Set(['industry'])}]){
  const handle=fixture(t,{authenticate:()=>user});assert.equal((await handle(request(api,{method:'PUT',body:payload}))).status,403);assert.equal((await handle(request(api,{method:'DELETE'}))).status,403);assert.equal((await handle(request(api))).status,403);
 }
 const handle=fixture(t);assert.equal((await handle(request(api,{method:'PUT',body:payload,headers:{origin:'https://evil.test'}}))).status,403);
 assert.equal((await handle(request(api,{method:'PUT',body:payload,headers:{authorization:''}}))).status,401);
});
test('oversized bodies, unknown fields, cross-event identifiers and invalid paging are rejected safely',async t=>{
 const handle=fixture(t);
 for(const body of ['{',' '.repeat(16385),{...payload,tenantId:'t2'},{...payload,event:{...event,eventId:'e2'}}])assert.equal((await handle(request(api,{method:'PUT',body}))).status,400);
 for(const query of ['?limit=51','?after=../private','?status=private','?limit=1&limit=2','?token=secret'])assert.equal((await handle(request('/api/t/t1/events'+query))).status,400);
 assert.equal((await handle(request('/api/t/t1/events/e1?token=secret'))).status,400);
});
