import {createServer} from 'node:http';
import {route,authorized,render} from './app.mjs';
import {engineOrigin,engineHealth} from './engine.mjs';
const configuredEngine=engineOrigin(process.env.MMS_ENGINE_ORIGIN||'');
function reply(req,res,status,type,body){res.writeHead(status,{'content-type':type,'cache-control':'no-store','x-content-type-options':'nosniff','referrer-policy':'no-referrer','content-security-policy':"default-src 'none'; style-src 'unsafe-inline'; frame-ancestors 'none'"});res.end(req.method==='HEAD'?'':body)}
export function createHandler({authenticate,engine=configuredEngine,fetchImpl=fetch}={}){return async function handler(req,res){
 if(!['GET','HEAD'].includes(req.method))return reply(req,res,405,'text/plain','Method not allowed');
 let path;try{path=new URL(req.url||'/', 'http://localhost').pathname}catch{return reply(req,res,400,'text/plain','Bad request')}
 if(path==='/health')return reply(req,res,200,'application/json',JSON.stringify({status:'ok',productionReady:false}));
 if(path==='/ready'){const health=await engineHealth(engine,{fetchImpl});return reply(req,res,health.connected?200:503,'application/json',JSON.stringify({engineConnected:health.connected,productionReady:false}))}
 const page=route(path);if(!page)return reply(req,res,404,'text/plain','Not found');
 let session=null;if(!page.public&&typeof authenticate==='function'){try{session=await authenticate(req)}catch{return reply(req,res,503,'text/plain','Authentication unavailable')}}
 if(!authorized(page,session))return reply(req,res,404,'text/plain','Not found');
 return reply(req,res,200,'text/html; charset=utf-8',render(page));
}}
export const handler=createHandler();
export function makeServer(options){const handle=createHandler(options);return createServer((req,res)=>{Promise.resolve(handle(req,res)).catch(()=>{if(!res.headersSent)reply(req,res,503,'text/plain','Service unavailable');else res.destroy()})})}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)makeServer().listen(Number(process.env.PORT||3000));
