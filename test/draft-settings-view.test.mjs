import test from 'node:test';
import assert from 'node:assert/strict';
import {renderDraftSettingsEditor,settingsFromForm,createDraftSettingsClient,mountDraftSettingsEditor} from '../views/draft-settings.mjs';
import {createDraftSettingsHandler} from '../http/draft-settings.mjs';
import {createDraftSettingsService,createMemoryDraftStore} from '../domain/draft-settings.mjs';
import {MMS_DEFAULTS} from '../domain/defaults.mjs';
const fields=()=>new Map([['qualifierSeconds','120'],['finalSeconds','240'],['entrantWindowDays','21'],['weight0','4000'],['weight1','3500'],['weight2','2500']]);
test('editor labels numeric fields, starts disabled and never offers publication or capability escalation',()=>{
 const html=renderDraftSettingsEditor(null);
 for(const name of ['qualifierSeconds','finalSeconds','entrantWindowDays'])assert.ok(html.includes('for="mms-'+name+'"'));
 assert.match(html,/<legend>Judging rubric/);assert.match(html,/<button type="submit" disabled/);assert.match(html,/role="status"/);
 assert.doesNotMatch(html,/type="hidden"|name="principal"|name="enabledCapabilities"|name="paymentRequired"/);
 assert.throws(()=>renderDraftSettingsEditor({version:NaN,settings:MMS_DEFAULTS}));
});
test('form edits preserve capability settings, enforce timing and enforce sum of weights',()=>{
 const base={...MMS_DEFAULTS,audienceVoteEnabled:true,audienceVoteWeightBps:1000};
 const saved=settingsFromForm(base,fields());assert.equal(saved.qualifierSeconds,120);assert.equal(saved.audienceVoteEnabled,true);assert.equal(saved.audienceVoteWeightBps,1000);
 assert.equal(MMS_DEFAULTS.qualifierSeconds,90);
 for(const bad of ['-1','1e2','1.5','Infinity','',{},'1'.repeat(20)]){const f=fields();f.set('qualifierSeconds',bad);assert.throws(()=>settingsFromForm(base,f))}
 const f=fields();f.set('weight0','1');assert.throws(()=>settingsFromForm(base,f));
});
test('browser client round-trips through authenticated HTTP contract with fresh tokens',async()=>{
 const endpoint='/api/t/tenant-a/events/event-1/draft-settings',origin='https://mms.test';let tokens=0;
 const handler=createDraftSettingsHandler({origin,service:createDraftSettingsService(createMemoryDraftStore()),authenticate:()=>({verified:true,subject:'p1',tenantId:'tenant-a',roles:new Set(['producer'])})});
 const client=createDraftSettingsClient({endpoint,authorization:()=>{tokens++;return 'Bearer test-token'},fetchImpl:(url,options)=>{
  assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.cache,'no-store');
  return handler(new Request(origin+url,{...options,headers:{...options.headers,...(options.method==='PUT'?{origin}:{})}}));
 }});
 assert.equal(await client.read(),null);
 const saved=await client.save({expectedVersion:0,settings:settingsFromForm(MMS_DEFAULTS,fields())});assert.equal(saved.version,1);
 assert.equal((await client.read()).settings.qualifierSeconds,120);assert.equal(tokens,3);
 await assert.rejects(client.save({expectedVersion:0,settings:MMS_DEFAULTS}),/reload before saving/);
});
test('client rejects off-origin endpoints and never returns response errors or auth text',async()=>{
 assert.throws(()=>createDraftSettingsClient({endpoint:'https://evil.test/api',authorization:()=>''}));
 let client=createDraftSettingsClient({endpoint:'/api/t/a/events/e/draft-settings',authorization:()=>'<private credential>'});
 await assert.rejects(client.read(),/Producer sign-in required/);
 client=createDraftSettingsClient({endpoint:'/api/t/a/events/e/draft-settings',authorization:()=>'Bearer token',fetchImpl:()=>new Response('SECRET', {status:503})});
 await assert.rejects(client.read(),error=>error.message==='Draft request failed');
});
function formDouble(){
 const button={disabled:true},status={textContent:''},listeners=new Map(),controls=new Map([...fields()].map(([key,value])=>[key,{value}]));
 return {button,status,listeners,elements:{namedItem:name=>controls.get(name)},querySelector:selector=>selector.startsWith('button')?button:status,addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:name=>listeners.delete(name)};
}
test('editor loads verified draft, prevents duplicate saves and preserves version for retries',async()=>{
 const form=formDouble();let saves=0,release;
 const client={read:async()=>({version:2,settings:MMS_DEFAULTS}),save:async request=>{
  saves++;assert.equal(request.expectedVersion,2);await new Promise(ok=>release=ok);return {version:3,settings:request.settings};
 }};
 let version;const dispose=await mountDraftSettingsEditor(form,{client,onVersion:v=>version=v});
 assert.equal(form.button.disabled,false);assert.equal(version,2);
 const submit=form.listeners.get('submit'),event={preventDefault(){}};
 const first=submit(event);await submit(event);assert.equal(saves,1);assert.equal(form.button.disabled,true);release();await first;
 assert.equal(version,3);assert.match(form.status.textContent,/Draft saved/);dispose();assert.equal(form.listeners.size,0);assert.equal(form.button.disabled,true);
});
test('unavailable session leaves editor inert and failed writes expose no exception details',async()=>{
 const form=formDouble();await mountDraftSettingsEditor(form,{client:{read:async()=>{throw new Error('SECRET')}}});
 assert.equal(form.button.disabled,true);assert.equal(form.listeners.size,0);assert.doesNotMatch(form.status.textContent,/SECRET/);
 const writable=formDouble();await mountDraftSettingsEditor(writable,{client:{read:async()=>null,save:async()=>{throw new Error('SECRET')}}});
 await writable.listeners.get('submit')({preventDefault(){}});assert.match(writable.status.textContent,/Reload/);assert.doesNotMatch(writable.status.textContent,/SECRET/);
});
