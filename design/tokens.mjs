/** Product-owned semantic design tokens, independent of generic competition engine. */
export const MMS_TOKENS=Object.freeze({
 colors:Object.freeze({ink:'#17253b',canvas:'#f6f5f2',surface:'#ffffff',accent:'#6847b6',accentText:'#ffffff',focus:'#164fca',muted:'#4e5a69'}),
 radius:Object.freeze({card:'18px',control:'10px'}),
 spacing:Object.freeze({xs:'0.25rem',sm:'0.5rem',md:'1rem',lg:'1.5rem',xl:'2.5rem'})
});
export const BRAND='MMS';
export const ROLE_LAYOUTS=Object.freeze({
 performer:Object.freeze({label:'Performers',subtitle:'Share your work on your terms',sections:Object.freeze(['Auditions','Your submissions','Privacy controls'])}),
 industry:Object.freeze({label:'Industry',subtitle:'Discover public, consented performer portfolios',sections:Object.freeze(['Public profiles','Saved performers','Verification'])}),
 audience:Object.freeze({label:'Audience',subtitle:'Watch and follow timed monologue events',sections:Object.freeze(['Watch','Vote','Results'])})
});
export function layoutForRole(role){if(!Object.hasOwn(ROLE_LAYOUTS,role))throw new TypeError('Unsupported MMS role');return ROLE_LAYOUTS[role]}
