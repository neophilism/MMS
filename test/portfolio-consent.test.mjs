import test from 'node:test';
import assert from 'node:assert/strict';
import {renderPortfolioConsent,portfolioPublication,mountPortfolioConsent} from '../views/portfolio-consent.mjs';
const notice={revision:1,text:'Synthetic test notice: public portfolio discovery only.'};
const fields=()=>new Map([['displayName','Performer'],['publicPortfolioUrl','https://portfolio.example/'],['consentAccepted',true]]);
test('consent UI requires host notice, leaves checkbox unchecked and escapes supplied text',()=>{
 assert.throws(()=>renderPortfolioConsent());assert.throws(()=>renderPortfolioConsent({notice:{revision:1,text:''}}));
 const html=renderPortfolioConsent({notice:{...notice,text:'<script>not executable</script>'}});
 assert.match(html,/&lt;script&gt;/);assert.doesNotMatch(html,/<script/);assert.doesNotMatch(html,/ checked/);
 assert.match(html,/aria-describedby="mms-publication-notice"/);assert.match(html,/type="submit" disabled/);assert.match(html,/Revoke publication consent/);
});
test('publication payload contains only public fields, explicit consent and current generation',()=>{
 const f=fields();f.set('industryVerified',true);f.set('tenantId','attacker');
 assert.deepEqual(portfolioPublication(f,{notice,expectedGeneration:2}),{displayName:'Performer',publicPortfolioUrl:'https://portfolio.example/',consentAccepted:true,consentRevision:1,expectedGeneration:2});
 for(const accepted of [false,'true','on',null]){const f=fields();f.set('consentAccepted',accepted);assert.throws(()=>portfolioPublication(f,{notice,expectedGeneration:0}))}
 for(const url of ['javascript:alert(1)','https://u:p@portfolio.example/','https://portfolio.example/?token=secret']){const f=fields();f.set('publicPortfolioUrl',url);assert.throws(()=>portfolioPublication(f,{notice,expectedGeneration:0}))}
});
test('notice mismatch or unavailable identity leaves no form or previous profile data',async()=>{
 const root={innerHTML:'old profile',textContent:'',querySelector:()=>null,addEventListener(){},removeEventListener(){}};
 // Real DOM textContent replaces children; the test double records the resulting message.
 const mount=mountPortfolioConsent(root,{client:{ownProfile:async()=>({profile:null,consentRevision:2})},notice});await mount.ready;
 assert.match(root.textContent,/current publication notice/);mount.dispose();assert.equal(root.innerHTML,'');
});
