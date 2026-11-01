const ID=/^[a-zA-Z0-9_-]{1,128}$/;
function scoped(principal,tenantId,role){if(!principal||principal.verified!==true||principal.tenantId!==tenantId||typeof tenantId!=='string'||!ID.test(tenantId)||!(principal.roles instanceof Set)||!principal.roles.has(role)||typeof principal.subject!=='string'||!ID.test(principal.subject)||(role==='industry'&&principal.industryVerified!==true))throw new Error('Not authorized')}
function ids(applicantId,industryPrincipalId){if(typeof applicantId!=='string'||!ID.test(applicantId)||typeof industryPrincipalId!=='string'||!ID.test(industryPrincipalId))throw new TypeError('Invalid contact scope')}
export function createContactPermissionService({profiles,requests=profiles}){
 if(typeof profiles?.getProfile!=='function'||!requests||['requestContact','decideContact','readContact'].some(method=>typeof requests[method]!=='function'))throw new TypeError('Atomic contact stores required');
 return {
  async request({principal,tenantId,applicantId}){
   scoped(principal,tenantId,'industry');ids(applicantId,principal.subject);
   const profile=await profiles.getProfile(tenantId,applicantId);
   if(profile?.consentActive!==true)throw new Error('Profile unavailable');
   const row=await requests.requestContact(tenantId,applicantId,principal.subject,profile.consentGeneration);
   if(!row)throw new Error('Profile unavailable');return {status:row.status};
  },
  async incoming({principal,tenantId}){
   scoped(principal,tenantId,'applicant');
   if(typeof requests.listContactRequests!=='function')throw new TypeError('Contact listing unavailable');
   return (await requests.listContactRequests(tenantId,principal.subject)).map(row=>({industryPrincipalId:row.industryPrincipalId,consentGeneration:row.consentGeneration,status:row.status}));
  },
  async decide({principal,tenantId,industryPrincipalId,decision,expectedGeneration}){
   scoped(principal,tenantId,'applicant');ids(principal.subject,industryPrincipalId);
   if(!['APPROVED','DECLINED'].includes(decision)||!Number.isSafeInteger(expectedGeneration)||expectedGeneration<1)throw new TypeError('Invalid decision');
   const profile=await profiles.getProfile(tenantId,principal.subject);
   if(profile?.consentActive!==true||profile.consentGeneration!==expectedGeneration)throw new Error('Request unavailable');
   const row=await requests.decideContact(tenantId,principal.subject,industryPrincipalId,profile.consentGeneration,decision);
   if(!row)throw new Error('Request unavailable');return {status:row.status};
  },
  async status({principal,tenantId,applicantId}){
   scoped(principal,tenantId,'industry');ids(applicantId,principal.subject);
   const row=await requests.readContact(tenantId,applicantId,principal.subject);
   if(!row)return {status:'NONE'};
   const profile=await profiles.getProfile(tenantId,applicantId);
   return {status:profile?.consentActive===true&&profile.consentGeneration===row.consentGeneration?row.status:'REVOKED'};
  },
 };
}
/** Adapter must share its atomic generation boundary with the profile store. */
export function createMemoryContactRequestStore(profiles){
 if(!profiles||['requestContact','decideContact','readContact'].some(method=>typeof profiles[method]!=='function'))throw new TypeError('Shared consent store required');
 return profiles;
}
