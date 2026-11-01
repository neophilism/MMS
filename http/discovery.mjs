const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const HEADERS={'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer'};
const reply=(status,value,extra={})=>new Response(JSON.stringify(value),{status,headers:{...HEADERS,...extra}});
async function deadline(fn,ms){let timer;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Provider unavailable')),ms)})])}finally{clearTimeout(timer)}}
async function json(request,timeoutMs){
 const reader=request.body?.getReader();if(!reader)throw new TypeError('Missing body');let size=0;const chunks=[];
 try{
  await deadline(async()=>{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192)throw new TypeError('Body too large');chunks.push(part.value)}},timeoutMs);
  const bytes=new Uint8Array(size);let at=0;for(const chunk of chunks){bytes.set(chunk,at);at+=chunk.byteLength}
  const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
  if(!body||Object.getPrototypeOf(body)!==Object.prototype)throw new TypeError('Invalid body');return body;
 }catch(error){reader.cancel().catch(()=>{});throw error}finally{reader.releaseLock()}
}
function keys(body,expected){if(Object.keys(body).sort().join(',')!==expected.slice().sort().join(','))throw new TypeError('Invalid fields')}
/** Host supplies the real session verifier and the approved notice revision.
 * No default credentials, verified-industry assertion, or public listener exists.
 */
export function createDiscoveryHandler({service,contacts,authenticate,origin,consentRevision,timeoutMs=3000}={}){
 const base=new URL(origin);
 if(base.protocol!=='https:'||base.origin!==origin||typeof authenticate!=='function'||!service||!contacts||
  !Number.isSafeInteger(consentRevision)||consentRevision<1||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new TypeError('Trusted discovery configuration required');
 return async request=>{
  const url=new URL(request.url);
  const match=/^\/api\/t\/([a-zA-Z0-9_-]{1,128})\/discovery\/(profiles|me|bookmarks|contacts|requests)(?:\/([a-zA-Z0-9_-]{1,128}))?$/.exec(url.pathname);
  if(url.origin!==origin||!match)return reply(404,{error:'Not found'});
  const [,tenantId,resource,id]=match;
  const allowed=(resource==='profiles'||resource==='requests')&&!id?['GET']:resource==='me'&&!id?['GET','PUT','DELETE']:resource==='bookmarks'?id?['PUT','DELETE']:['GET']:resource==='contacts'&&id?['GET','POST','PUT']:[];
  if(!allowed.includes(request.method))return reply(405,{error:'Method not allowed'},{allow:allowed.join(', ')});
  if([...url.searchParams.keys()].some(k=>resource!=='profiles'||!['q','limit','after'].includes(k))||
   [...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length!==1))return reply(400,{error:'Invalid query'});
  const mutation=request.method!=='GET';
  if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==origin)||
   (mutation&&request.headers.get('origin')!==origin))return reply(403,{error:'Origin rejected'});
  if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(request.headers.get('authorization')||''))return reply(401,{error:'Authentication required'});
  let principal;
  try{principal=await deadline(()=>authenticate(request),timeoutMs)}catch{return reply(503,{error:'Authentication unavailable'})}
  if(!principal||principal.verified!==true||principal.tenantId!==tenantId||typeof principal.subject!=='string'||!ID.test(principal.subject)||!(principal.roles instanceof Set))return reply(403,{error:'Not authorized'});
  const applicant=resource==='me'||resource==='requests'||(resource==='contacts'&&request.method==='PUT');
  if(applicant?!principal.roles.has('applicant'):!principal.roles.has('industry')||principal.industryVerified!==true)return reply(403,{error:'Not authorized'});
  try{
   if(resource==='profiles'){
    const raw=url.searchParams.get('limit')??'20';if(!/^[1-9][0-9]?$/.test(raw))throw new TypeError('Invalid limit');
    return reply(200,await service.searchPage({principal,tenantId,query:url.searchParams.get('q')??'',limit:Number(raw),after:url.searchParams.get('after')}));
   }
   if(resource==='requests')return reply(200,{requests:await contacts.incoming({principal,tenantId})});
   if(resource==='me'){
    if(request.method==='GET')return reply(200,{profile:await service.ownProfile({principal,tenantId}),consentRevision});
    if(request.method==='DELETE')return reply(200,await service.revoke({principal,tenantId,applicantId:principal.subject}));
    if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return reply(415,{error:'JSON required'});
    let body;try{body=await json(request,timeoutMs)}catch{return reply(400,{error:'Invalid request'})}
    keys(body,['displayName','publicPortfolioUrl','consentAccepted','consentRevision','expectedGeneration']);
    if(body.consentRevision!==consentRevision)return reply(409,{error:'Consent notice changed'});
    return reply(200,await service.publish({principal,profile:{tenantId,applicantId:principal.subject,displayName:body.displayName,publicPortfolioUrl:body.publicPortfolioUrl},consentAccepted:body.consentAccepted,consentRevision,expectedGeneration:body.expectedGeneration}));
   }
   if(resource==='bookmarks'){
    if(request.method==='GET')return reply(200,{profiles:await service.saved({principal,tenantId})});
    return reply(200,await service[request.method==='PUT'?'bookmark':'unbookmark']({principal,tenantId,applicantId:id}));
   }
   if(resource==='contacts'){
    if(request.method==='GET')return reply(200,await contacts.status({principal,tenantId,applicantId:id}));
    if(request.method==='POST')return reply(200,await contacts.request({principal,tenantId,applicantId:id}));
    if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return reply(415,{error:'JSON required'});
    let body;try{body=await json(request,timeoutMs)}catch{return reply(400,{error:'Invalid request'})}keys(body,['decision','expectedGeneration']);
    return reply(200,await contacts.decide({principal,tenantId,industryPrincipalId:id,decision:body.decision,expectedGeneration:body.expectedGeneration}));
   }
  }catch(error){
   if(error.message==='Not authorized')return reply(403,{error:'Not authorized'});
   if(error.message==='Consent version conflict')return reply(409,{error:'Consent version conflict'});
   if(['Profile unavailable','Request unavailable'].includes(error.message))return reply(404,{error:'Unavailable'});
   if(error instanceof TypeError||error.message==='Explicit public portfolio consent required')return reply(400,{error:'Invalid request'});
   return reply(503,{error:'Discovery unavailable'});
  }
 };
}
