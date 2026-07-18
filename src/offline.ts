import type { Location, Weather, ZoneInfo } from './types';

export const OFFLINE_PACKAGE_VERSION=3;
const DB_NAME='aeris-offline',PACKAGES='packages',CHUNKS='chunks',DB_VERSION=3;
const DIPUL_WFS='https://uas-betrieb.de/geoservices/dipul/wfs';
const GERMANY_BOUNDS:[number,number,number,number]=[5.5,47,15.5,55.2];
const EMPTY_DATA={type:'FeatureCollection' as const,features:[],properties:{}};

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
export type OfflinePackConfig={scope:OfflineScope;country:'DE';region:string;center:Location;radiusKm?:number;bounds:OfflineBounds;layers:OfflineLayerId[]};
export type OfflinePackMetadata={country:string;region:string;center:Location;radiusKm?:number;bounds:OfflineBounds;layers:OfflineLayerId[];version:number;downloadedAt:string;updatedAt:string;sizeBytes:number;itemCount:number;sourceUpdatedAt:string};
export type OfflineGeoJson={type:'FeatureCollection';features:any[];properties:Record<string,unknown>};
export type OfflinePack={
 id:string;name:string;location:Location;savedAt:string;weather?:Weather;zoneInfo?:ZoneInfo;notice:string;
 config:OfflinePackConfig;metadata:OfflinePackMetadata;generation?:string;data?:OfflineGeoJson;
};
type OfflineChunk={id:string;packageId:string;generation:string;cell:string;cellKeys:string[];features:any[];sizeBytes:number};
export type OfflineDownloadProgress={percent:number;stage:string;items:number};

export const GERMAN_STATES:{name:string;bounds:OfflineBounds}[]=[
 {name:'Baden-Württemberg',bounds:[7.5,47.5,10.6,49.8]},{name:'Bavaria',bounds:[8.9,47.2,13.9,50.6]},
 {name:'Berlin',bounds:[13.08,52.33,13.77,52.68]},{name:'Brandenburg',bounds:[11.2,51.35,14.8,53.6]},
 {name:'Bremen',bounds:[8.45,52.98,8.99,53.62]},{name:'Hamburg',bounds:[9.7,53.39,10.33,53.75]},
 {name:'Hesse',bounds:[7.77,49.38,10.24,51.66]},{name:'Lower Saxony',bounds:[6.55,51.28,11.6,53.9]},
 {name:'Mecklenburg-Vorpommern',bounds:[10.55,53.1,14.45,54.75]},{name:'North Rhine-Westphalia',bounds:[5.85,50.32,9.47,52.55]},
 {name:'Rhineland-Palatinate',bounds:[6.08,48.96,8.51,50.95]},{name:'Saarland',bounds:[6.35,49.1,7.42,49.65]},
 {name:'Saxony',bounds:[11.85,50.17,15.05,51.7]},{name:'Saxony-Anhalt',bounds:[10.55,50.9,13.2,53.05]},
 {name:'Schleswig-Holstein',bounds:[7.85,53.35,11.35,55.1]},{name:'Thuringia',bounds:[9.85,50.2,12.65,51.68]}
];

