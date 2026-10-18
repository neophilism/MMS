/** Product-level draft defaults, not a binding engine ruleset or funded prize. */
export const MMS_DEFAULTS=Object.freeze({
 format:'timed-monologue',qualifierSeconds:90,finalSeconds:180,
 judgeScoring:Object.freeze({criterionIds:Object.freeze(['delivery','interpretation','stage-presence']),weightsBps:Object.freeze([4000,3500,2500])}),
 audienceVoteEnabled:false,battlesEnabled:false,ensembleEnabled:false,improvEnabled:false,audiencePromptsEnabled:false,
 ticketingEnabled:false,sponsorshipEnabled:false,paymentRequired:false
});
export function validateMmsDefaults(input){
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||
    Object.keys(input).sort().join(',')!==Object.keys(MMS_DEFAULTS).sort().join(','))
 throw new TypeError('Invalid MMS defaults');
 if(input.format!=='timed-monologue'||![input.qualifierSeconds,input.finalSeconds].every(x=>Number.isSafeInteger(x)&&x>=30&&x<=600))
 throw new TypeError('Invalid monologue timing');
 for(const key of ['audienceVoteEnabled','battlesEnabled','ensembleEnabled','improvEnabled','audiencePromptsEnabled','ticketingEnabled','sponsorshipEnabled','paymentRequired'])
 if(typeof input[key]!=='boolean')throw new TypeError('Invalid optional setting');
 const scoring=input.judgeScoring;
 if(!scoring||!Array.isArray(scoring.criterionIds)||!Array.isArray(scoring.weightsBps)||
    scoring.criterionIds.length!==3||scoring.weightsBps.length!==3||
    new Set(scoring.criterionIds).size!==3||
    scoring.criterionIds.some(s=>typeof s!=='string'||!/^[a-z-]+$/.test(s))||
    scoring.weightsBps.some(n=>!Number.isSafeInteger(n)||n<0||n>10000)||
    scoring.weightsBps.reduce((sum,n)=>sum+n,0)!==10000)
 throw new TypeError('Invalid judging rubric');
 return Object.freeze({...input,judgeScoring:Object.freeze({criterionIds:Object.freeze([...scoring.criterionIds]),weightsBps:Object.freeze([...scoring.weightsBps])})});
}
