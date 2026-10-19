/** No private applications enter public industry search results. */
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
export function industryDiscoveryProjection(profile,{verifiedIndustry=false,consented=false}={}){
 if(!profile||Object.getPrototypeOf(profile)!==Object.prototype||
    Object.keys(profile).sort().join(',')!=='applicantId,displayName,publicPortfolioUrl,tenantId'||
    !ID.test(profile.applicantId||'')||!ID.test(profile.tenantId||'')||
    typeof profile.displayName!=='string'||profile.displayName.length>120||
    typeof profile.publicPortfolioUrl!=='string')throw new TypeError('Invalid profile projection');
 if(verifiedIndustry!==true||consented!==true)return null;
 const url=new URL(profile.publicPortfolioUrl);
 if(url.protocol!=='https:'||url.username||url.password||url.hash||url.search)throw new TypeError('Unsafe public portfolio URL');
 return Object.freeze({...profile,publicPortfolioUrl:url.href});
}
export function bookmarkIntent({industryPrincipalId,applicantId,tenantId}){
 if(![industryPrincipalId,applicantId,tenantId].every(x=>typeof x==='string'&&ID.test(x)))
 throw new TypeError('Invalid bookmark scope');
 return Object.freeze({industryPrincipalId,applicantId,tenantId,writeAuthorized:false});
}