const openDb=()=>new Promise<IDBDatabase>((resolve,reject)=>{
 const request=indexedDB.open(DB_NAME,DB_VERSION);
 request.onupgradeneeded=()=>{
  const database=request.result;
  if(!database.objectStoreNames.contains(PACKAGES))database.createObjectStore(PACKAGES,{keyPath:'id'});
  if(!database.objectStoreNames.contains(CHUNKS)){
   const chunks=database.createObjectStore(CHUNKS,{keyPath:'id'});
   chunks.createIndex('packageId','packageId');
   chunks.createIndex('packageCell',['packageId','generation','cell']);
   chunks.createIndex('cellKeys','cellKeys',{multiEntry:true});
  }else{
   const chunks=request.transaction!.objectStore(CHUNKS);
   if(!chunks.indexNames.contains('cellKeys'))chunks.createIndex('cellKeys','cellKeys',{multiEntry:true});
  }
 };
 request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);
});
const idbRequest=<T>(request:IDBRequest<T>)=>new Promise<T>((resolve,reject)=>{request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error)});
const storeRequest=async<T>(storeName:string,mode:IDBTransactionMode,run:(store:IDBObjectStore)=>IDBRequest<T>)=>{
 const database=await openDb(),transaction=database.transaction(storeName,mode);
 try{return await idbRequest(run(transaction.objectStore(storeName)))}finally{transaction.oncomplete=()=>database.close();transaction.onerror=()=>database.close()}
};
async function putChunks(chunks:OfflineChunk[]){
 if(!chunks.length)return;
 const database=await openDb();
 await new Promise<void>((resolve,reject)=>{
  const transaction=database.transaction(CHUNKS,'readwrite'),store=transaction.objectStore(CHUNKS);
  chunks.forEach(chunk=>store.put(chunk));
  transaction.oncomplete=()=>{database.close();resolve()};transaction.onerror=()=>{database.close();reject(transaction.error)};transaction.onabort=()=>{database.close();reject(transaction.error)};
 });
}
async function deleteChunks(packageId:string,generation?:string){
 const database=await openDb();
 await new Promise<void>((resolve,reject)=>{
  const transaction=database.transaction(CHUNKS,'readwrite'),store=transaction.objectStore(CHUNKS),request=store.index('packageId').openCursor(IDBKeyRange.only(packageId));
  request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const chunk=cursor.value as OfflineChunk;if(!generation||chunk.generation===generation)cursor.delete();cursor.continue()};
  transaction.oncomplete=()=>{database.close();resolve()};transaction.onerror=()=>{database.close();reject(transaction.error)};
 });
}

const rad=(value:number)=>value*Math.PI/180;
export const distanceKm=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))};
export function radiusBounds(center:Location,radiusKm:number):OfflineBounds{const lat=radiusKm/110.574,lng=radiusKm/(111.32*Math.max(.2,Math.cos(rad(center.lat))));return[center.lng-lng,center.lat-lat,center.lng+lng,center.lat+lat]}
export function createOfflineConfig(scope:OfflineScope,center:Location,layers:OfflineLayerId[],stateName?:string,radiusKm=20):OfflinePackConfig{
 if(scope==='country')return{scope,country:'DE',region:'All Germany',center:{lat:51.1657,lng:10.4515,name:'Germany'},bounds:GERMANY_BOUNDS,layers};
 if(scope==='state'){const state=GERMAN_STATES.find(item=>item.name===stateName)??GERMAN_STATES[2];return{scope,country:'DE',region:state.name,center:{lng:(state.bounds[0]+state.bounds[2])/2,lat:(state.bounds[1]+state.bounds[3])/2,name:state.name},layers,bounds:state.bounds}}
 const effectiveRadius=scope==='city'?Math.min(25,Math.max(5,radiusKm||15)):Math.min(100,Math.max(1,radiusKm));
 return{scope,country:'DE',region:scope==='city'?center.name:`${effectiveRadius} km around ${center.name}`,center,radiusKm:effectiveRadius,bounds:radiusBounds(center,effectiveRadius),layers};
}
const areaKm2=([west,south,east,north]:OfflineBounds)=>Math.max(1,(east-west)*111.32*Math.cos(rad((south+north)/2))*(north-south)*110.574);
export function estimateOfflinePackage(config:OfflinePackConfig){const density:Record<OfflineLayerId,number>={droneZones:120,restricted:55,airports:18,controlled:12,nature:310,warnings:220,basic:530},area=areaKm2(config.bounds),features=Math.round(config.layers.reduce((sum,id)=>sum+density[id]*Math.pow(area/1000,.72),0)),bytes=Math.round(180000+features*1150);return{bytes,items:features,label:formatBytes(bytes)}}
export const formatBytes=(bytes:number)=>bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:`${(bytes/1024/1024).toFixed(bytes<10*1024*1024?1:0)} MB`;
export const isOfflinePackStale=(pack:OfflinePack)=>Date.now()-new Date(pack.metadata.updatedAt).getTime()>7*86400000||pack.metadata.version<OFFLINE_PACKAGE_VERSION;
async function layerFeatureStats(layer:string,bounds:OfflineBounds){
 const params=new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:`dipul:${layer}`,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',BBOX:[...bounds,'EPSG:4326'].join(','),COUNT:'25',STARTINDEX:'0'});
 const response=await fetch(`${DIPUL_WFS}?${params}`);if(!response.ok)throw new Error(`Could not estimate ${layer}`);
 const payload=await response.json(),count=Number(payload.numberMatched);
 if(!Number.isFinite(count))throw new Error(`No count for ${layer}`);
 const sample=Array.isArray(payload.features)?payload.features:[],sizes=sample.map((feature:any)=>new Blob([JSON.stringify(feature)]).size).sort((a:number,b:number)=>a-b),trim=Math.floor(sizes.length*.2),middle=sizes.slice(trim,Math.max(trim+1,sizes.length-trim)),sampleBytes=middle.length?middle.reduce((sum:number,size:number)=>sum+size,0)/middle.length:900;
 return{count,sampleBytes};
}
const layerFeatureCount=async(layer:string,bounds:OfflineBounds)=>(await layerFeatureStats(layer,bounds)).count;
export async function estimateOfflinePackageFromSource(config:OfflinePackConfig){
 const fallback=estimateOfflinePackage(config),entries=config.layers.flatMap(category=>OFFLINE_LAYERS[category].layers.map(layer=>({category,layer}))),results:{count:number;sampleBytes:number}[]=[];
 for(let offset=0;offset<entries.length;offset+=6){
  const group=entries.slice(offset,offset+6),counts=await Promise.allSettled(group.map(entry=>layerFeatureStats(entry.layer,config.bounds)));
  counts.forEach(result=>{if(result.status==='fulfilled')results.push(result.value)});
 }
 if(!results.length)return fallback;
 const items=results.reduce((sum,item)=>sum+item.count,0),bytes=Math.round(240000+results.reduce((sum,item)=>sum+item.count*(item.sampleBytes+140)*1.08,0));
 return{bytes,items,label:formatBytes(bytes)};
}

