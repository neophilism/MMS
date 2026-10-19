/** Local validation only; authenticated acceptance and private storage are separate. */
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
const SHA=/^[0-9a-f]{64}$/;
const KEYS=['applicantId','consentRevision','eventId','headshotHash','representation','reelHash','resumeHash','tenantId','unionStatus'].sort();
export function validatePrivateApplication(input){
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||
    Object.keys(input).sort().join(',')!==KEYS.join(',')||
    !['applicantId','eventId','tenantId'].every(key=>typeof input[key]==='string'&&ID.test(input[key]))||
    !Number.isSafeInteger(input.consentRevision)||input.consentRevision<1)throw new TypeError('Invalid application identifiers');
 const assets={headshotHash:input.headshotHash,resumeHash:input.resumeHash,reelHash:input.reelHash};
 for(const value of Object.values(assets))if(value!==null&&(typeof value!=='string'||!SHA.test(value)))throw new TypeError('Invalid private media hash');
 if(!assets.headshotHash||!assets.resumeHash)throw new TypeError('Headshot and resume are required');
 if(!['none','agency','manager','self-represented'].includes(input.representation)||
    !['prefer-not-to-say','union','non-union'].includes(input.unionStatus))throw new TypeError('Invalid private applicant metadata');
 return Object.freeze({...input});
}
export function publicApplicationProjection(){return Object.freeze({publiclyVisible:false,discoverableByIndustry:false,requiresExplicitApplicantConsent:true})}
