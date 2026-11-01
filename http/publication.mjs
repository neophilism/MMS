import {renderPublicSite,PUBLIC_CSS} from '../views/public-site.mjs';
const H={'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'self'; media-src https:; connect-src https:; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"};
const json=(status,value,extra={})=>new Response(JSON.stringify(value),{status,headers:{...H,'content-type':'application/json; charset=utf-8',...extra}});
async function body(request,ms){
 const reader=request.body?.getReader();if(!reader)throw new TypeError('Missing body');let timer,total=0;const chunks=[];
 try{
  await Promise.race([(async()=>{for(;;){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>16384)throw new TypeError('Oversized request');chunks.push(part.value)}})(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Body deadline')),ms)})]);
  const bytes=new Uint8Array(total);let at=0;for(const c of chunks){bytes.set(c,at);at+=c.byteLength}return JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
 }catch(error){reader.cancel().catch(()=>{});throw error}finally{clearTimeout(timer);reader.releaseLock()}
}
export function createPublicationHandler({service,authenticate,origin,timeoutMs=3000}={}){
 const base=new URL(origin);if(base.protocol!=='https:'||base.origin!==origin||!service||typeof authenticate!=='function'||!Number.isInteger(timeoutMs)||timeoutMs<1||timeoutMs>10000)throw new TypeError('Trusted publication configuration required');
 return async request=>{
  const url=new URL(request.url);if(url.origin!==origin)return json(404,{error:'Not found'});
  const privateMatch=/^\/api\/t\/([a-zA-Z0-9_-]{1,128})\/events\/([a-zA-Z0-9_-]{1,128})\/publication$/.exec(url.pathname);
  if(privateMatch){
   if(url.search)return json(400,{error:'Invalid query'});
   if(!['GET','PUT','DELETE'].includes(request.method))return json(405,{error:'Method not allowed'},{allow:'GET, PUT, DELETE'});
   if(request.headers.get('sec-fetch-site')==='cross-site'||(request.headers.has('origin')&&request.headers.get('origin')!==origin)||(request.method!=='GET'&&request.headers.get('origin')!==origin))return json(403,{error:'Origin rejected'});
   if(!/^Bearer [A-Za-z0-9._~+\/-]{1,8192}={0,2}$/.test(request.headers.get('authorization')||''))return json(401,{error:'Authentication required'});
   let principal,timer;try{principal=await Promise.race([Promise.resolve().then(()=>authenticate(request)),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error()),timeoutMs)})])}catch{return json(503,{error:'Authentication unavailable'})}finally{clearTimeout(timer)}
   const [,tenantId,eventId]=privateMatch;
   try{
    if(request.method==='GET')return json(200,{publication:await service.managed({principal,tenantId,eventId})});
    if(request.method==='DELETE')return json(200,await service.withdraw({principal,tenantId,eventId}));
    if((request.headers.get('content-type')||'').split(';')[0].trim().toLowerCase()!=='application/json')return json(415,{error:'JSON required'});
    let value;try{value=await body(request,timeoutMs)}catch{return json(400,{error:'Invalid request'})}
    if(!value||Object.getPrototypeOf(value)!==Object.prototype||Object.keys(value).sort().join(',')!=='captions,event,expectedVersion,liveUrl,permissions'||value.event?.eventId!==eventId)return json(400,{error:'Invalid publication request'});
    return json(200,await service.publish({principal,tenantId,...value}));
   }catch(error){
    if(error.message==='Not authorized')return json(403,{error:'Not authorized'});
    if(error.message==='Version conflict')return json(409,{error:'Version conflict'});
    if(error.message==='Publication evidence rejected')return json(422,{error:'Publication evidence rejected'});
    if(error instanceof TypeError)return json(400,{error:'Invalid publication request'});
    return json(503,{error:'Publication unavailable'});
   }
  }
  if(!['GET','HEAD'].includes(request.method))return json(405,{error:'Method not allowed'},{allow:'GET, HEAD'});
  if(url.pathname==='/archive.css')return new Response(request.method==='HEAD'?null:PUBLIC_CSS,{status:200,headers:{...H,'content-type':'text/css; charset=utf-8'}});
  const api=/^\/api\/t\/([a-zA-Z0-9_-]{1,128})\/events(?:\/([a-zA-Z0-9_-]{1,128}))?$/.exec(url.pathname);
  const html=/^\/t\/([a-zA-Z0-9_-]{1,128})(?:\/(watch|archive|apply|vote|sponsor)|\/events\/([a-zA-Z0-9_-]{1,128}))?$/.exec(url.pathname);
  if(!api&&!html)return json(404,{error:'Not found'});
  if([...url.searchParams.keys()].some(k=>!['after','limit','status'].includes(k))||[...url.searchParams.keys()].some(k=>url.searchParams.getAll(k).length>1))return json(400,{error:'Invalid query'});
  const tenantId=(api||html)[1],eventId=api?.[2]??html?.[3],page=eventId?'event':html?.[2]??'home';
  try{
   let event=null,events=[],nextCursor=null;
   if(eventId){if(url.search)return json(400,{error:'Invalid query'});event=await service.get({tenantId,eventId});if(!event)return json(404,{error:'Not found'})}
   else if(api||['home','watch','archive'].includes(page)){
    const raw=url.searchParams.get('limit')??'20';if(!/^[1-9][0-9]?$/.test(raw))throw new TypeError('Invalid limit');
    const result=await service.list({tenantId,after:url.searchParams.get('after'),limit:Number(raw),status:page==='archive'?'completed':url.searchParams.get('status')});events=result.events;nextCursor=result.nextCursor;
   }
   if(api){const value=event??{events,nextCursor};return request.method==='HEAD'?new Response(null,{status:200,headers:{...H,'content-type':'application/json'}}):json(200,value)}
   return new Response(request.method==='HEAD'?null:renderPublicSite({tenantId,page,event,events,nextCursor}),{status:200,headers:{...H,'content-type':'text/html; charset=utf-8'}});
  }catch(error){return json(error instanceof TypeError?400:503,{error:error instanceof TypeError?'Invalid public request':'Archive unavailable'})}
 };
}
