/** Product-level draft defaults, not a binding engine ruleset or funded prize. */
export const MMS_DEFAULTS=Object.freeze({
 format:'timed-monologue',qualifierSeconds:90,finalSeconds:180,
 entrantWindowDays:14,tiePolicy:'manual-review',
 judgeScoring:Object.freeze({criterionIds:Object.freeze(['delivery','interpretation','stage-presence']),weightsBps:Object.freeze([4000,3500,2500])}),
 audienceVoteEnabled:false,audienceVoteWeightBps:0,battlesEnabled:false,ensembleEnabled:false,improvEnabled:false,audiencePromptsEnabled:false,
 ticketingEnabled:false,sponsorshipEnabled:false,paymentRequired:false
});
const OPTIONAL=['audienceVoteEnabled','battlesEnabled','ensembleEnabled','improvEnabled','audiencePromptsEnabled','ticketingEnabled','sponsorshipEnabled','paymentRequired'];
function plainWithKeys(value,keys){return value&&Object.getPrototypeOf(value)===Object.prototype&&Object.keys(value).sort().join(',')===keys.slice().sort().join(',')}
export function validateMmsDefaults(input,{enabledCapabilities=new Set()}={}){
 if(!plainWithKeys(input,Object.keys(MMS_DEFAULTS)))throw new TypeError('Invalid MMS defaults');
 if(input.format!=='timed-monologue'||![input.qualifierSeconds,input.finalSeconds].every(x=>Number.isSafeInteger(x)&&x>=30&&x<=600)||input.qualifierSeconds>input.finalSeconds)throw new TypeError('Invalid monologue timing');
 if(!Number.isSafeInteger(input.entrantWindowDays)||input.entrantWindowDays<1||input.entrantWindowDays>90||input.tiePolicy!=='manual-review')throw new TypeError('Invalid entry window or tie policy');
 if(!(enabledCapabilities instanceof Set))throw new TypeError('Invalid capability set');
 for(const key of OPTIONAL){if(typeof input[key]!=='boolean')throw new TypeError('Invalid optional setting');if(input[key]&&!enabledCapabilities.has(key))throw new TypeError('Unverified optional capability')}
 if(!Number.isSafeInteger(input.audienceVoteWeightBps)||input.audienceVoteWeightBps<0||input.audienceVoteWeightBps>10000||Boolean(input.audienceVoteWeightBps)!==input.audienceVoteEnabled)throw new TypeError('Invalid vote weight');
 const scoring=input.judgeScoring;
 if(!plainWithKeys(scoring,['criterionIds','weightsBps'])||!Array.isArray(scoring.criterionIds)||!Array.isArray(scoring.weightsBps)||
    scoring.criterionIds.length!==3||scoring.weightsBps.length!==3||
    new Set(scoring.criterionIds).size!==3||
    scoring.criterionIds.some(s=>typeof s!=='string'||!/^[a-z-]+$/.test(s))||
    scoring.weightsBps.some(n=>!Number.isSafeInteger(n)||n<=0||n>10000)||
    scoring.weightsBps.reduce((sum,n)=>sum+n,0)!==10000)throw new TypeError('Invalid judging rubric');
 return Object.freeze({...input,judgeScoring:Object.freeze({criterionIds:Object.freeze([...scoring.criterionIds]),weightsBps:Object.freeze([...scoring.weightsBps])})});
}
