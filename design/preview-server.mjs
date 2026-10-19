import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {renderLanding,renderRolePage} from './pages.mjs';
const css=await readFile(new URL('./mms.css',import.meta.url),'utf8');
export function makePreviewServer(){return createServer((req,res)=>{const path=new URL(req.url||'/', 'http://localhost').pathname;const headers={'cache-control':'no-store','x-content-type-options':'nosniff','content-security-policy':"default-src 'none'; style-src 'self'; frame-ancestors 'none'"};let status=200,body,type='text/html; charset=utf-8';if(!['GET','HEAD'].includes(req.method)){status=405;body='Method not allowed';type='text/plain'}else if(path==='/mms.css'){body=css;type='text/css; charset=utf-8'}else if(path==='/'){body=renderLanding()}else if(/^\/experience\/(performer|industry|audience)$/.test(path)){body=renderRolePage(path.split('/')[2])}else{status=404;body='Not found';type='text/plain'}res.writeHead(status,{...headers,'content-type':type});res.end(req.method==='HEAD'?'':body)})}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href)makePreviewServer().listen(Number(process.env.PORT||3000));
