import {createServer} from 'node:http';
import {Readable} from 'node:stream';
import {createDiscoveryHandler} from './discovery.mjs';
/** Callers explicitly bind the trusted verifier, durable service and notice. */
export function makeDiscoveryServer(options){
 const handle=createDiscoveryHandler(options);
 const server=createServer(async(req,res)=>{
  const fail=()=>{res.writeHead(400,{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'});res.end('{"error":"Invalid request"}')};
  const target=req.url||'/';
  if(!target.startsWith('/')||target.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(target)||new URL(target,options.origin).pathname!==target.split(/[?#]/,1)[0])return fail();
  const seen=new Set();
  for(let i=0;i<req.rawHeaders.length;i+=2){const name=req.rawHeaders[i].toLowerCase();if(['authorization','origin','content-type','content-length','transfer-encoding'].includes(name)){if(seen.has(name))return fail();seen.add(name)}}
  const controller=new AbortController();req.once('aborted',()=>controller.abort());
  try{
   const request=new Request(options.origin+target,{method:req.method,headers:req.headers,signal:controller.signal,...(!['GET','HEAD'].includes(req.method)?{body:Readable.toWeb(req),duplex:'half'}:{})});
   const response=await handle(request);if(res.destroyed)return;
   res.writeHead(response.status,Object.fromEntries(response.headers));res.end(Buffer.from(await response.arrayBuffer()));
  }catch{if(res.headersSent||res.destroyed)res.destroy();else{res.writeHead(503,{'content-type':'application/json','cache-control':'no-store'});res.end('{"error":"Discovery unavailable"}')}}
 });
 server.headersTimeout=10000;server.requestTimeout=15000;server.keepAliveTimeout=5000;
 return server;
}