function geometryBounds(geometry:any):OfflineBounds|undefined{
 if(!geometry?.coordinates)return;
 const bounds:OfflineBounds=[Infinity,Infinity,-Infinity,-Infinity];
 const visit=(value:any)=>{if(Array.isArray(value)&&typeof value[0]==='number'&&typeof value[1]==='number'){bounds[0]=Math.min(bounds[0],value[0]);bounds[1]=Math.min(bounds[1],value[1]);bounds[2]=Math.max(bounds[2],value[0]);bounds[3]=Math.max(bounds[3],value[1])}else if(Array.isArray(value))value.forEach(visit)};
 visit(geometry.coordinates);return Number.isFinite(bounds[0])?bounds:undefined;
}
const cellsForFeature=(feature:any,packageBounds:OfflineBounds)=>{
 const bounds=geometryBounds(feature.geometry)??packageBounds,lng=(Math.max(packageBounds[0],bounds[0])+Math.min(packageBounds[2],bounds[2]))/2,lat=(Math.max(packageBounds[1],bounds[1])+Math.min(packageBounds[3],bounds[3]))/2;
 const primary=`${Math.floor(lng)},${Math.floor(lat)}`,cells:string[]=[];
 for(let x=Math.floor(Math.max(packageBounds[0],bounds[0]));x<=Math.floor(Math.min(packageBounds[2],bounds[2]));x++)for(let y=Math.floor(Math.max(packageBounds[1],bounds[1]));y<=Math.floor(Math.min(packageBounds[3],bounds[3]));y++)cells.push(`${x},${y}`);
 return{primary,cells:cells.length&&cells.length<=120?cells:[primary]};
};
async function fetchLayerPage(layer:string,bounds:OfflineBounds,start:number,pageSize:number){
  const params=new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:`dipul:${layer}`,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',BBOX:[...bounds,'EPSG:4326'].join(','),COUNT:String(pageSize),STARTINDEX:String(start)});
  const response=await fetch(`${DIPUL_WFS}?${params}`);if(!response.ok)throw new Error(`${layer.replaceAll('_',' ')} failed (${response.status})`);
  const payload=await response.json();if(!Array.isArray(payload.features))throw new Error(`${layer.replaceAll('_',' ')} returned invalid data`);
 return payload;
}
async function saveLayer(layer:string,category:OfflineLayerId,bounds:OfflineBounds,packageId:string,generation:string,onPage:(count:number,size:number)=>void){
 const pageSize=5000,matched=await layerFeatureCount(layer,bounds);let total=0,totalSize=0;
 for(let offset=0;offset<matched;offset+=pageSize*4){
  const starts=Array.from({length:Math.min(4,Math.ceil((matched-offset)/pageSize))},(_,index)=>offset+index*pageSize),pages=await Promise.all(starts.map(start=>fetchLayerPage(layer,bounds,start,pageSize)));
  for(let pageIndex=0;pageIndex<pages.length;pageIndex++){
   const payload=pages[pageIndex],start=starts[pageIndex];
  const groups=new Map<string,{features:any[];cells:Set<string>}>();
  payload.features.forEach((feature:any)=>{
   const tagged={...feature,properties:{...feature.properties,_aerisOfflineLayer:layer,_aerisOfflineCategory:category}},spatial=cellsForFeature(tagged,bounds),group=groups.get(spatial.primary)??{features:[],cells:new Set<string>()};
   group.features.push(tagged);spatial.cells.forEach(cell=>group.cells.add(cell));groups.set(spatial.primary,group);
  });
  const chunks:OfflineChunk[]=[];
  for(const [cell,group] of groups){const sizeBytes=new Blob([JSON.stringify(group.features)]).size;totalSize+=sizeBytes;chunks.push({id:`${packageId}:${generation}:${layer}:${start}:${cell}`,packageId,generation,cell,cellKeys:[...group.cells].map(value=>`${packageId}|${generation}|${value}`),features:group.features,sizeBytes})}
  try{await putChunks(chunks)}catch(error){if(error instanceof DOMException&&error.name==='QuotaExceededError')throw new Error('Browser storage is full. Delete an offline package or select fewer layers.');throw error}
  total+=payload.features.length;onPage(payload.features.length,totalSize);
  }
 }
 return{items:total,sizeBytes:totalSize};
}

