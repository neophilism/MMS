import {DatabaseSync} from 'node:sqlite';
import {constants,openSync,closeSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {checkedPublication} from '../domain/publication-service.mjs';
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const scope=(tenant,event)=>{if(typeof tenant!=='string'||!ID.test(tenant)||typeof event!=='string'||!ID.test(event))throw new TypeError('Invalid publication scope')};
export function createPublicationStore(filename){
 if(typeof filename!=='string'||!isAbsolute(filename)||filename!==resolve(filename))throw new TypeError('Absolute publication path required');
 const parent=dirname(filename),dir=lstatSync(parent);
 if(!dir.isDirectory()||realpathSync(parent)!==parent||(dir.mode&0o077)!==0||(typeof process.getuid==='function'&&dir.uid!==process.getuid()))throw new Error('Private owned directory required');
 let fd;try{fd=openSync(filename,constants.O_CREAT|constants.O_EXCL|constants.O_WRONLY|constants.O_NOFOLLOW,0o600)}catch(error){if(error.code!=='EEXIST')throw error}finally{if(fd!==undefined)closeSync(fd)}
 const stat=lstatSync(filename);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||(stat.mode&0o077)!==0||(typeof process.getuid==='function'&&stat.uid!==process.getuid()))throw new Error('Private regular file required');
 const db=new DatabaseSync(filename);
 const transaction=fn=>{db.exec('BEGIN IMMEDIATE');try{const value=fn();db.exec('COMMIT');return value}catch(error){db.exec('ROLLBACK');throw error}};
 const ddl="CREATE TABLE publications(tenant TEXT NOT NULL,event TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),active INTEGER NOT NULL CHECK(active IN(0,1)),status TEXT NOT NULL,record TEXT,PRIMARY KEY(tenant,event)) STRICT";
 const decode=row=>row?{version:row.version,active:row.active===1,record:row.record===null?null:JSON.parse(row.record)}:null;
 try{
  db.exec('PRAGMA busy_timeout=1000');
  transaction(()=>{
   const version=db.prepare('PRAGMA user_version').get().user_version;
   if(version!==0&&version!==1)throw new Error('Unsupported publication schema');
   if(version===0){if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw new Error('Unrecognized publication database');db.exec(ddl+'; PRAGMA user_version=1')}
   if(db.prepare("SELECT sql FROM sqlite_master WHERE name='publications'").get()?.sql!==ddl)throw new Error('Invalid publication schema');
  });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL');
  const read=db.prepare('SELECT * FROM publications WHERE tenant=? AND event=?');
  return {
   read(tenant,event){scope(tenant,event);return decode(read.get(tenant,event))},
   compareAndSwap(tenant,event,expected,next){
    scope(tenant,event);if(!Number.isSafeInteger(expected)||expected<0||expected>=Number.MAX_SAFE_INTEGER||next?.version!==expected+1||next.active!==true)throw new TypeError('Invalid publication version');
    const record=checkedPublication(next.record);if(record.tenantId!==tenant||record.eventId!==event)throw new TypeError('Publication scope mismatch');
    return transaction(()=>{
     const row=read.get(tenant,event);if((row?.version??0)!==expected)return false;
     db.prepare('INSERT INTO publications VALUES(?,?,?,?,?,?) ON CONFLICT(tenant,event) DO UPDATE SET version=excluded.version,active=excluded.active,status=excluded.status,record=excluded.record').run(tenant,event,next.version,1,record.projection.status,JSON.stringify(record));return true;
    });
   },
   withdraw(tenant,event){
    scope(tenant,event);return transaction(()=>{
     const row=read.get(tenant,event),version=Math.min((row?.version??0)+1,Number.MAX_SAFE_INTEGER);
     db.prepare("INSERT INTO publications VALUES(?,?,?,0,'withdrawn',NULL) ON CONFLICT(tenant,event) DO UPDATE SET version=excluded.version,active=0,status='withdrawn',record=NULL").run(tenant,event,version);
     return {version,withdrawn:true};
    });
   },
   list(tenant,{after=null,limit=20,status=null}){
    scope(tenant,'validation');if(after!==null)scope(tenant,after);
    if(!Number.isSafeInteger(limit)||limit<1||limit>51||(status!==null&&!['scheduled','live','completed','cancelled'].includes(status)))throw new TypeError('Invalid publication list');
    return db.prepare('SELECT * FROM publications WHERE tenant=? AND active=1 AND (? IS NULL OR event>?) AND (? IS NULL OR status=?) ORDER BY event LIMIT ?').all(tenant,after,after,status,status,limit).map(decode);
   },
   close(){db.close()},
  };
 }catch(error){db.close();throw error}
}
