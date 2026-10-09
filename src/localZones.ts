import {normalizeEd269} from './data/ed269';
import {currentZones,geometryContains} from './zoneGeometry';
export const ZONES_CHANGED='aeris-zones-changed';
export type LocalZonePack={code:string;name:string;importedAt:string;data:any};
function database():Promise<IDBDatabase>{return new Promise((resolve,reject)=>{const r=indexedDB.open('aeris-local-zones',1);r.onupgradeneeded=()=>r.result.createObjectStore('packs',{keyPath:'code'});r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}
export async function localZonePacks():Promise<LocalZonePack[]>{const db=await database();try{return await new Promise((resolve,reject)=>{const r=db.transaction('packs').objectStore('packs').getAll();r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)})}finally{db.close()}}
export async function saveLocalZones(code:string,name:string,payload:any){
 if(!/^[A-Z]{2}$/.test(code))throw new Error('Select a country.');
 if(!payload||typeof payload!=='object')throw new Error('Invalid zone file.');
 const data=payload.type==='FeatureCollection'&&payload.features?.every((f:any)=>!Array.isArray(f.geometry)&&f.geometry?.type)?payload:normalizeEd269(payload);
 if(!Array.isArray(data.features)||!data.features.length)throw new Error('No supported GeoJSON or ED-269 zones found.');
 if(data.features.some((f:any)=>!f.geometry||!['Polygon','MultiPolygon'].includes(f.geometry.type)))throw new Error('Zone files must contain Polygon or MultiPolygon boundaries.');
 const coordinates=(value:any):boolean=>Array.isArray(value)&&(typeof value[0]==='number'?value.length>=2&&value.every(Number.isFinite)&&Math.abs(value[0])<=180&&Math.abs(value[1])<=90:value.length>0&&value.every(coordinates));
 if(data.features.some((f:any)=>!coordinates(f.geometry.coordinates)))throw new Error('Invalid coordinates; use WGS84 longitude/latitude.');
 const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('packs','readwrite');tx.objectStore('packs').put({code,name,importedAt:new Date().toISOString(),data});tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}
 window.dispatchEvent(new Event(ZONES_CHANGED));return data.features.length;
}
export async function removeLocalZones(code:string){const db=await database();try{await new Promise<void>((resolve,reject)=>{const tx=db.transaction('packs','readwrite');tx.objectStore('packs').delete(code);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error)})}finally{db.close()}window.dispatchEvent(new Event(ZONES_CHANGED))}
export async function localZonesAt(p:{lat:number;lng:number},code?:string){const packs=await localZonePacks();return packs.filter(pack=>!code||pack.code===code).flatMap(pack=>currentZones(pack.data).features.filter((f:any)=>geometryContains(p,f.geometry)).map((f:any)=>({...f,properties:{...f.properties,_localCountry:pack.code,_localName:pack.name,_localImportedAt:pack.importedAt}})))}
export async function localZoneMap(){return{type:'FeatureCollection' as const,features:(await localZonePacks()).flatMap(pack=>currentZones(pack.data).features)}}
