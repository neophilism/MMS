/** Client-side validation, NOT authenticated acceptance or private storage. */
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const SHA=/^[0-9a-f]{64}$/;
function text(value,max){if(typeof value!=='string'||value.length>max||/[\u0000-\u001f\u007f]/.test(value))throw new TypeError('Invalid applicant text');return value;}
export function validatePrivateApplication(input){
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||
    Object.keys(input).sort().join(',')!=='applicantId,consentRevision,eventId,headshotHash,representation,reelHash,resumeHash,tenantId,unionStatus'||
    !ID.test(input.applicantId||'')||!ID.test(input.eventId||'')||!ID.test(input.tenantId||'')||
    !Number.isSafeInteger(input.consentRevision)||input.consentRevision<1)throw new TypeError('Invalid application identifiers');
 const assets={headshotHash:input.headshotHash,resumeHash:input.resumeHash,reelHash:input.reelHash};
 for(const value of Object.values(assets))if(value!==null&&(typeof value!=='string'||!SHA.test(value)))throw new TypeError('Invalid private media hash');
 if(!assets.headshotHash||!assets.resumeHash)throw new TypeError('Headshot and resume are required');
 if(!['none','agency','manager','self-represented'].includes(input.representation)||
    !['prefer-not-to-say','union','non-union'].includes(input.unionStatus))throw new TypeError('Invalid private applicant metadata');
 return Object.freeze({...input});
}
export function publicApplicationProjection(){return Object.freeze({publiclyVisible:false,discoverableByIndustry:false,requiresExplicitApplicantConsent:true});}
