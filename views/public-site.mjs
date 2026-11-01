const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const escape=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function url(value){const u=new URL(value);if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new TypeError('Unsafe public media');return u.href}
function checked(event){
 if(!event||Object.getPrototypeOf(event)!==Object.prototype||Object.keys(event).sort().join(',')!=='captions,championDisplayName,eventId,liveUrl,recordingUrl,status,title'||typeof event.eventId!=='string'||!ID.test(event.eventId)||typeof event.title!=='string'||!event.title.trim()||event.title.length>200||!['scheduled','live','completed','cancelled'].includes(event.status))throw new TypeError('Invalid public event view');
 if(event.championDisplayName!==null&&(typeof event.championDisplayName!=='string'||event.championDisplayName.length>120))throw new TypeError('Invalid public result');
 if(event.recordingUrl!==null)url(event.recordingUrl);if(event.liveUrl!==null)url(event.liveUrl);
 if(event.captions!==null){if(!event.captions||Object.keys(event.captions).sort().join(',')!=='label,language,url'||typeof event.captions.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(event.captions.language)||typeof event.captions.label!=='string'||event.captions.label.length>80)throw new TypeError('Invalid caption view');url(event.captions.url)}
 return event;
}
const LABEL={scheduled:'Scheduled',live:'Live',completed:'Completed',cancelled:'Cancelled'};
export function renderPublicSite({tenantId,page='home',events=[],event=null,nextCursor=null}={}){
 if(typeof tenantId!=='string'||!ID.test(tenantId)||!['home','watch','archive','apply','vote','sponsor','event'].includes(page)||!Array.isArray(events)||events.length>50||(nextCursor!==null&&(typeof nextCursor!=='string'||!ID.test(nextCursor))))throw new TypeError('Invalid public page');
 events.forEach(checked);if(event!==null)checked(event);
 const base='/t/'+tenantId,links=[['home','MMS'],['watch','Watch'],['apply','Apply'],['vote','Vote'],['archive','Archive'],['sponsor','Sponsor']];
 const heading={home:'MMS',watch:'Watch monologues',archive:'Results and archive',apply:'Apply to perform',vote:'Audience voting',sponsor:'Support MMS',event:event?.title??'Event unavailable'}[page];
 let body='<h1>'+escape(heading)+'</h1>';
 if(['home','watch','archive'].includes(page)){
  body+='<p>Published event information. Event availability and optional access features are shown separately.</p><ul class="mms-grid">'+events.map(row=>'<li class="mms-card"><p class="mms-status">'+LABEL[row.status]+'</p><h2><a href="'+base+'/events/'+row.eventId+'">'+escape(row.title)+'</a></h2>'+(row.status==='completed'&&row.championDisplayName?'<p>Champion: '+escape(row.championDisplayName)+'</p>':'')+'</li>').join('')+'</ul>';
  if(events.length===0)body+='<p>No published '+(page==='archive'?'results or recordings':'events')+' are available.</p>';
  if(nextCursor)body+='<a href="'+base+(page==='home'?'':'/'+page)+'?after='+nextCursor+'">Next page</a>';
 }else if(page==='event'){
  if(!event)body+='<p>This event is not publicly available.</p>';
  else{
   body+='<p class="mms-status">'+LABEL[event.status]+'</p>';
   if(event.status==='cancelled')body+='<p>This event has been cancelled.</p>';
   if(event.status==='scheduled')body+='<p>The event has not started. No live performance or result is available yet.</p>';
   if(event.status==='live')body+=event.liveUrl?'<p><a href="'+escape(url(event.liveUrl))+'" rel="noopener noreferrer" target="_blank">Open the cleared live stream (new tab)</a></p>':'<p>Live stream playback is currently unavailable.</p>';
   if(event.status==='completed'){
    body+=event.championDisplayName?'<p>Champion: '+escape(event.championDisplayName)+'</p>':'<p>Final results are not available for publication.</p>';
    if(event.recordingUrl&&event.captions){body+='<video controls preload="none" crossorigin="anonymous"><source src="'+escape(url(event.recordingUrl))+'"><track kind="captions" src="'+escape(url(event.captions.url))+'" srclang="'+escape(event.captions.language)+'" label="'+escape(event.captions.label)+'" default><p>Your browser cannot play this recording.</p></video><p><a href="'+escape(url(event.captions.url))+'" rel="noopener noreferrer">Read the cleared captions</a></p>'}
    else body+='<p>A rights-cleared, captioned recording is not available.</p>';
   }
  }
 }else if(page==='apply')body+='<p>Applications are not open here. A private, consent-based application service must be connected before you send headshots, résumés, reels or personal details.</p>';
 else if(page==='vote')body+='<p>No ballot is available here. Audience voting is optional and requires an eligible event and verified voting service.</p>';
 else body+='<p>No sponsorship or payment can be submitted here. Sponsorship is optional and separate from event access.</p>';
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+escape(heading)+' | MMS</title><link rel="stylesheet" href="/archive.css"></head><body><a class="mms-skip" href="#main">Skip to content</a><header><nav aria-label="Primary">'+links.map(([key,label])=>'<a href="'+base+(key==='home'?'':'/'+key)+'"'+(key===page?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav></header><main id="main" tabindex="-1">'+body+'</main><footer><p>Only published and cleared event information is shown. Private applicant data is not part of this site.</p></footer></body></html>';
}
export const PUBLIC_CSS=':root{color-scheme:light dark;font-family:system-ui,sans-serif;background:#f6f5f2;color:#17253b;line-height:1.5}*{box-sizing:border-box}body{margin:0}header,main,footer{max-width:76rem;margin:auto;padding:clamp(1rem,4vw,3rem)}nav{display:flex;flex-wrap:wrap;gap:1.25rem}a{display:inline-flex;align-items:center;min-height:44px;color:#6847b6}a:focus-visible,video:focus-visible{outline:3px solid #164fca;outline-offset:3px}.mms-skip{position:absolute;left:-10000px;background:#fff;padding:1rem}.mms-skip:focus{left:1rem;top:1rem}.mms-grid{list-style:none;padding:0;display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,18rem),1fr));gap:1rem}.mms-card{padding:1.5rem;background:#fff;border-radius:1rem;overflow-wrap:anywhere}h1{font-size:clamp(2rem,6vw,4rem);line-height:1.1;overflow-wrap:anywhere}.mms-status{font-weight:700}video{display:block;width:100%;max-height:75vh;background:#000}@media(prefers-color-scheme:dark){:root{background:#101927;color:#f4f6fb}.mms-card,.mms-skip{background:#18263a}a{color:#b5a2fc}a:focus-visible,video:focus-visible{outline-color:#9bc4ff}}';
