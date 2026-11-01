import {publicEventProjection} from './archive.mjs';
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const validId=id=>typeof id==='string'&&ID.test(id);
function authorize(principal,tenantId){
 if(!principal||principal.verified!==true||principal.tenantId!==tenantId||!validId(tenantId)||!validId(principal.subject)||!(principal.roles instanceof Set)||!principal.roles.has('producer'))throw new Error('Not authorized');
}
function https(value){
 if(typeof value!=='string')throw new TypeError('Invalid public URL');const u=new URL(value);
 if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new TypeError('Unsafe public URL');return u.href;
}
function options({permissions,captions,liveUrl}){
 if(!permissions||Object.getPrototypeOf(permissions)!==Object.prototype||Object.keys(permissions).sort().join(',')!=='live,recording,results'||Object.values(permissions).some(v=>typeof v!=='boolean'))throw new TypeError('Explicit publication permissions required');
 let caption=null;
 if(captions!==null){
  if(!captions||Object.getPrototypeOf(captions)!==Object.prototype||Object.keys(captions).sort().join(',')!=='label,language,url'||typeof captions.language!=='string'||!/^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/.test(captions.language)||typeof captions.label!=='string'||!captions.label.trim()||captions.label.length>80)throw new TypeError('Invalid public captions');
  caption={url:https(captions.url),language:captions.language,label:captions.label};
 }
 return {permissions:{...permissions},captions:caption,liveUrl:liveUrl===null?null:https(liveUrl)};
}
/** This is an MMS-owned publication contract, not an assumed engine wire format. */
export function checkedPublication({tenantId,event,permissions,captions=null,liveUrl=null}){
 if(!validId(tenantId))throw new TypeError('Invalid tenant');
 const base=publicEventProjection(event),extra=options({permissions,captions,liveUrl});
 if(!base||event.published!==true)throw new TypeError('Published event required');
 const projection={...base,championDisplayName:extra.permissions.results&&base.status==='completed'?base.championDisplayName:null,
  recordingUrl:extra.permissions.recording&&base.status==='completed'&&extra.captions?base.recordingUrl:null,
  captions:extra.permissions.recording&&base.status==='completed'&&extra.captions&&base.recordingUrl?extra.captions:null,
  liveUrl:extra.permissions.live&&base.status==='live'?extra.liveUrl:null};
 return {tenantId,eventId:event.eventId,event:structuredClone(event),...extra,projection};
}
/** The host must verify current publication authority, final results, media
 * rights and caption clearance in the actual upstream source. No default proof
 * verifier or source-field boolean is treated as such evidence.
 */
export function createPublicationService({store,verifyPublication,timeoutMs=3000}={}){
 if(!store||['read','list','compareAndSwap','withdraw'].some(k=>typeof store[k]!=='function')||typeof verifyPublication!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new TypeError('Durable store and trusted publication verifier required');
 return {
  async publish({principal,expectedVersion,...input}){
   authorize(principal,input.tenantId);
   if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0||expectedVersion>=Number.MAX_SAFE_INTEGER)throw new TypeError('Invalid version');
   const record=checkedPublication(input);let timer,verified;
   try{verified=await Promise.race([Promise.resolve().then(()=>verifyPublication({principal,record:structuredClone(record),expectedVersion})),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Publication verification unavailable')),timeoutMs)})])}
   finally{clearTimeout(timer)}
   if(verified!==true)throw new Error('Publication evidence rejected');
   const next={version:expectedVersion+1,active:true,record};
   if(await store.compareAndSwap(input.tenantId,record.eventId,expectedVersion,next)!==true)throw new Error('Version conflict');
   return {version:next.version,eventId:record.eventId};
  },
  async withdraw({principal,tenantId,eventId}){authorize(principal,tenantId);if(!validId(eventId))throw new TypeError('Invalid event');return await store.withdraw(tenantId,eventId)},
  async managed({principal,tenantId,eventId}){authorize(principal,tenantId);if(!validId(eventId))throw new TypeError('Invalid event');const row=await store.read(tenantId,eventId);return row?{version:row.version,active:row.active}:null},
  async get({tenantId,eventId}){
   if(!validId(tenantId)||!validId(eventId))throw new TypeError('Invalid public scope');const row=await store.read(tenantId,eventId);
   return row?.active===true?checkedPublication(row.record).projection:null;
  },
  async list({tenantId,after=null,limit=20,status=null}){
   if(!validId(tenantId)||(after!==null&&!validId(after))||!Number.isSafeInteger(limit)||limit<1||limit>50||
    (status!==null&&!['scheduled','live','completed','cancelled'].includes(status)))throw new TypeError('Invalid archive query');
   const rows=await store.list(tenantId,{after,limit:limit+1,status});
   if(!Array.isArray(rows)||rows.length>limit+1)throw new Error('Invalid archive store response');
   const active=rows.filter(row=>row.active===true&&row.record.tenantId===tenantId);
   return {events:active.slice(0,limit).map(row=>checkedPublication(row.record).projection),nextCursor:active.length>limit?active[limit-1].record.eventId:null};
  },
 };
}
