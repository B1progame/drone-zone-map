import type { Location, Weather, ZoneInfo } from './types';

export const OFFLINE_PACKAGE_VERSION=2;
const DB_NAME='aeris-offline';
const STORE='packages';
const DIPUL_WFS='https://uas-betrieb.de/geoservices/dipul/wfs';
const GERMANY_BOUNDS:[number,number,number,number]=[5.5,47,15.5,55.2];

export const OFFLINE_LAYERS={
 droneZones:{label:'Drone zones',layers:['behoerden','diplomatische_vertretungen','justizvollzugsanstalten','krankenhaeuser','polizei','sicherheitsbehoerden']},
 restricted:{label:'Restricted / no-fly',layers:['flugbeschraenkungsgebiete','temporaere_betriebseinschraenkungen','militaerische_anlagen']},
 airports:{label:'Airports / airfields',layers:['flughaefen','flugplaetze']},
 controlled:{label:'Controlled airspace',layers:['kontrollzonen']},
 nature:{label:'Nature protection',layers:['ffh-gebiete','nationalparks','naturschutzgebiete','vogelschutzgebiete']},
 warnings:{label:'Warning zones',layers:['industrieanlagen','kraftwerke','labore','schifffahrtsanlagen','stromleitungen','umspannwerke','windkraftanlagen']},
 basic:{label:'Basic map data / labels',layers:['bahnanlagen','binnenwasserstrassen','bundesautobahnen','bundesstrassen','seewasserstrassen']}
} as const;

export type OfflineLayerId=keyof typeof OFFLINE_LAYERS;
export type OfflineScope='country'|'state'|'city'|'radius';
export type OfflineBounds=[number,number,number,number];
export type OfflinePackConfig={
 scope:OfflineScope;
 country:'DE';
 region:string;
 center:Location;
 radiusKm?:number;
 bounds:OfflineBounds;
 layers:OfflineLayerId[];
};
export type OfflinePackMetadata={
 country:string;
 region:string;
 center:Location;
 radiusKm?:number;
 bounds:OfflineBounds;
 layers:OfflineLayerId[];
 version:number;
 downloadedAt:string;
 updatedAt:string;
 sizeBytes:number;
 itemCount:number;
 sourceUpdatedAt:string;
};
export type OfflinePack={
 id:string;
 name:string;
 location:Location;
 savedAt:string;
 weather?:Weather;
 zoneInfo?:ZoneInfo;
 notice:string;
 config:OfflinePackConfig;
 metadata:OfflinePackMetadata;
 data:{type:'FeatureCollection';features:any[];properties:Record<string,unknown>};
};
export type OfflineDownloadProgress={percent:number;stage:string;items:number};

export const GERMAN_STATES:{name:string;bounds:OfflineBounds}[]=[
 {name:'Baden-Württemberg',bounds:[7.5,47.5,10.6,49.8]},
 {name:'Bavaria',bounds:[8.9,47.2,13.9,50.6]},
 {name:'Berlin',bounds:[13.08,52.33,13.77,52.68]},
 {name:'Brandenburg',bounds:[11.2,51.35,14.8,53.6]},
 {name:'Bremen',bounds:[8.45,52.98,8.99,53.62]},
 {name:'Hamburg',bounds:[9.7,53.39,10.33,53.75]},
 {name:'Hesse',bounds:[7.77,49.38,10.24,51.66]},
 {name:'Lower Saxony',bounds:[6.55,51.28,11.6,53.9]},
 {name:'Mecklenburg-Vorpommern',bounds:[10.55,53.1,14.45,54.75]},
 {name:'North Rhine-Westphalia',bounds:[5.85,50.32,9.47,52.55]},
 {name:'Rhineland-Palatinate',bounds:[6.08,48.96,8.51,50.95]},
 {name:'Saarland',bounds:[6.35,49.1,7.42,49.65]},
 {name:'Saxony',bounds:[11.85,50.17,15.05,51.7]},
 {name:'Saxony-Anhalt',bounds:[10.55,50.9,13.2,53.05]},
 {name:'Schleswig-Holstein',bounds:[7.85,53.35,11.35,55.1]},
 {name:'Thuringia',bounds:[9.85,50.2,12.65,51.68]}
];

