import test from 'node:test';
import assert from 'node:assert/strict';
import {MMS_TERMS,ENGINE_DOMAIN_KEYS,mmsCountLabel} from '../domain/terminology.mjs';
import {renderMmsCounts,renderMmsRecordHeading} from '../views/terminology.mjs';

test('all declared terms including finalists are available to view consumers',()=>{
 assert.deepEqual(ENGINE_DOMAIN_KEYS,Object.keys(MMS_TERMS));
 const html=renderMmsCounts(ENGINE_DOMAIN_KEYS.map(domain=>({domain,count:1})));
 for(const domain of ENGINE_DOMAIN_KEYS)assert.ok(html.includes(mmsCountLabel(domain,1)));
 assert.match(html,/1 finalist/);assert.match(html,/1 winner/);assert.match(html,/1 champion/);
});
test('counts render one coherent accessible text label without exposing record data',()=>{
 const html=renderMmsCounts([{domain:'participant',count:0},{domain:'performance',count:2000}]);
 assert.match(html,/aria-label="Competition counts"/);
 assert.match(html,/0 applicants/);assert.match(html,/2,000 monologues/);
 assert.doesNotMatch(html,/aria-hidden|aria-live|role="status"/);
 assert.throws(()=>renderMmsCounts([{domain:'participant',count:1,email:'private@example.test'}]));
});
test('invalid counts, domains, duplicate rows and unapproved locales fail closed',()=>{
 for(const count of [-1,NaN,Infinity,1.5,Number.MAX_SAFE_INTEGER+1,'1',null])
  assert.throws(()=>renderMmsCounts([{domain:'participant',count}]));
 for(const domain of ['__proto__','constructor','<script>','admin',null])
  assert.throws(()=>renderMmsCounts([{domain,count:1}]));
 assert.throws(()=>renderMmsCounts([{domain:'winner',count:1},{domain:'winner',count:2}]));
 assert.throws(()=>renderMmsCounts([], {locale:'fr-FR'}));
 assert.throws(()=>renderMmsCounts({participant:1}));
 assert.throws(()=>renderMmsCounts(Array(10).fill({domain:'winner',count:1})));
});
test('record headings preserve engine ID and never invent stage transitions',()=>{
 assert.equal(renderMmsRecordHeading('performance','perf_42'),'<h2>monologue perf_42</h2>');
 assert.equal(renderMmsRecordHeading('winner','p-1',{level:3}),'<h3>winner p-1</h3>');
 for(const id of ['<img src=x>','x&y','../private','x"',''])assert.throws(()=>renderMmsRecordHeading('participant',id));
 for(const level of [0,7,2.5,'2','h2 onclick=evil'])assert.throws(()=>renderMmsRecordHeading('participant','p1',{level}));
});
