import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {pathToFileURL} from 'node:url';
import {renderPublicPage} from './pages.mjs';
const css=await readFile(new URL('./mms.css',import.meta.url),'utf8');
const HEADERS=Object.freeze({
 'cache-control':'no-store',
 'x-content-type-options':'nosniff',
 'referrer-policy':'no-referrer',
 'content-security-policy':"default-src 'none'; style-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'",
});
/** Public-only handler. Unknown/private paths fall through without a response. */
export function createPublicHandler(){
 return (req,res)=>{
  const reply=(status,type,body,extra={})=>{
   res.writeHead(status,{...HEADERS,'content-type':type,...extra});
   res.end(req.method==='HEAD'?'':body);
   return true;
  };
  const target=req.url||'/';
  if(!target.startsWith('/')||target.startsWith('//')||/[\\\u0000-\u0020\u007f]/.test(target))
   return reply(400,'text/plain; charset=utf-8','Bad request');
  let url;
  try{url=new URL(target,'http://localhost')}catch{return reply(400,'text/plain; charset=utf-8','Bad request')}
  const path=url.pathname;
  if(target.split(/[?#]/,1)[0]!==path||path.includes('%')||url.hash)
   return reply(400,'text/plain; charset=utf-8','Bad request');
  const body=path==='/mms.css'?css:renderPublicPage(path);
  if(body===null)return false;
  if(!['GET','HEAD'].includes(req.method))
   return reply(405,'text/plain; charset=utf-8','Method not allowed',{allow:'GET, HEAD'});
  return reply(200,path==='/mms.css'?'text/css; charset=utf-8':'text/html; charset=utf-8',body);
 };
}
export function makePreviewServer(){
 const handle=createPublicHandler();
 return createServer((req,res)=>{
  if(!handle(req,res)){
   res.writeHead(404,{...HEADERS,'content-type':'text/plain; charset=utf-8'});
   res.end(req.method==='HEAD'?'':'Not found');
  }
 });
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)
 makePreviewServer().listen(Number(process.env.PORT||3000),'127.0.0.1');
