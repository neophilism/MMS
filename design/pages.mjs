import {BRAND, layoutForRole, ROLE_LAYOUTS} from './tokens.mjs';

export const PUBLIC_PAGES = Object.freeze({
 '/watch': Object.freeze({title:'Watch',intro:'A stage for every moment.',description:'Follow timed monologue performances when an event is published.',heading:'No event is available to watch',detail:'Live schedules, captions and playback will appear after the competition service is connected.'}),
 '/apply': Object.freeze({title:'Apply',intro:'Let your performance speak.',description:'Find audition information and prepare your monologue.',heading:'Applications are not open',detail:'Do not send headshots, résumés, reels or personal information here. A private application flow with consent controls will be available before submissions open.'}),
 '/vote': Object.freeze({title:'Vote',intro:'Be part of the audience.',description:'Audience voting is optional and depends on the event rules.',heading:'No voting round is open',detail:'Voting eligibility, opening times and rules will be shown for each event before a ballot becomes available.'}),
 '/archive': Object.freeze({title:'Archive',intro:'Remember the performances.',description:'Explore published results and champion history when available.',heading:'No results have been published',detail:'Only confirmed results and recordings cleared for publication will appear here.'}),
 '/sponsor': Object.freeze({title:'Sponsor',intro:'Support the stage.',description:'Learn about event support when sponsorship opportunities are published.',heading:'Sponsorship is not available',detail:'No payment or sponsorship commitment can be made here. Access and payment options will be stated separately for each event.'}),
});
const LINKS = Object.entries(PUBLIC_PAGES).map(([path,page])=>[path,page.title]);
function shell(title,body,currentPath='/'){
 return '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+' | '+BRAND+'</title><link rel="stylesheet" href="/mms.css"></head><body><a class="mms-skip" href="#main">Skip to content</a><header class="mms-shell"><a class="mms-brand" href="/" aria-label="MMS home"'+(currentPath==='/'?' aria-current="page"':'')+'>MMS</a><nav aria-label="Primary">'+LINKS.map(([path,label])=>'<a href="'+path+'"'+(path===currentPath?' aria-current="page"':'')+'>'+label+'</a>').join('')+'</nav></header><main class="mms-shell" id="main" tabindex="-1">'+body+'</main><footer class="mms-shell"><p>Competition features are not yet connected. No application, vote or payment can be submitted.</p></footer></body></html>';
}
export function renderLanding(){
 const roles=[['performer','Performers'],['industry','Industry'],['audience','Audience']];
 return shell('Home','<section class="mms-hero"><p class="mms-eyebrow">Timed monologue competition</p><h1>Make your moment count.</h1><p>Explore performances, application information and results when events become available.</p></section><section aria-labelledby="explore"><h2 id="explore">Explore MMS</h2><div class="mms-grid">'+roles.map(([role,label])=>'<article class="mms-card"><h3>'+label+'</h3><p>'+ROLE_LAYOUTS[role].subtitle+'</p><a href="/experience/'+role+'">Explore '+label+'</a></article>').join('')+'</div></section>');
}
export function renderRolePage(role){
 const layout=layoutForRole(role);
 return shell(layout.label,'<section class="mms-hero"><p class="mms-eyebrow">'+BRAND+' experience</p><h1>'+layout.label+'</h1><p>'+layout.subtitle+'</p></section><section aria-labelledby="areas"><h2 id="areas">Your areas</h2><div class="mms-grid">'+layout.sections.map(label=>'<article class="mms-card"><h3>'+label+'</h3><p>Available after the competition service is connected.</p></article>').join('')+'</div></section>');
}
/** Exact public allowlist; caller input is never interpolated into markup. */
export function renderPublicPage(path){
 if(path==='/')return renderLanding();
 if(typeof path!=='string')return null;
 if(Object.hasOwn(PUBLIC_PAGES,path)){
  const page=PUBLIC_PAGES[path];
  return shell(page.title,'<section class="mms-hero"><p class="mms-eyebrow">'+page.title+'</p><h1>'+page.intro+'</h1><p>'+page.description+'</p></section><section class="mms-card" aria-labelledby="availability"><h2 id="availability">'+page.heading+'</h2><p>'+page.detail+'</p></section>',path);
 }
 const match=/^\/experience\/(performer|industry|audience)$/.exec(path);
 return match?renderRolePage(match[1]):null;
}
