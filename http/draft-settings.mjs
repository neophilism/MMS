const ROUTE=/^\/api\/t\/([a-z0-9-]{1,64})\/events\/([a-zA-Z0-9_-]{1,128})\/draft-settings$/;
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const response=(status,error,extra={})=>new Response(JSON.stringify(error),{status,headers:{...HEADERS,...extra}});
async function bounded(operation,timeoutMs){
 let timer;
 try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Provider unavailable')),timeoutMs)})])}
 finally{clearTimeout(timer)}
}
async function bodyJson(request,timeoutMs){
 const reader=request.body?.getReader();
 if(!reader)throw new TypeError('Missing body');
 const chunks=[];let size=0;
 try{
  await bounded(async()=>{
   for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;if(size>8192)throw new TypeError('Body too large');chunks.push(value)}
  },timeoutMs);
  const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length}
  const value=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='expectedVersion,settings')throw new TypeError('Invalid request');
  return value;
 }catch(error){reader.cancel().catch(()=>{});throw error}
 finally{reader.releaseLock()}
}
/** Bind only a server-owned session verifier and capability resolver.
 * Request bodies never choose identities, roles, tenants or capabilities.
 * This endpoint persists local drafts; it does not publish engine rules.
 */
export function createDraftSettingsHandler({service,authenticate,origin,capabilitiesFor=()=>new Set(),timeoutMs=3000}={}){
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.origin!==origin||base.username||base.password)throw new TypeError('Canonical HTTPS origin required');
 if(!service||typeof service.read!=='function'||typeof service.save!=='function'||typeof authenticate!=='function'||typeof capabilitiesFor!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new TypeError('Trusted service and verifier required');
 return async request=>{
  const url=new URL(request.url),match=ROUTE.exec(url.pathname);
  if(url.origin!==origin||url.search||!match)return response(404,{error:'Not found'});
  if(!['GET','PUT'].includes(request.method))return response(405,{error:'Method not allowed'},{allow:'GET, PUT'});
  if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==origin)||
     (request.method==='PUT'&&request.headers.get('origin')!==origin))return response(403,{error:'Origin rejected'});
  if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(request.headers.get('authorization')||''))return response(401,{error:'Authentication required'});
  const [,tenantId,eventId]=match;
  let principal;
  try{principal=await bounded(()=>authenticate(request),timeoutMs)}catch{return response(503,{error:'Authentication unavailable'})}
  if(!principal||principal.verified!==true||typeof principal.subject!=='string'||!principal.subject.length||principal.subject.length>256||principal.tenantId!==tenantId||!(principal.roles instanceof Set)||!principal.roles.has('producer'))return response(403,{error:'Not authorized'});
  if(request.method==='GET'){
   try{return response(200,{draft:await service.read({principal,tenantId,eventId})})}catch{return response(503,{error:'Draft store unavailable'})}
  }
  if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return response(415,{error:'JSON required'});
  let body;
  try{body=await bodyJson(request,timeoutMs)}catch{return response(400,{error:'Invalid draft request'})}
  let enabledCapabilities;
  try{enabledCapabilities=await bounded(()=>capabilitiesFor({principal,tenantId,eventId}),timeoutMs);if(!(enabledCapabilities instanceof Set))throw new Error()}
  catch{return response(503,{error:'Capabilities unavailable'})}
  try{return response(200,{draft:await service.save({principal,tenantId,eventId,...body,enabledCapabilities})})}
  catch(error){
   if(error.message==='Version conflict')return response(409,{error:'Version conflict'});
   if(error instanceof TypeError)return response(400,{error:'Invalid draft settings'});
   return response(503,{error:'Draft store unavailable'});
  }
 };
}
