import {DatabaseSync} from 'node:sqlite';
import {constants,openSync,closeSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {validateMmsDefaults,MMS_DEFAULTS} from '../domain/defaults.mjs';

const ALL_CAPABILITIES=new Set(Object.keys(MMS_DEFAULTS).filter(k=>typeof MMS_DEFAULTS[k]==='boolean'));
const validVersion=v=>Number.isSafeInteger(v)&&v>=0&&v<Number.MAX_SAFE_INTEGER;
function scope(tenant,event){
 if(typeof tenant!=='string'||!/^[a-z0-9-]{1,64}$/.test(tenant)||typeof event!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(event))
  throw new TypeError('Invalid tenant or event');
}
function checkedRow(row){
 if(!row||Object.getPrototypeOf(row)!==Object.prototype||Object.keys(row).sort().join(',')!=='settings,version'||
    !Number.isSafeInteger(row.version)||row.version<1)throw new Error('Invalid stored draft');
 return {version:row.version,settings:validateMmsDefaults(row.settings,{enabledCapabilities:ALL_CAPABILITIES})};
}
/** Host-local SQLite adapter. Requires an existing owner-only directory.
 * It stores drafts only; it cannot publish rules or grant engine capabilities.
 */
export function createSqliteDraftStore(filename){
 if(typeof filename!=='string'||!isAbsolute(filename)||filename!==resolve(filename))throw new TypeError('Absolute database path required');
 const parent=dirname(filename),dir=lstatSync(parent);
 if(!dir.isDirectory()||dir.isSymbolicLink()||realpathSync(parent)!==parent||
    (dir.mode&0o077)!==0||(typeof process.getuid==='function'&&dir.uid!==process.getuid()))
  throw new Error('Private owned database directory required');
 let fd;
 try{fd=openSync(filename,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)}
 catch(error){if(error.code!=='EEXIST')throw error}
 finally{if(fd!==undefined)closeSync(fd)}
 const stat=lstatSync(filename);
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||(stat.mode&0o077)!==0||
    (typeof process.getuid==='function'&&stat.uid!==process.getuid()))throw new Error('Private regular database file required');
 const db=new DatabaseSync(filename);
 try{
  db.exec('PRAGMA busy_timeout=1000; PRAGMA foreign_keys=ON;');
  db.exec('BEGIN IMMEDIATE');
  try{
   const version=db.prepare('PRAGMA user_version').get().user_version;
   if(version!==0&&version!==1)throw new Error('Unsupported draft schema version');
   if(version===0){
    const tables=db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all();
    if(tables.length)throw new Error('Refusing an unrecognized database');
    db.exec('CREATE TABLE mms_drafts (tenant TEXT NOT NULL,event TEXT NOT NULL,version INTEGER NOT NULL CHECK(version>0),settings TEXT NOT NULL,PRIMARY KEY(tenant,event)) STRICT; PRAGMA user_version=1;');
   }
   // Fail on a missing or incompatible schema rather than recreate over data.
   const columns=db.prepare('PRAGMA table_info(mms_drafts)').all();
   const signature=columns.map(c=>[c.name,c.type,c.notnull,c.pk].join(':')).join(',');
   const table=db.prepare("PRAGMA table_list").all().find(t=>t.name==='mms_drafts'&&t.schema==='main');
   if(signature!=='tenant:TEXT:1:1,event:TEXT:1:2,version:INTEGER:1:0,settings:TEXT:1:0'||table?.strict!==1)throw new Error('Invalid draft schema');
   db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error}
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  const read=db.prepare('SELECT version,settings FROM mms_drafts WHERE tenant=? AND event=?');
  const insert=db.prepare('INSERT OR IGNORE INTO mms_drafts(tenant,event,version,settings) VALUES(?,?,?,?)');
  const update=db.prepare('UPDATE mms_drafts SET version=?,settings=? WHERE tenant=? AND event=? AND version=?');
  return {
   read(tenant,event){scope(tenant,event);const row=read.get(tenant,event);return row?checkedRow({version:row.version,settings:JSON.parse(row.settings)}):null},
   compareAndSwap(tenant,event,expected,next){
    scope(tenant,event);
    if(!validVersion(expected))throw new TypeError('Invalid expected version');
    const checked=checkedRow(next);
    if(checked.version!==expected+1)throw new TypeError('Invalid next version');
    const json=JSON.stringify(checked.settings);
    const result=expected===0?insert.run(tenant,event,checked.version,json):update.run(checked.version,json,tenant,event,expected);
    return result.changes===1;
   },
   close(){db.close()},
  };
 }catch(error){db.close();throw error}
}
