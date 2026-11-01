import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createPublicationHandler} from './publication.mjs';
/** No implicit listener or default identity/proof verifier. */
export function makePublicationServer(options){
 const handle=createPublicationHandler(options);
 const server=createServer({maxHeaderSize:16384},async(req,res)=>{
  const fail=status=>{res.writeHead(status,{'cache-control':'no-store','content-type':'application/json','x-content-type-options':'nosniff'});res.end('{"error":"Request unavailable"}')};
  const target=req.url||'/';
  if(!target.startsWith('/')||target.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(target)||new URL(target,options.origin).pathname!==target.split(/[?#]/,1)[0])return fail(400);
  const seen=new Set();for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(['authorization','origin','content-type','content-length','transfer-encoding'].includes(name)){if(seen.has(name))return fail(400);seen.add(name)}}
  const controller=new AbortController();req.once('aborted',()=>controller.abort());
  try{
   const response=await handle(new Request(options.origin+target,{method:req.method,headers:req.headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})}));
   if(res.destroyed)return;res.writeHead(response.status,Object.fromEntries(response.headers));res.end(req.method==='HEAD'?undefined:Buffer.from(await response.arrayBuffer()));
  }catch{if(res.headersSent||res.destroyed)res.destroy();else fail(503)}
 });
 server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;return server;
}
