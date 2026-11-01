import {industryDiscoveryProjection} from '../domain/discovery.mjs';
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/** Only invoke with profiles returned by an authorized discovery service read. */
export function renderDiscoveryResults({profiles,nextCursor=null}){
 if(!Array.isArray(profiles)||profiles.length>50||(nextCursor!==null&&(typeof nextCursor!=='string'||!ID.test(nextCursor))))throw new TypeError('Invalid discovery page');
 const cards=profiles.map(profile=>{
  const p=industryDiscoveryProjection(profile,{verifiedIndustry:true,consented:true});
  return '<li class="mms-performer"><h2>'+escape(p.displayName)+'</h2><a href="'+escape(p.publicPortfolioUrl)+'" target="_blank" rel="noopener noreferrer">Open public portfolio<span class="mms-visually-hidden"> for '+escape(p.displayName)+' (new tab)</span></a><button type="button" data-mms-bookmark="'+p.applicantId+'">Save performer</button><button type="button" data-mms-contact="'+p.applicantId+'">Request contact permission</button></li>';
 });
 return '<section aria-labelledby="mms-discovery-title"><h1 id="mms-discovery-title">Industry discovery</h1><p>Only performers who consented to discovery are shown. Private application and contact details are not included.</p><form data-mms-search role="search"><label for="mms-query">Search performer names</label><input id="mms-query" name="q" type="search" maxlength="120"><button type="submit">Search</button></form><p role="status" aria-live="polite" data-mms-discovery-status>'+profiles.length+' performer'+(profiles.length===1?'':'s')+' shown</p><ul data-mms-results>'+cards.join('')+'</ul>'+(profiles.length===0?'<p>No matching consented profiles.</p>':'')+(nextCursor?'<button type="button" data-mms-next="'+nextCursor+'">Next page</button>':'')+'</section>';
}
export function renderContactRequests(requests){
 if(!Array.isArray(requests)||requests.length>50)throw new TypeError('Invalid request list');
 const rows=requests.map(row=>{
  if(!row||Object.keys(row).sort().join(',')!=='consentGeneration,industryPrincipalId,status'||typeof row.industryPrincipalId!=='string'||!ID.test(row.industryPrincipalId)||!Number.isSafeInteger(row.consentGeneration)||row.consentGeneration<1||!['PENDING','APPROVED','DECLINED'].includes(row.status))throw new TypeError('Invalid request');
  return '<li><p>Industry account '+escape(row.industryPrincipalId)+': '+row.status+'</p>'+(row.status==='PENDING'?'<button type="button" data-mms-decision="APPROVED" data-mms-industry="'+row.industryPrincipalId+'" data-mms-generation="'+row.consentGeneration+'">Approve contact permission</button><button type="button" data-mms-decision="DECLINED" data-mms-industry="'+row.industryPrincipalId+'" data-mms-generation="'+row.consentGeneration+'">Decline</button>':'')+'</li>';
 });
 return '<section aria-labelledby="mms-contacts-title"><h1 id="mms-contacts-title">Contact permissions</h1><p>Approval records permission only. MMS does not reveal your private contact details through this view.</p><ul>'+rows.join('')+'</ul>'+(rows.length===0?'<p>No current contact requests.</p>':'')+'</section>';
}

