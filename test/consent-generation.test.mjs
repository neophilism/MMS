import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,chmodSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createDiscoveryService,createMemoryDiscoveryStore} from '../domain/discovery-service.mjs';
import {createContactPermissionService} from '../domain/contact-permissions.mjs';
import {createSqliteDiscoveryStore} from '../storage/sqlite-discovery.mjs';
const applicant={verified:true,subject:'p1',tenantId:'t1',roles:new Set(['applicant'])};
const industry={verified:true,industryVerified:true,subject:'i1',tenantId:'t1',roles:new Set(['industry'])};
const profile={tenantId:'t1',applicantId:'p1',displayName:'Performer',publicPortfolioUrl:'https://portfolio.example/'};
const publishArgs={principal:applicant,profile,consentAccepted:true,consentRevision:1,expectedGeneration:0};
const view={principal:industry,tenantId:'t1',applicantId:'p1'};
function disk(t){const dir=mkdtempSync(join(tmpdir(),'mms-discovery-'));chmodSync(dir,0o700);t.after(()=>rmSync(dir,{recursive:true,force:true}));return join(dir,'discovery.sqlite')}

for(const adapter of ['memory','sqlite']){
 test(adapter+': revocation and republication do not resurrect bookmarks or approved contacts',async t=>{
  const store=adapter==='memory'?createMemoryDiscoveryStore():createSqliteDiscoveryStore(disk(t));if(store.close)t.after(()=>store.close());
  const discovery=createDiscoveryService(store),contacts=createContactPermissionService({profiles:store});
  await discovery.publish(publishArgs);await discovery.bookmark(view);await contacts.request(view);
  await contacts.decide({principal:applicant,tenantId:'t1',industryPrincipalId:'i1',decision:'APPROVED',expectedGeneration:1});
  await discovery.revoke({principal:applicant,tenantId:'t1',applicantId:'p1'});
  const own=await discovery.ownProfile({principal:applicant,tenantId:'t1'});
  assert.equal(own.consentGeneration,2);assert.equal(own.displayName,'');assert.equal(own.publicPortfolioUrl,'');
  await assert.rejects(discovery.publish(publishArgs),/Consent version conflict/);
  await discovery.publish({...publishArgs,expectedGeneration:2});
  assert.deepEqual(await discovery.saved(view),[]);assert.deepEqual(await contacts.status(view),{status:'REVOKED'});
  await assert.rejects(contacts.decide({principal:applicant,tenantId:'t1',industryPrincipalId:'i1',decision:'APPROVED',expectedGeneration:1}),/unavailable/);
  assert.equal(await store.saveBookmark('t1','i1','p1',1),false);
  assert.equal(await store.requestContact('t1','p1','i1',1),null);
  await contacts.request(view);assert.deepEqual(await contacts.status(view),{status:'PENDING'});
  const outcomes=await Promise.allSettled(['APPROVED','DECLINED'].map(decision=>contacts.decide({principal:applicant,tenantId:'t1',industryPrincipalId:'i1',decision,expectedGeneration:3})));
  assert.equal(outcomes.filter(x=>x.status==='fulfilled').length,1);
 });
 test(adapter+': revoke-before-first-publish creates a generation tombstone',async t=>{
  const store=adapter==='memory'?createMemoryDiscoveryStore():createSqliteDiscoveryStore(disk(t));if(store.close)t.after(()=>store.close());
  const discovery=createDiscoveryService(store);
  await discovery.revoke({principal:applicant,tenantId:'t1',applicantId:'p1'});
  await assert.rejects(discovery.publish(publishArgs),/Consent version conflict/);
  assert.equal((await discovery.publish({...publishArgs,expectedGeneration:1})).consentGeneration,2);
 });
}
test('SQLite consent and contact state survive reopen; tenant and industry scopes stay isolated',async t=>{
 const file=disk(t);let store=createSqliteDiscoveryStore(file),discovery=createDiscoveryService(store),contacts=createContactPermissionService({profiles:store});
 await discovery.publish(publishArgs);await discovery.bookmark(view);await contacts.request(view);store.close();
 store=createSqliteDiscoveryStore(file);t.after(()=>store.close());discovery=createDiscoveryService(store);contacts=createContactPermissionService({profiles:store});
 assert.equal((await discovery.saved(view)).length,1);assert.deepEqual(await contacts.status(view),{status:'PENDING'});
 assert.deepEqual(await discovery.saved({...view,principal:{...industry,subject:'i2'}}),[]);
 assert.deepEqual(await discovery.search({...view,tenantId:'t2',principal:{...industry,tenantId:'t2'}}),[]);
 await assert.rejects(discovery.search({...view,principal:{...industry,tenantId:'t2'}}),/Not authorized/);
});
test('SQLite revocation rollback keeps consent and bookmark together on storage failure',async t=>{
 const file=disk(t),store=createSqliteDiscoveryStore(file);t.after(()=>store.close());const discovery=createDiscoveryService(store);
 await discovery.publish(publishArgs);await discovery.bookmark(view);
 const db=new DatabaseSync(file);db.exec("CREATE TRIGGER fail_cleanup BEFORE DELETE ON bookmarks BEGIN SELECT RAISE(ABORT,'injected cleanup failure'); END");
 await assert.rejects(discovery.revoke({principal:applicant,tenantId:'t1',applicantId:'p1'}),/injected/);
 assert.equal((await store.getProfile('t1','p1')).consentActive,true);assert.equal((await discovery.saved(view)).length,1);
 db.exec('DROP TRIGGER fail_cleanup');db.close();
 await discovery.revoke({principal:applicant,tenantId:'t1',applicantId:'p1'});assert.deepEqual(await discovery.saved(view),[]);
});
test('search is bounded, stable and literal, including wildcard characters and Unicode',async t=>{
 const store=createSqliteDiscoveryStore(disk(t));t.after(()=>store.close());const discovery=createDiscoveryService(store);
 for(let n=1;n<=5;n++){const id='p'+n;await discovery.publish({...publishArgs,principal:{...applicant,subject:id},profile:{...profile,applicantId:id,displayName:n===3?'ÉLAN %_':'Performer '+n}})}
 let page=await discovery.searchPage({...view,limit:2});assert.deepEqual(page.profiles.map(p=>p.applicantId),['p1','p2']);assert.equal(page.nextCursor,'p2');
 page=await discovery.searchPage({...view,limit:2,after:page.nextCursor});assert.deepEqual(page.profiles.map(p=>p.applicantId),['p3','p4']);
 assert.equal((await discovery.search({...view,query:'éla'})).length,1);assert.equal((await discovery.search({...view,query:'%_'})).length,1);
 for(const query of ["' OR 1=1 --",'missing'])assert.deepEqual(await discovery.search({...view,query}),[]);
 await assert.rejects(discovery.searchPage({...view,limit:51}));await assert.rejects(discovery.searchPage({...view,after:'../a'}));
});
