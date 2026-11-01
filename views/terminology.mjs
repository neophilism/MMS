import {mmsTerm,mmsCountLabel,safeMmsHeading,ENGINE_DOMAIN_KEYS} from '../domain/terminology.mjs';

const escapeHtml=value=>value.replace(/[&<>"']/g,ch=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
/** Render product nouns without modifying engine identifiers or outcome states.
 * Supply aggregate counts only after the caller authorizes their visibility.
 * This view never reads or serializes an applicant/profile record.
 */
export function renderMmsCounts(counts,{locale='en-US'}={}){
 if(!Array.isArray(counts)||counts.length>ENGINE_DOMAIN_KEYS.length)
  throw new TypeError('Expected a bounded MMS count list');
 const seen=new Set();
 const rows=counts.map(row=>{
  if(!row||typeof row!=='object'||Array.isArray(row)||Object.keys(row).some(k=>!['domain','count'].includes(k)))
   throw new TypeError('Expected domain and count only');
  const {domain,count}=row;
  mmsTerm(domain,{plural:count!==1,locale});
  const label=mmsCountLabel(domain,count,{locale});
  if(seen.has(domain))throw new TypeError('Duplicate MMS count');
  seen.add(domain);
  // A single text node gives screen readers the same complete count as sighted readers.
  return '<li data-mms-domain="'+domain+'"><span class="mms-count">'+escapeHtml(label)+'</span></li>';
 });
 if(locale!=='en-US')throw new TypeError('Unsupported locale');
 return '<ul class="mms-counts" aria-label="Competition counts">'+rows.join('')+'</ul>';
}

/** Heading text is escaped even though the domain and identifier are allowlisted. */
export function renderMmsRecordHeading(domain,id,{level=2}={}){
 if(!Number.isInteger(level)||level<1||level>6)throw new TypeError('Invalid heading level');
 return '<h'+level+'>'+escapeHtml(safeMmsHeading(domain,id))+'</h'+level+'>';
}
