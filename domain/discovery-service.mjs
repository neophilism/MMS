import {industryDiscoveryProjection} from './discovery.mjs';
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
function scoped(principal,tenantId,role){if(!principal||principal.verified!==true||principal.tenantId!==tenantId||typeof tenantId!=='string'||!ID.test(tenantId)||!(principal.roles instanceof Set)||!principal.roles.has(role)||typeof principal.subject!=='string'||!ID.test(principal.subject)||(role==='industry'&&principal.industryVerified!==true))throw new Error('Not authorized')}
function applicant(principal,tenantId,applicantId){scoped(principal,tenantId,'applicant');if(principal.subject!==applicantId)throw new Error('Not authorized')}
function industry(principal,tenantId){scoped(principal,tenantId,'industry')}
export function createDiscoveryService(store){for(const method of ['saveProfile','getProfile','listProfiles','revokeAndDeleteBookmarks','saveBookmark','listBookmarks'])if(typeof store?.[method]!=='function')throw new TypeError('Private discovery store adapter required');return {
 async publish({principal,profile,consentAccepted,consentRevision}){applicant(principal,profile?.tenantId,profile?.applicantId);if(consentAccepted!==true||!Number.isSafeInteger(consentRevision)||consentRevision<1)throw new Error('Explicit public portfolio consent required');const publicProfile=industryDiscoveryProjection(profile,{verifiedIndustry:true,consented:true});await store.saveProfile(profile.tenantId,{...publicProfile,consentRevision,consentActive:true});return {applicantId:profile.applicantId,consentRevision}},
 async revoke({principal,tenantId,applicantId}){applicant(principal,tenantId,applicantId);await store.revokeAndDeleteBookmarks(tenantId,applicantId);return {revoked:true}},
 async search({principal,tenantId,query='',limit=20}){industry(principal,tenantId);if(typeof query!=='string'||query.length>120||!Number.isSafeInteger(limit)||limit<1||limit>50)throw new TypeError('Invalid search');const q=query.trim().toLocaleLowerCase('en-US');const rows=await store.listProfiles(tenantId);return rows.filter(row=>row.consentActive===true&&row.displayName.toLocaleLowerCase('en-US').includes(q)).slice(0,limit).map(row=>industryDiscoveryProjection({tenantId:row.tenantId,applicantId:row.applicantId,displayName:row.displayName,publicPortfolioUrl:row.publicPortfolioUrl},{verifiedIndustry:true,consented:true}))},
 async bookmark({principal,tenantId,applicantId}){industry(principal,tenantId);if(typeof applicantId!=='string'||!ID.test(applicantId))throw new TypeError('Invalid applicant');const row=await store.getProfile(tenantId,applicantId);if(row?.consentActive!==true)throw new Error('Profile unavailable');await store.saveBookmark(tenantId,principal.subject,applicantId);return {saved:true}},
 async saved({principal,tenantId}){industry(principal,tenantId);const ids=await store.listBookmarks(tenantId,principal.subject);const out=[];for(const applicantId of ids){const row=await store.getProfile(tenantId,applicantId);if(row?.consentActive===true)out.push(industryDiscoveryProjection({tenantId:row.tenantId,applicantId:row.applicantId,displayName:row.displayName,publicPortfolioUrl:row.publicPortfolioUrl},{verifiedIndustry:true,consented:true}))}return out}
}}
/** Isolated-test adapter; production needs transactional revocation and scoped indexes. */
export function createMemoryDiscoveryStore(){const profiles=new Map(),bookmarks=new Map();const pk=(t,a)=>JSON.stringify([t,a]),bk=(t,i)=>JSON.stringify([t,i]);return {
 async saveProfile(t,row){profiles.set(pk(t,row.applicantId),structuredClone(row))},
 async getProfile(t,a){const row=profiles.get(pk(t,a));return row?structuredClone(row):null},
 async listProfiles(t){return [...profiles.values()].filter(row=>row.tenantId===t).map(row=>structuredClone(row))},
 async revokeAndDeleteBookmarks(t,a){const row=profiles.get(pk(t,a));if(row)profiles.set(pk(t,a),{...row,consentActive:false});for(const [k,ids] of bookmarks)if(JSON.parse(k)[0]===t)ids.delete(a)},
 async saveBookmark(t,i,a){const k=bk(t,i),ids=bookmarks.get(k)||new Set();ids.add(a);bookmarks.set(k,ids)},
 async listBookmarks(t,i){return [...(bookmarks.get(bk(t,i))||new Set())]}
}}
