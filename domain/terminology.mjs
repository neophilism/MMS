/** UI labels only. Underlying engine domain IDs and authorization are invariant. */
export const MMS_TERMS=Object.freeze({
 event:Object.freeze({one:'audition event',many:'audition events'}),
 participant:Object.freeze({one:'applicant',many:'applicants'}),
 performance:Object.freeze({one:'monologue',many:'monologues'}),
 judge:Object.freeze({one:'industry judge',many:'industry judges'}),
 qualifyingRound:Object.freeze({one:'qualifier',many:'qualifiers'}),
 finalRound:Object.freeze({one:'final',many:'finals'}),
 winner:Object.freeze({one:'finalist',many:'finalists'}),
 champion:Object.freeze({one:'champion',many:'champions'})
});
export const ENGINE_DOMAIN_KEYS=Object.freeze(Object.keys(MMS_TERMS));
export function mmsTerm(domain,{plural=false}={}){
 if(typeof domain!=='string'||!Object.hasOwn(MMS_TERMS,domain))throw new TypeError('Unsupported engine domain term');
 if(typeof plural!=='boolean')throw new TypeError('Plural flag must be Boolean');
 return MMS_TERMS[domain][plural?'many':'one'];
}
export function safeMmsHeading(domain,id){
 if(typeof id!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(id))throw new TypeError('Unsafe identifier');
 return mmsTerm(domain)+' '+id;
}
