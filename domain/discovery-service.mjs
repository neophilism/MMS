import {industryDiscoveryProjection} from './discovery.mjs';
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
function scoped(principal,tenantId,role){
 if(!principal||principal.verified!==true||principal.tenantId!==tenantId||typeof tenantId!=='string'||!ID.test(tenantId)||
 !(principal.roles instanceof Set)||!principal.roles.has(role)||typeof principal.subject!=='string'||!ID.test(principal.subject)||
 (role==='industry'&&principal.industryVerified!==true))throw new Error('Not authorized');
}
function applicant(principal,tenantId,applicantId){scoped(principal,tenantId,'applicant');if(principal.subject!==applicantId)throw new Error('Not authorized')}
function industry(principal,tenantId){scoped(principal,tenantId,'industry')}
const generation=value=>Number.isSafeInteger(value)&&value>=0&&value<Number.MAX_SAFE_INTEGER;
function publicRow(row){return industryDiscoveryProjection({tenantId:row.tenantId,applicantId:row.applicantId,displayName:row.displayName,publicPortfolioUrl:row.publicPortfolioUrl},{verifiedIndustry:true,consented:true})}
export function createDiscoveryService(store){
 for(const method of ['saveProfile','getProfile','searchProfiles','revokeAndDeleteBookmarks','saveBookmark','listBookmarks'])
  if(typeof store?.[method]!=='function')throw new TypeError('Private discovery store adapter required');
 return {
  async ownProfile({principal,tenantId}){applicant(principal,tenantId,principal?.subject);return await store.getProfile(tenantId,principal.subject)},
  async publish({principal,profile,consentAccepted,consentRevision,expectedGeneration}){
   applicant(principal,profile?.tenantId,profile?.applicantId);
   if(consentAccepted!==true||!Number.isSafeInteger(consentRevision)||consentRevision<1)throw new Error('Explicit public portfolio consent required');
   if(!generation(expectedGeneration))throw new TypeError('Expected consent generation required');
   const publicProfile=industryDiscoveryProjection(profile,{verifiedIndustry:true,consented:true});
   const saved=await store.saveProfile(profile.tenantId,{...publicProfile,consentRevision,consentActive:true},expectedGeneration);
   if(!saved)throw new Error('Consent version conflict');
   return {applicantId:profile.applicantId,consentRevision,consentGeneration:saved.consentGeneration};
  },
  async revoke({principal,tenantId,applicantId}){
   applicant(principal,tenantId,applicantId);await store.revokeAndDeleteBookmarks(tenantId,applicantId);return {revoked:true};
  },
  async searchPage({principal,tenantId,query='',limit=20,after=null}){
   industry(principal,tenantId);
   if(typeof query!=='string'||query.length>120||!Number.isSafeInteger(limit)||limit<1||limit>50||
     (after!==null&&(typeof after!=='string'||!ID.test(after))))throw new TypeError('Invalid search');
   const rows=await store.searchProfiles(tenantId,{query:query.trim().toLocaleLowerCase('en-US'),limit:limit+1,after});
   if(!Array.isArray(rows)||rows.length>limit+1)throw new Error('Invalid search store response');
   const visible=rows.filter(row=>row.consentActive===true&&row.tenantId===tenantId);
   return {profiles:visible.slice(0,limit).map(publicRow),nextCursor:visible.length>limit?visible[limit-1].applicantId:null};
  },
  async search(args){return (await this.searchPage(args)).profiles},
  async bookmark({principal,tenantId,applicantId}){
   industry(principal,tenantId);if(typeof applicantId!=='string'||!ID.test(applicantId))throw new TypeError('Invalid applicant');
   const row=await store.getProfile(tenantId,applicantId);
   if(row?.consentActive!==true||!generation(row.consentGeneration))throw new Error('Profile unavailable');
   if(await store.saveBookmark(tenantId,principal.subject,applicantId,row.consentGeneration)!==true)throw new Error('Profile unavailable');
   return {saved:true};
  },
  async unbookmark({principal,tenantId,applicantId}){
   industry(principal,tenantId);if(typeof applicantId!=='string'||!ID.test(applicantId)||typeof store.deleteBookmark!=='function')throw new TypeError('Invalid bookmark');
   await store.deleteBookmark(tenantId,principal.subject,applicantId);return {saved:false};
  },
  async saved({principal,tenantId}){
   industry(principal,tenantId);const ids=await store.listBookmarks(tenantId,principal.subject);const out=[];
   for(const {applicantId,consentGeneration} of ids){
    const row=await store.getProfile(tenantId,applicantId);
    if(row?.tenantId===tenantId&&row.consentActive===true&&row.consentGeneration===consentGeneration)out.push(publicRow(row));
   }
   return out;
  },
 };
}
/** Isolated-test adapter with consent-generation CAS and atomic contact decisions. */
export function createMemoryDiscoveryStore(){
 const profiles=new Map(),bookmarks=new Map(),contacts=new Map();
 const pk=(t,a)=>JSON.stringify([t,a]),bk=(t,i,a)=>JSON.stringify([t,i,a]),ck=(t,a,i)=>JSON.stringify([t,a,i]);
 const active=(t,a,g)=>{const row=profiles.get(pk(t,a));return row?.consentActive===true&&row.consentGeneration===g};
 const store={
  async saveProfile(t,row,expected){
   const current=profiles.get(pk(t,row.applicantId));if((current?.consentGeneration??0)!==expected)return null;
   const next={...structuredClone(row),consentGeneration:expected+1};profiles.set(pk(t,row.applicantId),next);return structuredClone(next);
  },
  async getProfile(t,a){const row=profiles.get(pk(t,a));return row?structuredClone(row):null},
  async searchProfiles(t,{query,limit,after}){
   return [...profiles.values()].filter(r=>r.tenantId===t&&r.consentActive===true&&r.displayName.toLocaleLowerCase('en-US').includes(query)&&(!after||r.applicantId>after))
    .sort((a,b)=>a.applicantId<b.applicantId?-1:a.applicantId>b.applicantId?1:0).slice(0,limit).map(r=>structuredClone(r));
  },
  async revokeAndDeleteBookmarks(t,a){
   const row=profiles.get(pk(t,a));if(row&&!generation(row.consentGeneration))throw new Error('Consent generation exhausted');profiles.set(pk(t,a),{tenantId:t,applicantId:a,displayName:'',publicPortfolioUrl:'',consentRevision:row?.consentRevision??1,consentActive:false,consentGeneration:(row?.consentGeneration??0)+1});
   for(const [k,row] of bookmarks)if(row.tenantId===t&&row.applicantId===a)bookmarks.delete(k);
   // Contact rows remain for status/history but cannot match the new generation.
  },
  async saveBookmark(t,i,a,g){if(!active(t,a,g))return false;bookmarks.set(bk(t,i,a),{tenantId:t,applicantId:a,consentGeneration:g});return true},
  async deleteBookmark(t,i,a){bookmarks.delete(bk(t,i,a))},
  async listBookmarks(t,i){return [...bookmarks].filter(([k])=>{const [tenant,industry]=JSON.parse(k);return tenant===t&&industry===i}).map(([,row])=>structuredClone(row))},
  async requestContact(t,a,i,g){
   if(!active(t,a,g))return null;
   const key=ck(t,a,i),existing=contacts.get(key);
   if(existing?.consentGeneration===g)return structuredClone(existing);
   const row={tenantId:t,applicantId:a,industryPrincipalId:i,consentGeneration:g,status:'PENDING'};contacts.set(key,row);return structuredClone(row);
  },
  async decideContact(t,a,i,g,decision){
   const key=ck(t,a,i),row=contacts.get(key);
   if(!active(t,a,g)||row?.consentGeneration!==g||row.status!=='PENDING')return null;
   const next={...row,status:decision};contacts.set(key,next);return structuredClone(next);
  },
  async readContact(t,a,i){const row=contacts.get(ck(t,a,i));return row?structuredClone(row):null},
 };
 return store;
}
