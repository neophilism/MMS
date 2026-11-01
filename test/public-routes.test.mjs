import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {renderPublicPage,PUBLIC_PAGES} from '../design/pages.mjs';
import {makePreviewServer,createPublicHandler} from '../design/preview-server.mjs';

async function serve(t){
 const server=makePreviewServer();
 await new Promise(ok=>server.listen(0,'127.0.0.1',ok));
 t.after(()=>new Promise(ok=>server.close(ok)));
 return 'http://127.0.0.1:'+server.address().port;
}
test('every navigable public route and role has a complete static page',async t=>{
 const base=await serve(t);
 const landing=await (await fetch(base)).text();
 const paths=[...landing.matchAll(/href="([^"#]+)"/g)].map(m=>m[1]);
 for(const path of new Set(paths)){
  const response=await fetch(base+path);
  assert.equal(response.status,200,path);
  const html=await response.text();
  if(path==='/mms.css')continue;
  assert.equal([...html.matchAll(/<h1>/g)].length,1,path);
  assert.match(html,/<main[^>]+id="main"/);
  assert.match(html,/No application, vote or payment can be submitted/);
  assert.doesNotMatch(html,/<(?:form|input|script|iframe)\b/);
 }
});
test('public information is specific and current navigation is announced',()=>{
 for(const [path,page] of Object.entries(PUBLIC_PAGES)){
  const html=renderPublicPage(path);
  assert.ok(html.includes(page.heading));
  assert.ok(html.includes('href="'+path+'" aria-current="page"'));
  assert.equal([...html.matchAll(/aria-current="page"/g)].length,1);
 }
 for(const path of ['/industry','/account','/organizer','/t/a/account','/__proto__','/constructor','/<script>','/watch/extra',null,{}])
  assert.equal(renderPublicPage(path),null);
});
test('HEAD and read-only HTTP semantics and security headers apply to all pages',async t=>{
 const base=await serve(t);
 for(const path of ['/','/watch','/apply','/vote','/archive','/sponsor','/mms.css']){
  const head=await fetch(base+path,{method:'HEAD'});
  assert.equal(head.status,200);assert.equal(await head.text(),'');
  assert.equal(head.headers.get('cache-control'),'no-store');
  assert.equal(head.headers.get('referrer-policy'),'no-referrer');
  assert.match(head.headers.get('content-security-policy'),/form-action 'none'/);
  for(const method of ['POST','PUT','DELETE','OPTIONS']){
   const response=await fetch(base+path,{method});
   assert.equal(response.status,405);
   assert.equal(response.headers.get('allow'),'GET, HEAD');
  }
 }
 assert.equal((await fetch(base+'/t/tenant/industry')).status,404);
 const query=await (await fetch(base+'/watch?subject=private-user&role=admin')).text();
 assert.doesNotMatch(query,/private-user|role=admin/);
});
test('public handler composes without intercepting private routes',()=>{
 const handle=createPublicHandler();
 for(const url of ['/account','/industry','/t/a/account','/api/applications']){
  const res={writeHead(){assert.fail('wrote headers')},end(){assert.fail('ended response')}};
  assert.equal(handle({url,method:'POST'},res),false);
 }
});
test('ambiguous and normalized request targets fail closed without crashing server',async t=>{
 const base=await serve(t);
 for(const path of ['//host/watch','/../watch','/experience/../watch','/w%61tch','/watch#fragment','http://other/watch','/watch\\other']){
  const status=await new Promise((resolve,reject)=>{
   const req=http.request(base,{path},res=>{res.resume();res.on('end',()=>resolve(res.statusCode))});
   req.on('error',reject);req.end();
  });
  assert.equal(status,400,path);
 }
 assert.equal((await fetch(base+'/watch')).status,200);
});
