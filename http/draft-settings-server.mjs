import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createDraftSettingsHandler} from './draft-settings.mjs';

/** A standalone integration surface; no default authenticator or public listener.
 * Production must bind the accepted session verifier and the host's HTTPS proxy.
 * Forwarded host/protocol headers never select the canonical origin.
 */
export function makeDraftSettingsServer(options){
 const handle=createDraftSettingsHandler(options);
 const server=createServer(async(req,res)=>{
  const fail=status=>{res.writeHead(status,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end(JSON.stringify({error:'Request rejected'}))};
  const target=req.url||'/';
  if(!target.startsWith('/')||target.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(target)||
     new URL(target,options.origin).pathname!==target.split(/[?#]/,1)[0])return fail(400);
  const seen=new Set();
  for(let i=0;i<req.rawHeaders.length;i+=2){
   const name=req.rawHeaders[i].toLowerCase();
   if(['authorization','origin','content-type','content-length','transfer-encoding'].includes(name)){
    if(seen.has(name))return fail(400);
    seen.add(name);
   }
  }
  const controller=new AbortController();
  req.once('aborted',()=>controller.abort());
  try{
   const request=new Request(options.origin+target,{method:req.method,headers:req.headers,signal:controller.signal,
    ...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const response=await handle(request);
   if(res.destroyed)return;
   res.writeHead(response.status,Object.fromEntries(response.headers));
   res.end(Buffer.from(await response.arrayBuffer()));
  }catch{
   if(!res.headersSent&&!res.destroyed)fail(503);else res.destroy();
  }
 });
 server.headersTimeout=10000;
 server.requestTimeout=15000;
 server.keepAliveTimeout=5000;
 return server;
}
