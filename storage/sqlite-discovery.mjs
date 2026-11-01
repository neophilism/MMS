import {DatabaseSync} from 'node:sqlite';
import {constants,openSync,closeSync,lstatSync,realpathSync} from 'node:fs';
import {resolve,dirname,isAbsolute} from 'node:path';
import {industryDiscoveryProjection} from '../domain/discovery.mjs';
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const id=value=>{if(typeof value!=='string'||!ID.test(value))throw new TypeError('Invalid discovery scope')};
const generation=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;
function privateFile(filename){
 if(typeof filename!=='string'||!isAbsolute(filename)||filename!==resolve(filename))throw new TypeError('Absolute database path required');
 const parent=dirname(filename),dir=lstatSync(parent);
 if(!dir.isDirectory()||realpathSync(parent)!==parent||(dir.mode&0o077)!==0||
 (typeof process.getuid==='function'&&dir.uid!==process.getuid()))throw new Error('Private owned directory required');
 let fd;try{fd=openSync(filename,constants.O_WRONLY|constants.O_CREAT|constants.O_EXCL|constants.O_NOFOLLOW,0o600)}
 catch(error){if(error.code!=='EEXIST')throw error}finally{if(fd!==undefined)closeSync(fd)}
 const file=lstatSync(filename);
 if(!file.isFile()||file.isSymbolicLink()||file.nlink!==1||(file.mode&0o077)!==0||
 (typeof process.getuid==='function'&&file.uid!==process.getuid()))throw new Error('Private regular file required');
}
const SCHEMA=`
CREATE TABLE profiles(tenant TEXT NOT NULL,applicant TEXT NOT NULL,name TEXT NOT NULL,url TEXT NOT NULL,search_name TEXT NOT NULL,revision INTEGER NOT NULL CHECK(revision>0),generation INTEGER NOT NULL CHECK(generation>0),active INTEGER NOT NULL CHECK(active IN (0,1)),PRIMARY KEY(tenant,applicant)) STRICT;
CREATE TABLE bookmarks(tenant TEXT NOT NULL,industry TEXT NOT NULL,applicant TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),PRIMARY KEY(tenant,industry,applicant),FOREIGN KEY(tenant,applicant) REFERENCES profiles(tenant,applicant)) STRICT;
CREATE TABLE contacts(tenant TEXT NOT NULL,applicant TEXT NOT NULL,industry TEXT NOT NULL,generation INTEGER NOT NULL CHECK(generation>0),status TEXT NOT NULL CHECK(status IN ('PENDING','APPROVED','DECLINED')),PRIMARY KEY(tenant,applicant,industry),FOREIGN KEY(tenant,applicant) REFERENCES profiles(tenant,applicant)) STRICT;
CREATE INDEX profiles_visibility ON profiles(tenant,active,applicant);
PRAGMA user_version=1;`;
function profile(row){return row?{tenantId:row.tenant,applicantId:row.applicant,displayName:row.name,publicPortfolioUrl:row.url,consentRevision:row.revision,consentGeneration:row.generation,consentActive:row.active===1}:null}
function contact(row){return row?{tenantId:row.tenant,applicantId:row.applicant,industryPrincipalId:row.industry,consentGeneration:row.generation,status:row.status}:null}
/** Durable consent, bookmarks and contacts share one transactional database. */
export function createSqliteDiscoveryStore(filename){
 privateFile(filename);const db=new DatabaseSync(filename);
 const transaction=fn=>{
  db.exec('BEGIN IMMEDIATE');try{const result=fn();db.exec('COMMIT');return result}catch(error){db.exec('ROLLBACK');throw error}
 };
 try{
  db.exec('PRAGMA foreign_keys=ON; PRAGMA busy_timeout=1000;');
  transaction(()=>{
   const version=db.prepare('PRAGMA user_version').get().user_version;
   if(version!==0&&version!==1)throw new Error('Unsupported discovery schema');
   if(version===0){
    if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().length)throw new Error('Unrecognized discovery database');
    db.exec(SCHEMA);
   }
   // Verify exact source-owned schema, including keys/checks and tenant FKs.
   const expected=new DatabaseSync(':memory:');
   try{
    expected.exec(SCHEMA);
    const shape=connection=>connection.prepare("SELECT type,name,sql FROM sqlite_master WHERE sql IS NOT NULL ORDER BY type,name").all();
    if(JSON.stringify(shape(db))!==JSON.stringify(shape(expected)))throw new Error('Invalid discovery schema');
   }finally{expected.close()}
  });
  db.exec('PRAGMA journal_mode=WAL; PRAGMA synchronous=FULL;');
  const get=db.prepare('SELECT * FROM profiles WHERE tenant=? AND applicant=?');
  const active=(tenant,applicant,g)=>{const row=get.get(tenant,applicant);return row?.active===1&&row.generation===g};
  const getContact=db.prepare('SELECT * FROM contacts WHERE tenant=? AND applicant=? AND industry=?');
  return {
   getProfile(tenant,applicant){id(tenant);id(applicant);return profile(get.get(tenant,applicant))},
   saveProfile(tenant,row,expected){
    id(tenant);if(!generation(expected)||row.tenantId!==tenant||!Number.isSafeInteger(row.consentRevision)||row.consentRevision<1||row.consentActive!==true)throw new TypeError('Invalid consent');
    const p=industryDiscoveryProjection({tenantId:tenant,applicantId:row.applicantId,displayName:row.displayName,publicPortfolioUrl:row.publicPortfolioUrl},{verifiedIndustry:true,consented:true});
    return transaction(()=>{
     const current=get.get(tenant,p.applicantId);if((current?.generation??0)!==expected)return null;
     db.prepare('INSERT INTO profiles VALUES(?,?,?,?,?,?,?,1) ON CONFLICT(tenant,applicant) DO UPDATE SET name=excluded.name,url=excluded.url,search_name=excluded.search_name,revision=excluded.revision,generation=excluded.generation,active=1').run(tenant,p.applicantId,p.displayName,p.publicPortfolioUrl,p.displayName.toLocaleLowerCase('en-US'),row.consentRevision,expected+1);
     return profile(get.get(tenant,p.applicantId));
    });
   },
   searchProfiles(tenant,{query,limit,after=null}){
    id(tenant);if(typeof query!=='string'||query.length>120||!Number.isSafeInteger(limit)||limit<1||limit>51)throw new TypeError('Invalid search');if(after!==null)id(after);
    return db.prepare('SELECT * FROM profiles WHERE tenant=? AND active=1 AND instr(search_name,?)>0 AND (? IS NULL OR applicant>?) ORDER BY applicant LIMIT ?').all(tenant,query,after,after,limit).map(profile);
   },
   revokeAndDeleteBookmarks(tenant,applicant){
    id(tenant);id(applicant);return transaction(()=>{
     const row=get.get(tenant,applicant);
     if(row){if(!generation(row.generation))throw new Error('Consent generation exhausted');db.prepare("UPDATE profiles SET active=0,generation=generation+1,name='',url='',search_name='' WHERE tenant=? AND applicant=?").run(tenant,applicant)}
     else db.prepare("INSERT INTO profiles VALUES(?,?,'','','',1,1,0)").run(tenant,applicant);
     db.prepare('DELETE FROM bookmarks WHERE tenant=? AND applicant=?').run(tenant,applicant);
    });
   },
   saveBookmark(tenant,industry,applicant,g){
    [tenant,industry,applicant].forEach(id);if(!generation(g)||g<1)throw new TypeError('Invalid consent generation');
    return transaction(()=>{
     if(!active(tenant,applicant,g))return false;
     db.prepare('INSERT INTO bookmarks VALUES(?,?,?,?) ON CONFLICT(tenant,industry,applicant) DO UPDATE SET generation=excluded.generation').run(tenant,industry,applicant,g);return true;
    });
   },
   deleteBookmark(tenant,industry,applicant){[tenant,industry,applicant].forEach(id);db.prepare('DELETE FROM bookmarks WHERE tenant=? AND industry=? AND applicant=?').run(tenant,industry,applicant)},
   listBookmarks(tenant,industry){
    id(tenant);id(industry);
    return db.prepare('SELECT b.applicant,b.generation FROM bookmarks b JOIN profiles p ON p.tenant=b.tenant AND p.applicant=b.applicant AND p.generation=b.generation AND p.active=1 WHERE b.tenant=? AND b.industry=? ORDER BY b.applicant LIMIT 50').all(tenant,industry).map(row=>({applicantId:row.applicant,consentGeneration:row.generation}));
   },
   requestContact(tenant,applicant,industry,g){
    [tenant,applicant,industry].forEach(id);if(!generation(g)||g<1)throw new TypeError('Invalid consent generation');
    return transaction(()=>{
     if(!active(tenant,applicant,g))return null;
     const current=getContact.get(tenant,applicant,industry);if(current?.generation===g)return contact(current);
     db.prepare("INSERT INTO contacts VALUES(?,?,?,?,'PENDING') ON CONFLICT(tenant,applicant,industry) DO UPDATE SET generation=excluded.generation,status='PENDING'").run(tenant,applicant,industry,g);
     return contact(getContact.get(tenant,applicant,industry));
    });
   },
   decideContact(tenant,applicant,industry,g,decision){
    [tenant,applicant,industry].forEach(id);if(!generation(g)||!['APPROVED','DECLINED'].includes(decision))throw new TypeError('Invalid contact decision');
    return transaction(()=>{
     if(!active(tenant,applicant,g))return null;
     const result=db.prepare("UPDATE contacts SET status=? WHERE tenant=? AND applicant=? AND industry=? AND generation=? AND status='PENDING'").run(decision,tenant,applicant,industry,g);
     return result.changes===1?contact(getContact.get(tenant,applicant,industry)):null;
    });
   },
   readContact(tenant,applicant,industry){[tenant,applicant,industry].forEach(id);return contact(getContact.get(tenant,applicant,industry))},
   close(){db.close()},
  };
 }catch(error){db.close();throw error}
}
