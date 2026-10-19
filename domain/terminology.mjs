/** UI labels only. Underlying engine domain IDs and authorization are invariant. */
export const MMS_TERMS=Object.freeze({
 event:Object.freeze({one:'audition event',many:'audition events'}),
 participant:Object.freeze({one:'applicant',many:'applicants'}),
 performance:Object.freeze({one:'monologue',many:'monologues'}),
 judge:Object.freeze({one:'industry judge',many:'industry judges'}),
 qualifyingRound:Object.freeze({one:'qualifier',many:'qualifiers'}),
 finalRound:Object.freeze({one:'final',many:'finals'}),
 finalist:Object.freeze({one:'finalist',many:'finalists'}),
 winner:Object.freeze({one:'winner',many:'winners'}),
 champion:Object.freeze({one:'champion',many:'champions'})
});
export const ENGINE_DOMAIN_KEYS=Object.freeze(['event','participant','performance','judge','qualifyingRound','finalRound','winner','champion']);
export function mmsTerm(domain,{plural=false,locale='en-US'}={}){
 if(typeof domain!=='string'||!Object.hasOwn(MMS_TERMS,domain))throw new TypeError('Unsupported MMS term');
 if(typeof plural!=='boolean')throw new TypeError('Plural flag must be Boolean');
 if(locale!=='en-US')throw new TypeError('Unsupported locale');
 return MMS_TERMS[domain][plural?'many':'one'];
}
export function mmsCountLabel(domain,count,{locale='en-US'}={}){
 if(!Number.isSafeInteger(count)||count<0)throw new TypeError('Count must be a nonnegative safe integer');
 return new Intl.NumberFormat(locale).format(count)+' '+mmsTerm(domain,{plural:count!==1,locale});
}
export function safeMmsHeading(domain,id){
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw new TypeError('Unsafe identifier');
 return mmsTerm(domain)+' '+id;
}