export async function createOfflinePack(config:OfflinePackConfig,weather?:Weather,zoneInfo?:ZoneInfo,onProgress?:(value:OfflineDownloadProgress)=>void,replaceId?:string):Promise<OfflinePack>{
 if(!navigator.onLine)throw new Error('Connect to the internet to download or update an offline package.');
 if(!config.layers.length)throw new Error('Select at least one layer.');
 const estimate=await estimateOfflinePackageFromSource(config),storage=await navigator.storage?.estimate?.();
 if(storage?.quota&&storage.usage!=null&&storage.quota-storage.usage<estimate.bytes*1.15)throw new Error(`Not enough browser storage. This package needs about ${estimate.label}.`);
 await navigator.storage?.persist?.().catch(()=>false);
 const entries=config.layers.flatMap(category=>OFFLINE_LAYERS[category].layers.map(layer=>({category,layer}))),featuresByKey=new Set<string>(),warnings:string[]=[];
 const existing=replaceId?await getOfflinePack(replaceId):(await getOfflinePacks()).find(pack=>pack.config.scope===config.scope&&pack.config.region===config.region&&pack.config.layers.length===config.layers.length&&pack.config.layers.every(layer=>config.layers.includes(layer)));
 const old=existing,id=existing?.id??crypto.randomUUID(),generation=crypto.randomUUID(),previousGeneration=old?.generation;
 let completed=0,itemCount=0,sizeBytes=0;
 onProgress?.({percent:1,stage:'Preparing chunked offline storage',items:0});
 try{
  for(const entry of entries){
   onProgress?.({percent:Math.round(3+completed/entries.length*92),stage:`Downloading ${entry.layer.replaceAll('_',' ')}`,items:itemCount});
   try{
    const result=await saveLayer(entry.layer,entry.category,config.bounds,id,generation,(count)=>onProgress?.({percent:Math.round(3+completed/entries.length*92),stage:`Downloading ${entry.layer.replaceAll('_',' ')}`,items:itemCount+count}));
    itemCount+=result.items;sizeBytes+=result.sizeBytes;featuresByKey.add(entry.layer);
   }catch(error){warnings.push(error instanceof Error?error.message:`${entry.layer} failed`)}
   completed++;
  }
  if(!featuresByKey.size&&warnings.length)throw new Error(`No layer could be downloaded. ${warnings[0]}`);
  const now=new Date().toISOString(),pack:OfflinePack={
   id,name:config.region,location:config.center,savedAt:old?.savedAt??now,weather,zoneInfo,generation,
   notice:'Offline data can become outdated. Temporary restrictions and weather can change. Re-check online before flying.',config,
   metadata:{country:'Germany',region:config.region,center:config.center,radiusKm:config.radiusKm,bounds:config.bounds,layers:config.layers,version:OFFLINE_PACKAGE_VERSION,downloadedAt:old?.metadata.downloadedAt??now,updatedAt:now,sizeBytes,itemCount,sourceUpdatedAt:now}
  };
  await storeRequest(PACKAGES,'readwrite',store=>store.put(pack));if(previousGeneration)await deleteChunks(id,previousGeneration);
  window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'));onProgress?.({percent:100,stage:`Saved ${formatBytes(sizeBytes)}`,items:itemCount});return pack;
 }catch(error){await deleteChunks(id,generation);throw error}
}
export const getOfflinePacks=async():Promise<OfflinePack[]>=>((await storeRequest(PACKAGES,'readonly',store=>store.getAll())) as OfflinePack[]).sort((a,b)=>b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
export const getOfflinePack=(id:string)=>storeRequest(PACKAGES,'readonly',store=>store.get(id)) as Promise<OfflinePack|undefined>;
export async function deleteOfflinePack(id:string){await deleteChunks(id);await storeRequest(PACKAGES,'readwrite',store=>store.delete(id));window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'))}
export async function deleteAllOfflinePacks(){const database=await openDb();await new Promise<void>((resolve,reject)=>{const transaction=database.transaction([PACKAGES,CHUNKS],'readwrite');transaction.objectStore(PACKAGES).clear();transaction.objectStore(CHUNKS).clear();transaction.oncomplete=()=>{database.close();resolve()};transaction.onerror=()=>reject(transaction.error)});window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'))}
export async function refreshOfflinePack(id:string,onProgress?:(value:OfflineDownloadProgress)=>void){const pack=await getOfflinePack(id);if(!pack)throw new Error('Offline package no longer exists.');return createOfflinePack(pack.config,pack.weather,pack.zoneInfo,onProgress,id)}
const contains=(pack:OfflinePack,point:{lat:number;lng:number})=>{const[west,south,east,north]=pack.metadata.bounds;return point.lng>=west&&point.lng<=east&&point.lat>=south&&point.lat<=north&&(!pack.metadata.radiusKm||distanceKm(pack.metadata.center,point)<=pack.metadata.radiusKm)};
export async function getBestOfflinePack(point:{lat:number;lng:number}){const matches=(await getOfflinePacks()).filter(pack=>contains(pack,point));return matches.sort((a,b)=>areaKm2(a.metadata.bounds)-areaKm2(b.metadata.bounds)||new Date(b.metadata.updatedAt).getTime()-new Date(a.metadata.updatedAt).getTime())[0]}
const cellsForBounds=([west,south,east,north]:OfflineBounds)=>{const cells:string[]=[];for(let lng=Math.floor(west);lng<=Math.floor(east);lng++)for(let lat=Math.floor(south);lat<=Math.floor(north);lat++)cells.push(`${lng},${lat}`);return cells};
export async function getOfflinePackageData(packOrId:OfflinePack|string,bounds?:OfflineBounds,maxFeatures=60000):Promise<OfflineGeoJson>{
 const pack=typeof packOrId==='string'?await getOfflinePack(packOrId):packOrId;if(!pack)return EMPTY_DATA;
 if(pack.data?.features?.length)return pack.data;
 if(!pack.generation)return EMPTY_DATA;
 const queryBounds=bounds??pack.metadata.bounds,database=await openDb(),features:any[]=[],seen=new Set<string>(),seenChunks=new Set<string>();
 try{
  const transaction=database.transaction(CHUNKS,'readonly'),index=transaction.objectStore(CHUNKS).index('cellKeys');
  const requests=cellsForBounds(queryBounds).map(cell=>idbRequest(index.getAll(IDBKeyRange.only(`${pack.id}|${pack.generation}|${cell}`))) as Promise<OfflineChunk[]>);
  for(const chunks of await Promise.all(requests)){
   for(const chunk of chunks){if(seenChunks.has(chunk.id))continue;seenChunks.add(chunk.id);for(const feature of chunk.features){const key=feature.id!=null?String(feature.id):JSON.stringify(feature.geometry);if(seen.has(key))continue;seen.add(key);features.push(feature);if(features.length>=maxFeatures)return{type:'FeatureCollection',features,properties:{packageId:pack.id,truncated:true}}}}
  }
  return{type:'FeatureCollection',features,properties:{packageId:pack.id,truncated:false}};
 }finally{database.close()}
}
export async function getOfflineContext(location:Location){
 const pack=await getBestOfflinePack(location);if(!pack)return;
 const d=.12,data=await getOfflinePackageData(pack,[location.lng-d,location.lat-d,location.lng+d,location.lat+d],30000);
 const insideRing=(ring:number[][])=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>location.lat)!==(yj>location.lat))&&(location.lng<(xj-xi)*(location.lat-yi)/(yj-yi)+xi))inside=!inside}return inside};
 const containsGeometry=(geometry:any):boolean=>geometry?.type==='Point'?distanceKm(location,{lng:geometry.coordinates[0],lat:geometry.coordinates[1]})<=1:geometry?.type==='Polygon'?insideRing(geometry.coordinates[0])&&!geometry.coordinates.slice(1).some(insideRing):geometry?.type==='MultiPolygon'?geometry.coordinates.some((polygon:number[][][])=>insideRing(polygon[0])&&!polygon.slice(1).some(insideRing)):false;
 const overlaps=data.features.filter(feature=>containsGeometry(feature.geometry)).slice(0,50).map((feature,index)=>{const properties=feature.properties??{},layer=String(properties._aerisOfflineLayer??'drone zone');return{id:String(feature.id??`offline-${index}`),name:String(properties.generated_name_EN??properties.generated_name_DE??properties.name??layer.replaceAll('_',' ')),type:String(properties.type_code??properties._aerisOfflineCategory??layer).replaceAll('_',' '),lower:properties.lower_limit_altitude!=null?`${properties.lower_limit_altitude} ${properties.lower_limit_unit??''} ${properties.lower_limit_alt_ref??''}`:undefined,upper:properties.upper_limit_altitude!=null?`${properties.upper_limit_altitude} ${properties.upper_limit_unit??''} ${properties.upper_limit_alt_ref??''}`:undefined,legalReference:properties.legal_ref,source:'DIPUL offline package',updated:pack.metadata.sourceUpdatedAt}});
 const zoneInfo:ZoneInfo={countryCode:'DE',countryName:'Germany',sourceName:'DIPUL offline package',sourceUrl:'https://dipul.bund.de/',status:overlaps.length?'loaded':'none',zones:overlaps,checkedAt:pack.metadata.updatedAt,warning:`Offline package “${pack.name}”, downloaded ${new Date(pack.metadata.updatedAt).toLocaleDateString()}. Reconnect before flight to check temporary changes.`};
 return{pack,weather:distanceKm(location,pack.metadata.center)<=1?pack.weather:undefined,zoneInfo};
}
export async function downloadGeoJson(pack:OfflinePack){
 const data=await getOfflinePackageData(pack,pack.metadata.bounds,250000),parts:BlobPart[]=[`{"type":"FeatureCollection","properties":${JSON.stringify(data.properties)},"features":[`];
 data.features.forEach((feature,index)=>{if(index)parts.push(',');parts.push(JSON.stringify(feature))});parts.push(']}');
 const blob=new Blob(parts,{type:'application/geo+json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`aeris-offline-${pack.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')}.geojson`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
