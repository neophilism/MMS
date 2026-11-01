import {MMS_DEFAULTS,validateMmsDefaults} from '../domain/defaults.mjs';
const ALL=new Set(Object.keys(MMS_DEFAULTS).filter(k=>typeof MMS_DEFAULTS[k]==='boolean'));
const html=text=>String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Render only after service.read authorizes the producer; never accept an
 * unauthenticated request's row or capability claims as the source of this view.
 */
export function renderDraftSettingsEditor(row){
 const version=row?.version??0,settings=row?.settings??MMS_DEFAULTS;
 if(!Number.isSafeInteger(version)||version<0)throw new TypeError('Invalid draft version');
 const checked=validateMmsDefaults(settings,{enabledCapabilities:ALL});
 const number=(name,label,min,max)=>'<label for="mms-'+name+'">'+label+'</label><input id="mms-'+name+'" name="'+name+'" type="number" min="'+min+'" max="'+max+'" step="1" required value="'+checked[name]+'">';
 return '<section aria-labelledby="mms-settings-title"><h1 id="mms-settings-title">Competition draft settings</h1><p>Changes save a local draft only. They do not publish an event or change live competition rules.</p><form data-mms-settings><fieldset><legend>Monologue timing and entries</legend>'+number('qualifierSeconds','Qualifier length (seconds)',30,600)+number('finalSeconds','Final length (seconds)',30,600)+number('entrantWindowDays','Application window (days)',1,90)+'</fieldset><fieldset><legend>Judging rubric</legend>'+checked.judgeScoring.criterionIds.map((id,i)=>'<label for="mms-weight-'+i+'">'+html(id)+' weight (basis points)</label><input id="mms-weight-'+i+'" name="weight'+i+'" type="number" min="1" max="10000" step="1" required value="'+checked.judgeScoring.weightsBps[i]+'">').join('')+'<p>The three weights must total 10,000. Ties require manual review.</p></fieldset><p>Optional modes, audience voting and payment settings are retained from the current draft. This editor cannot grant or enable capabilities.</p><button type="submit" disabled>Save draft</button><p role="status" aria-live="polite" data-mms-settings-status>Connect your verified producer session to edit this draft.</p></form><p>Draft version: <span data-mms-version>'+version+'</span></p></section>';
}
/** Interpret only the controls this editor owns; preserve optional capabilities. */
export function settingsFromForm(base,fields){
 const checked=validateMmsDefaults(base,{enabledCapabilities:ALL});
 const read=name=>{
  const raw=fields.get(name);
  if(typeof raw!=='string'||!/^\d{1,5}$/.test(raw))throw new TypeError('Enter whole-number settings');
  return Number(raw);
 };
 return validateMmsDefaults({...checked,qualifierSeconds:read('qualifierSeconds'),finalSeconds:read('finalSeconds'),entrantWindowDays:read('entrantWindowDays'),
  judgeScoring:{criterionIds:[...checked.judgeScoring.criterionIds],weightsBps:[0,1,2].map(i=>read('weight'+i))}},{enabledCapabilities:ALL});
}
/** Browser host supplies short-lived Bearer authorization through its accepted
 * session client. Tokens are never placed in markup, storage or error messages.
 */
export function createDraftSettingsClient({endpoint,authorization,fetchImpl=fetch}={}){
 if(typeof endpoint!=='string'||!/^\/api\/t\/[a-z0-9-]{1,64}\/events\/[a-zA-Z0-9_-]{1,128}\/draft-settings$/.test(endpoint)||typeof authorization!=='function')throw new TypeError('Scoped endpoint and session client required');
 const call=async(method,body)=>{
  const token=await authorization();
  if(typeof token!=='string'||!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(token))throw new Error('Producer sign-in required');
  const response=await fetchImpl(endpoint,{method,credentials:'omit',redirect:'error',cache:'no-store',headers:{authorization:token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new Error(response.status===409?'Draft changed; reload before saving':'Draft request failed');
  const value=await response.json();
  if(!value||!Object.hasOwn(value,'draft'))throw new Error('Invalid draft response');
  if(value.draft!==null){
   if(!Number.isSafeInteger(value.draft.version)||value.draft.version<1)throw new Error('Invalid draft response');
   validateMmsDefaults(value.draft.settings,{enabledCapabilities:ALL});
  }
  return value.draft;
 };
 return {read:()=>call('GET'),save:({expectedVersion,settings})=>{
  if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||expectedVersion>=Number.MAX_SAFE_INTEGER)throw new TypeError('Invalid version');
  return call('PUT',{expectedVersion,settings:validateMmsDefaults(settings,{enabledCapabilities:ALL})});
 }};
}
/** Mount a rendered form only when a host has bound its trusted session client. */
export async function mountDraftSettingsEditor(form,{client,onVersion=()=>{}}={}){
 const button=form.querySelector('button[type="submit"]'),status=form.querySelector('[data-mms-settings-status]');
 let draft,busy=false,disposed=false;
 const show=message=>{status.textContent=message};
 const fill=()=>{
  const s=draft?.settings??MMS_DEFAULTS;
  for(const name of ['qualifierSeconds','finalSeconds','entrantWindowDays'])form.elements.namedItem(name).value=String(s[name]);
  s.judgeScoring.weightsBps.forEach((weight,i)=>{form.elements.namedItem('weight'+i).value=String(weight)});
  onVersion(draft?.version??0);
 };
 const submit=async event=>{
  event.preventDefault();if(busy||disposed)return;
  busy=true;button.disabled=true;
  try{
   const fields=new Map(['qualifierSeconds','finalSeconds','entrantWindowDays','weight0','weight1','weight2'].map(name=>[name,form.elements.namedItem(name).value]));
   const settings=settingsFromForm(draft?.settings??MMS_DEFAULTS,fields);
   draft=await client.save({expectedVersion:draft?.version??0,settings});
   if(!disposed){fill();show('Draft saved. Live competition rules are unchanged.')}
  }catch(error){if(!disposed)show(error instanceof TypeError?'Check timing and rubric values.':'Draft could not be saved. Reload to check the current version.')}
  finally{busy=false;if(!disposed)button.disabled=false}
 };
 try{draft=await client.read();if(disposed)return;fill();show('Draft loaded. Changes affect this local draft only.');button.disabled=false;form.addEventListener('submit',submit)}
 catch{show('Draft unavailable. Sign in again or reload.');button.disabled=true}
 return ()=>{disposed=true;form.removeEventListener('submit',submit);button.disabled=true};
}
