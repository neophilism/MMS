import {industryDiscoveryProjection} from '../domain/discovery.mjs';
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function validateNotice(notice){
 if(!notice||!Number.isSafeInteger(notice.revision)||notice.revision<1||typeof notice.text!=='string'||!notice.text.trim()||notice.text.length>12000)throw new TypeError('Approved notice text and revision required');
}
/** The host supplies approved notice text. This module does not draft legal consent. */
export function renderPortfolioConsent({profile=null,notice}={}){
 validateNotice(notice);
 const generation=profile?.consentGeneration??0;
 if(!Number.isSafeInteger(generation)||generation<0)throw new TypeError('Invalid consent generation');
 const visible=profile?.consentActive===true?industryDiscoveryProjection({tenantId:profile.tenantId,applicantId:profile.applicantId,displayName:profile.displayName,publicPortfolioUrl:profile.publicPortfolioUrl},{verifiedIndustry:true,consented:true}):null;
 return '<section aria-labelledby="mms-portfolio-title"><h1 id="mms-portfolio-title">Your discovery portfolio</h1><p>Publish only the name and public portfolio link you choose to share with verified industry accounts. Private application fields are not part of this profile.</p><form data-mms-portfolio><label for="mms-public-name">Public display name</label><input id="mms-public-name" name="displayName" maxlength="120" required value="'+escape(visible?.displayName??'')+'"><label for="mms-public-url">Public portfolio URL</label><input id="mms-public-url" name="publicPortfolioUrl" type="url" required value="'+escape(visible?.publicPortfolioUrl??'')+'"><section aria-labelledby="mms-notice-title"><h2 id="mms-notice-title">Publication consent — revision '+notice.revision+'</h2><p id="mms-publication-notice">'+escape(notice.text)+'</p></section><label><input name="consentAccepted" type="checkbox" required aria-describedby="mms-publication-notice">I agree to the publication notice for this version of my portfolio.</label><button type="submit" disabled>Publish discovery profile</button></form><button type="button" data-mms-revoke>Revoke publication consent</button><p role="status" aria-live="polite" data-mms-consent-status>Publication '+(visible?'active':'inactive')+'. Consent generation '+generation+'.</p></section>';
}
/** No identifiers, tenant membership, or verified flags come from form fields. */
export function portfolioPublication(fields,{notice,expectedGeneration}){
 validateNotice(notice);
 if(!Number.isSafeInteger(expectedGeneration)||expectedGeneration<0||expectedGeneration>=Number.MAX_SAFE_INTEGER)throw new TypeError('Invalid consent generation');
 const displayName=fields.get('displayName'),publicPortfolioUrl=fields.get('publicPortfolioUrl');
 if(fields.get('consentAccepted')!==true)throw new TypeError('Explicit publication consent required');
 // Validate public-only values using fixed placeholders, never a client principal.
 industryDiscoveryProjection({tenantId:'validation',applicantId:'validation',displayName,publicPortfolioUrl},{verifiedIndustry:true,consented:true});
 return {displayName,publicPortfolioUrl,consentAccepted:true,consentRevision:notice.revision,expectedGeneration};
}
export function mountPortfolioConsent(root,{client,notice}={}){
 validateNotice(notice);let disposed=false,busy=false,profile=null,sequence=0;
 const status=text=>{const node=root.querySelector('[data-mms-consent-status]');if(node)node.textContent=text};
 const load=async()=>{
  const ticket=++sequence;
  try{
   const value=await client.ownProfile();if(disposed||ticket!==sequence)return;
   if(value.consentRevision!==notice.revision)throw new Error('Notice changed');
   profile=value.profile;root.innerHTML=renderPortfolioConsent({profile,notice});
  }catch{if(!disposed&&ticket===sequence)root.textContent='Portfolio unavailable. Reload to verify your session and current publication notice.'}
 };
 const change=event=>{
  if(!root.contains(event.target))return;
  const checkbox=root.querySelector('[name="consentAccepted"]'),submit=root.querySelector('button[type="submit"]');
  if(submit)submit.disabled=busy||!checkbox?.checked;
 };
 const submit=async event=>{
  const form=event.target.closest('[data-mms-portfolio]');if(!form||!root.contains(form))return;
  event.preventDefault();if(busy||disposed)return;busy=true;change(event);
  try{
   const fields=new Map(['displayName','publicPortfolioUrl'].map(name=>[name,form.elements.namedItem(name).value]));fields.set('consentAccepted',form.elements.namedItem('consentAccepted').checked);
   const body=portfolioPublication(fields,{notice,expectedGeneration:profile?.consentGeneration??0});
   await client.publish(body);await load();if(!disposed)status('Discovery profile published. New edits require explicit consent again.');
  }catch{if(!disposed){await load();status('Publication was not confirmed. Review the current profile before trying again.')}}
  finally{busy=false}
 };
 const click=async event=>{
  const button=event.target.closest('[data-mms-revoke]');if(!button||!root.contains(button)||busy||disposed)return;
  busy=true;button.disabled=true;
  try{await client.revoke();await load();if(!disposed)status('Publication consent revoked. Prior bookmarks and contact approvals remain inactive.')}
  catch{if(!disposed){await load();status('Revocation was not confirmed. Check the current publication state and retry.')}}
  finally{busy=false;if(!disposed)button.disabled=false}
 };
 root.addEventListener('change',change);root.addEventListener('submit',submit);root.addEventListener('click',click);
 const ready=load();return {ready,dispose(){disposed=true;sequence++;root.removeEventListener('change',change);root.removeEventListener('submit',submit);root.removeEventListener('click',click);root.innerHTML=''}};
}
