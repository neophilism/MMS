import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDiscoveryResults,renderContactRequests,createDiscoveryClient,mountDiscovery} from '../views/discovery.mjs';
const profile={tenantId:'t1',applicantId:'p1',displayName:'<img src=x onerror=alert(1)>',publicPortfolioUrl:'https://portfolio.example/'};
test('discovery markup escapes names and uses protected external links and clear controls',()=>{
 const html=renderDiscoveryResults({profiles:[profile],nextCursor:'p1'});
 assert.doesNotMatch(html,/<img/);assert.match(html,/&lt;img/);assert.match(html,/rel="noopener noreferrer"/);
 assert.match(html,/role="search"/);assert.match(html,/aria-live="polite"/);assert.match(html,/data-mms-next="p1"/);
 assert.match(html,/Request contact permission/);assert.match(html,/Private application and contact details are not included/);
 assert.throws(()=>renderDiscoveryResults({profiles:[{...profile,email:'private@example.test'}]}));
 for(const url of ['javascript:alert(1)','https://u:p@x.test/','https://x.test/?token=secret'])assert.throws(()=>renderDiscoveryResults({profiles:[{...profile,publicPortfolioUrl:url}]}));
});
test('contact decisions carry exact generation and do not expose contact details',()=>{
 const html=renderContactRequests([{industryPrincipalId:'i1',consentGeneration:3,status:'PENDING'}]);
 assert.match(html,/data-mms-generation="3"/);assert.match(html,/Approve contact permission/);assert.match(html,/Decline/);
 assert.doesNotMatch(renderContactRequests([{industryPrincipalId:'i1',consentGeneration:3,status:'APPROVED'}]),/data-mms-decision/);
 for(const bad of [{industryPrincipalId:'<script>',consentGeneration:1,status:'PENDING'},{industryPrincipalId:'i1',consentGeneration:1,status:'PENDING',email:'private'}])assert.throws(()=>renderContactRequests([bad]));
});
test('client uses scoped relative paths, fresh authorization and encoded query values',async()=>{
 let tokens=0;const calls=[];
 const client=createDiscoveryClient({tenantId:'t1',authorization:()=>{tokens++;return 'Bearer token'},fetchImpl:async(url,options)=>{
  calls.push({url,options});assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');return new Response('{"profiles":[]}');
 }});
 await client.search({query:'A&B / ?'});await client.bookmark('p1');await client.decide('i1',{decision:'APPROVED',expectedGeneration:3});
 assert.equal(tokens,3);assert.equal(new URL(calls[0].url,'https://mms.test').searchParams.get('q'),'A&B / ?');
 assert.equal(calls[1].url,'/api/t/t1/discovery/bookmarks/p1');assert.deepEqual(JSON.parse(calls[2].options.body),{decision:'APPROVED',expectedGeneration:3});
 assert.throws(()=>client.bookmark('../p1'));await assert.rejects(client.search({query:'x'.repeat(121)}));
});
test('out-of-order search responses cannot replace newer authorized results; dispose clears data',async()=>{
 const listeners=new Map();const root={innerHTML:'',addEventListener:(n,f)=>listeners.set(n,f),removeEventListener:n=>listeners.delete(n),querySelector:()=>null,contains:()=>true};
 let initial;const client={search:()=>new Promise(ok=>initial=ok)};
 const mounted=mountDiscovery(root,{client});
 const form={elements:{namedItem:()=>({value:'new'})}};let newest;
 client.search=()=>new Promise(ok=>newest=ok);
 listeners.get('submit')({target:{closest:()=>form},preventDefault(){}});
 newest({profiles:[{...profile,displayName:'Newest'}]});await new Promise(ok=>setImmediate(ok));assert.match(root.innerHTML,/Newest/);
 initial({profiles:[{...profile,displayName:'Stale'}]});await mounted.ready;assert.doesNotMatch(root.innerHTML,/Stale/);
 mounted.dispose();assert.equal(root.innerHTML,'');assert.equal(listeners.size,0);
});
