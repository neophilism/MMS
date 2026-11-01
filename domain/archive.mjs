/** Public results projection; never turn unpublished events into public archive. */
const ID=/^[a-zA-Z0-9_-]{1,128}$/;
export function publicEventProjection(input) {
 if(!input||Object.getPrototypeOf(input)!==Object.prototype||
 Object.keys(input).sort().join(',')!=='championDisplayName,eventId,published,recordingUrl,status,title'||
 typeof input.eventId!=='string'||!ID.test(input.eventId)||typeof input.published!=='boolean'||
 !['scheduled','live','completed','cancelled'].includes(input.status)||
 typeof input.title!=='string'||!input.title.trim()||input.title.length>200||/[\u0000-\u001f\u007f]/.test(input.title)||
 !(input.championDisplayName===null||(typeof input.championDisplayName==='string'&&input.championDisplayName.trim()&&input.championDisplayName.length<=120&&!/[\u0000-\u001f\u007f]/.test(input.championDisplayName)))||
 !(input.recordingUrl===null||typeof input.recordingUrl==='string'))throw new TypeError('Invalid public event');
 if(!input.published)return null;
 if(input.recordingUrl!==null){
  const u=new URL(input.recordingUrl);
  if(u.protocol!=='https:'||u.username||u.password||u.search||u.hash)throw new TypeError('Unsafe published media URL');
 }
 return Object.freeze({eventId:input.eventId,title:input.title,status:input.status,
  championDisplayName:input.status==='completed'?input.championDisplayName:null,
  recordingUrl:input.status==='completed'?input.recordingUrl:null});
}
