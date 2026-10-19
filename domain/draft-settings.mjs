import {validateMmsDefaults} from './defaults.mjs';
function authorize(principal,tenantId,eventId){if(!principal||principal.verified!==true||principal.tenantId!==tenantId||!(principal.roles instanceof Set)||!principal.roles.has('producer'))throw new Error('Not authorized');if(typeof tenantId!=='string'||!/^[a-z0-9-]{1,64}$/.test(tenantId)||typeof eventId!=='string'||!/^[a-zA-Z0-9_-]{1,128}$/.test(eventId))throw new TypeError('Invalid tenant or event')}
export function createDraftSettingsService(store){if(!store||typeof store.read!=='function'||typeof store.compareAndSwap!=='function')throw new TypeError('Durable store adapter required');return {
 async read({principal,tenantId,eventId}){authorize(principal,tenantId,eventId);const row=await store.read(tenantId,eventId);return row?structuredClone(row):null},
 async save({principal,tenantId,eventId,expectedVersion,settings,enabledCapabilities=new Set()}){authorize(principal,tenantId,eventId);if(!Number.isSafeInteger(expectedVersion)||expectedVersion<0)throw new TypeError('Invalid version');const checked=validateMmsDefaults(settings,{enabledCapabilities});const next={version:expectedVersion+1,settings:structuredClone(checked)};const saved=await store.compareAndSwap(tenantId,eventId,expectedVersion,next);if(!saved)throw new Error('Version conflict');return structuredClone(next)}
}}
/** Isolated-test adapter; production must provide durable atomic compare-and-swap. */
export function createMemoryDraftStore(){const rows=new Map();const key=(tenant,event)=>JSON.stringify([tenant,event]);return {
 async read(tenant,event){const row=rows.get(key(tenant,event));return row?structuredClone(row):null},
 async compareAndSwap(tenant,event,expected,next){const k=key(tenant,event),current=rows.get(k);if((current?.version||0)!==expected)return false;rows.set(k,structuredClone(next));return true}
}}