const db=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open(DB_NAME,1);
 request.onupgradeneeded=()=>{if(!request.result.objectStoreNames.contains(STORE))request.result.createObjectStore(STORE,{keyPath:'id'})};
 request.onsuccess=()=>resolve(request.result);
 request.onerror=()=>reject(request.error);
});
const requestResult=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
const transact=async<T>(mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>)=>{
 const database=await db(),transaction=database.transaction(STORE,mode);
 try{return await requestResult(run(transaction.objectStore(STORE)))}finally{transaction.oncomplete=()=>database.close();transaction.onerror=()=>database.close()}
};

const rad=(value:number)=>value*Math.PI/180;
export const distanceKm=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{
 const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;
 return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};
export function radiusBounds(center:Location,radiusKm:number):OfflineBounds{
 const lat=radiusKm/110.574,lng=radiusKm/(111.32*Math.max(.2,Math.cos(rad(center.lat))));
 return [center.lng-lng,center.lat-lat,center.lng+lng,center.lat+lat];
}
export function createOfflineConfig(scope:OfflineScope,center:Location,layers:OfflineLayerId[],stateName?:string,radiusKm=20):OfflinePackConfig{
 if(scope==='country')return{scope,country:'DE',region:'All Germany',center:{lat:51.1657,lng:10.4515,name:'Germany'},bounds:GERMANY_BOUNDS,layers};
 if(scope==='state'){
  const state=GERMAN_STATES.find(item=>item.name===stateName)??GERMAN_STATES[2];
  return{scope,country:'DE',region:state.name,center:{lng:(state.bounds[0]+state.bounds[2])/2,lat:(state.bounds[1]+state.bounds[3])/2,name:state.name},layers,bounds:state.bounds};
 }
 const effectiveRadius=scope==='city'?Math.min(25,Math.max(5,radiusKm||15)):Math.min(100,Math.max(1,radiusKm));
 return{scope,country:'DE',region:scope==='city'?center.name:`${effectiveRadius} km around ${center.name}`,center,radiusKm:effectiveRadius,bounds:radiusBounds(center,effectiveRadius),layers};
}
const areaKm2=([west,south,east,north]:OfflineBounds)=>{
 const middle=(south+north)/2;
 return Math.max(1,(east-west)*111.32*Math.cos(rad(middle))*(north-south)*110.574);
};
export function estimateOfflinePackage(config:OfflinePackConfig){
 const density:Record<OfflineLayerId,number>={droneZones:120,restricted:55,airports:18,controlled:12,nature:310,warnings:220,basic:530};
 const area=areaKm2(config.bounds),features=Math.round(config.layers.reduce((sum,id)=>sum+density[id]*Math.pow(area/1000,.72),0));
 const bytes=Math.round(180000+features*1150);
 return{bytes,items:features,label:formatBytes(bytes)};
}
export const formatBytes=(bytes:number)=>bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(bytes<10*1024*1024?1:0)} MB`;
export const isOfflinePackStale=(pack:OfflinePack)=>Date.now()-new Date(pack.metadata.updatedAt).getTime()>7*24*60*60*1000||pack.metadata.version<OFFLINE_PACKAGE_VERSION;

async function fetchLayer(layer:string,bounds:OfflineBounds,onPage:(count:number)=>void){
 const features:any[]=[],pageSize=2500,maxFeatures=100000;
 for(let start=0;start<maxFeatures;start+=pageSize){
  const params=new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:`dipul:${layer}`,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',BBOX:[...bounds,'EPSG:4326'].join(','),COUNT:String(pageSize),STARTINDEX:String(start)});
  const response=await fetch(`${DIPUL_WFS}?${params}`);
  if(!response.ok)throw new Error(`${layer.replaceAll('_',' ')} failed (${response.status})`);
  const payload=await response.json();
  if(!Array.isArray(payload.features))throw new Error(`${layer.replaceAll('_',' ')} returned invalid data`);
  features.push(...payload.features.map((feature:any)=>({...feature,properties:{...feature.properties,_aerisOfflineLayer:layer}})));
  onPage(payload.features.length);
  if(payload.features.length<pageSize||payload.numberMatched===features.length)break;
 }
 return features;
}

export async function createOfflinePack(config:OfflinePackConfig,weather?:Weather,zoneInfo?:ZoneInfo,onProgress?:(value:OfflineDownloadProgress)=>void,replaceId?:string):Promise<OfflinePack>{
 if(!navigator.onLine)throw new Error('Connect to the internet to download or update an offline package.');
 if(!config.layers.length)throw new Error('Select at least one layer.');
 const estimate=estimateOfflinePackage(config),storage=await navigator.storage?.estimate?.();
 if(storage?.quota&&storage.usage!=null&&storage.quota-storage.usage<estimate.bytes*1.15)throw new Error(`Not enough browser storage. This package needs about ${estimate.label}.`);
 await navigator.storage?.persist?.().catch(()=>false);
 const layerEntries=config.layers.flatMap(category=>OFFLINE_LAYERS[category].layers.map(layer=>({category,layer})));
 const features:any[]=[],warnings:string[]=[];
 let completed=0;
 onProgress?.({percent:1,stage:'Preparing official German layers',items:0});
 for(const entry of layerEntries){
  onProgress?.({percent:Math.round(4+completed/layerEntries.length*88),stage:`Downloading ${entry.layer.replaceAll('_',' ')}`,items:features.length});
  try{
   const rows=await fetchLayer(entry.layer,config.bounds,count=>onProgress?.({percent:Math.round(4+completed/layerEntries.length*88),stage:`Downloading ${entry.layer.replaceAll('_',' ')}`,items:features.length+count}));
   features.push(...rows.map(feature=>({...feature,properties:{...feature.properties,_aerisOfflineCategory:entry.category}})));
  }catch(error){warnings.push(error instanceof Error?error.message:`${entry.layer} failed`)}
  completed++;
 }
 if(!features.length&&warnings.length)throw new Error(`No layer could be downloaded. ${warnings[0]}`);
 onProgress?.({percent:94,stage:'Saving package on this device',items:features.length});
 const now=new Date().toISOString(),data={type:'FeatureCollection' as const,features,properties:{source:'DIPUL WFS',license:'CC BY-ND 4.0',scope:config.scope,bounds:config.bounds,warnings}};
 const sizeBytes=new Blob([JSON.stringify(data)]).size;
 const old=replaceId?await getOfflinePack(replaceId):undefined;
 const id=replaceId??crypto.randomUUID();
 const pack:OfflinePack={
  id,name:config.region,location:config.center,savedAt:old?.savedAt??now,weather,zoneInfo,
  notice:'Offline data can become outdated. Temporary restrictions and weather can change. Re-check online before flying.',
  config,
  metadata:{country:'Germany',region:config.region,center:config.center,radiusKm:config.radiusKm,bounds:config.bounds,layers:config.layers,version:OFFLINE_PACKAGE_VERSION,downloadedAt:old?.metadata.downloadedAt??now,updatedAt:now,sizeBytes,itemCount:features.length,sourceUpdatedAt:now},
  data
 };
 await transact('readwrite',store=>store.put(pack));
 window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'));
 onProgress?.({percent:100,stage:`Saved ${formatBytes(sizeBytes)}`,items:features.length});
 return pack;
}
export const getOfflinePacks=async():Promise<OfflinePack[]>=>{
 const packs=await transact('readonly',store=>store.getAll()) as OfflinePack[];
 return packs.sort((a,b)=>b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
};
export const getOfflinePack=(id:string)=>transact('readonly',store=>store.get(id)) as Promise<OfflinePack|undefined>;
export async function deleteOfflinePack(id:string){await transact('readwrite',store=>store.delete(id));window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'))}
export async function deleteAllOfflinePacks(){await transact('readwrite',store=>store.clear());window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'))}
export async function refreshOfflinePack(id:string,onProgress?:(value:OfflineDownloadProgress)=>void){
 const pack=await getOfflinePack(id);
 if(!pack)throw new Error('Offline package no longer exists.');
 return createOfflinePack(pack.config,pack.weather,pack.zoneInfo,onProgress,id);
}
const contains=(pack:OfflinePack,point:{lat:number;lng:number})=>{
 const [west,south,east,north]=pack.metadata.bounds;
 if(point.lng<west||point.lng>east||point.lat<south||point.lat>north)return false;
 return !pack.metadata.radiusKm||distanceKm(pack.metadata.center,point)<=pack.metadata.radiusKm;
};
export async function getBestOfflinePack(point:{lat:number;lng:number}):Promise<OfflinePack|undefined>{
 const matches=(await getOfflinePacks()).filter(pack=>contains(pack,point));
 return matches.sort((a,b)=>areaKm2(a.metadata.bounds)-areaKm2(b.metadata.bounds)||new Date(b.metadata.updatedAt).getTime()-new Date(a.metadata.updatedAt).getTime())[0];
}
export async function getOfflineContext(location:Location){
 const pack=await getBestOfflinePack(location);
 if(!pack)return undefined;
 const insideRing=(ring:number[][])=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>location.lat)!==(yj>location.lat))&&(location.lng<(xj-xi)*(location.lat-yi)/(yj-yi)+xi))inside=!inside}return inside};
 const containsGeometry=(geometry:any):boolean=>{
  if(!geometry)return false;
  if(geometry.type==='Point')return distanceKm(location,{lng:geometry.coordinates[0],lat:geometry.coordinates[1]})<=1;
  if(geometry.type==='Polygon')return insideRing(geometry.coordinates[0])&&!geometry.coordinates.slice(1).some(insideRing);
  if(geometry.type==='MultiPolygon')return geometry.coordinates.some((polygon:number[][][])=>insideRing(polygon[0])&&!polygon.slice(1).some(insideRing));
  return false;
 };
 const overlaps=pack.data.features.filter(feature=>containsGeometry(feature.geometry)).slice(0,50).map((feature,index)=>{
  const properties=feature.properties??{},layer=String(properties._aerisOfflineLayer??'drone zone');
  return{id:String(feature.id??`offline-${index}`),name:String(properties.generated_name_EN??properties.generated_name_DE??properties.name??layer.replaceAll('_',' ')),type:String(properties.type_code??properties._aerisOfflineCategory??layer).replaceAll('_',' '),lower:properties.lower_limit_altitude!=null?`${properties.lower_limit_altitude} ${properties.lower_limit_unit??''} ${properties.lower_limit_alt_ref??''}`:undefined,upper:properties.upper_limit_altitude!=null?`${properties.upper_limit_altitude} ${properties.upper_limit_unit??''} ${properties.upper_limit_alt_ref??''}`:undefined,legalReference:properties.legal_ref,source:'DIPUL offline package',updated:pack.metadata.sourceUpdatedAt};
 });
 const zoneInfo:ZoneInfo={countryCode:'DE',countryName:'Germany',sourceName:'DIPUL offline package',sourceUrl:'https://dipul.bund.de/',status:overlaps.length?'loaded':'none',zones:overlaps,checkedAt:pack.metadata.updatedAt,warning:`Offline package “${pack.name}”, downloaded ${new Date(pack.metadata.updatedAt).toLocaleDateString()}. Reconnect before flight to check temporary changes.`};
 const weather=distanceKm(location,pack.metadata.center)<=1?pack.weather:undefined;
 return{pack,weather,zoneInfo};
}
export function downloadGeoJson(pack:OfflinePack){
 const blob=new Blob([JSON.stringify(pack.data,null,2)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`aeris-offline-${pack.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')}.geojson`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