/** Relative requests only; the host binds an accepted session client. */
export function createDiscoveryClient({tenantId,authorization,fetchImpl=fetch}={}){
 if(typeof tenantId!=='string'||!ID.test(tenantId)||typeof authorization!=='function')throw new TypeError('Trusted discovery client required');
 const prefix='/api/t/'+tenantId+'/discovery/';
 const call=async(resource,method='GET',body)=>{
  const token=await authorization();if(typeof token!=='string'||!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(token))throw new Error('Sign-in required');
  const response=await fetchImpl(prefix+resource,{method,credentials:'omit',redirect:'error',cache:'no-store',headers:{authorization:token,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
  if(!response.ok)throw new Error(response.status===409?'Profile changed; reload before publishing':'Discovery request failed');
  return await response.json();
 };
 const scoped=id=>{if(typeof id!=='string'||!ID.test(id))throw new TypeError('Invalid discovery identifier');return id};
 return {
  async search({query='',limit=20,after=null}={}){
   if(typeof query!=='string'||query.length>120||!Number.isSafeInteger(limit)||limit<1||limit>50)throw new TypeError('Invalid search');if(after!==null)scoped(after);
   const q=new URLSearchParams({q:query,limit:String(limit)});if(after)q.set('after',after);return call('profiles?'+q);
  },
  ownProfile:()=>call('me'),
  publish:body=>call('me','PUT',body),
  revoke:()=>call('me','DELETE'),
  saved:()=>call('bookmarks'),
  bookmark:id=>call('bookmarks/'+scoped(id),'PUT'),
  unbookmark:id=>call('bookmarks/'+scoped(id),'DELETE'),
  requestContact:id=>call('contacts/'+scoped(id),'POST'),
  contactStatus:id=>call('contacts/'+scoped(id)),
  incoming:()=>call('requests'),
  decide:(id,{decision,expectedGeneration})=>{
   if(!['APPROVED','DECLINED'].includes(decision)||!Number.isSafeInteger(expectedGeneration)||expectedGeneration<1)throw new TypeError('Invalid decision');
   return call('contacts/'+scoped(id),'PUT',{decision,expectedGeneration});
  },
 };
}

/** Bind existing server-approved discovery views without caching profile data. */
export function mountDiscovery(root,{client}={}){
 let disposed=false,sequence=0,query='',busy=false;
 const status=message=>{const node=root.querySelector('[data-mms-discovery-status]');if(node)node.textContent=message};
 const load=async(after=null)=>{
  const ticket=++sequence;
  try{
   const page=await client.search({query,after});
   if(disposed||ticket!==sequence)return;
   root.innerHTML=renderDiscoveryResults(page);
   const input=root.querySelector('[name="q"]');if(input)input.value=query;
  }catch{
   if(disposed||ticket!==sequence)return;
   // Remove previously rendered profiles on an auth/privacy error.
   root.innerHTML=renderDiscoveryResults({profiles:[]});status('Discovery unavailable. Sign in again or retry.');
  }
 };
 const submit=event=>{
  const form=event.target.closest('[data-mms-search]');if(!form||!root.contains(form))return;
  event.preventDefault();query=form.elements.namedItem('q').value;void load();
 };
 const click=async event=>{
  const button=event.target.closest('[data-mms-bookmark],[data-mms-contact],[data-mms-next]');
  if(!button||!root.contains(button)||busy||disposed)return;
  if(button.hasAttribute('data-mms-next'))return load(button.getAttribute('data-mms-next'));
  busy=true;button.disabled=true;
  try{
   if(button.hasAttribute('data-mms-bookmark')){await client.bookmark(button.getAttribute('data-mms-bookmark'));if(!disposed)status('Performer saved.')}
   else{const result=await client.requestContact(button.getAttribute('data-mms-contact'));if(!disposed)status('Contact permission: '+(['PENDING','APPROVED','DECLINED'].includes(result.status)?result.status:'unavailable'))}
  }catch{if(!disposed){await load();status('Permission changed or request unavailable. Results refreshed.')}}
  finally{busy=false;if(!disposed)button.disabled=false}
 };
 root.addEventListener('submit',submit);root.addEventListener('click',click);
 const ready=load();
 return {ready,dispose(){disposed=true;sequence++;root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.innerHTML=''}};
}

export function mountContactRequests(root,{client}={}){
 let disposed=false,busy=false,sequence=0;
 const load=async()=>{
  const ticket=++sequence;
  try{const value=await client.incoming();if(!disposed&&ticket===sequence)root.innerHTML=renderContactRequests(value.requests)}
  catch{if(!disposed&&ticket===sequence)root.textContent='Contact requests unavailable. Sign in again or retry.'}
 };
 const click=async event=>{
  const button=event.target.closest('[data-mms-decision]');if(!button||!root.contains(button)||busy||disposed)return;
  busy=true;button.disabled=true;
  try{await client.decide(button.getAttribute('data-mms-industry'),{decision:button.getAttribute('data-mms-decision'),expectedGeneration:Number(button.getAttribute('data-mms-generation'))})}
  catch{/* Reload after an ambiguous or stale decision; never reuse it for a new generation. */}
  finally{busy=false;if(!disposed)await load()}
 };
 root.addEventListener('click',click);const ready=load();
 return {ready,dispose(){disposed=true;sequence++;root.removeEventListener('click',click);root.innerHTML=''}};
}
