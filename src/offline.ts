import type { Location, Weather, ZoneInfo } from './types';
import { latestPortugalEd269Url, normalizeEd269 } from './data/ed269';
import { localizeZoneInfo } from './zoneTranslations';
import { classifyZoneSemantic, filterUkDroneRelevant } from './zoneSemantics';

export const OFFLINE_PACKAGE_VERSION=5;
const DB_NAME='aeris-offline',PACKAGES='packages',CHUNKS='chunks',TILES='mapTiles',DB_VERSION=4;
const DIPUL_WFS='https://uas-betrieb.de/geoservices/dipul/wfs';
const FRANCE_WFS='https://data.geopf.fr/wfs/ows';
const FRANCE_WFS_LAYER='TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf';
const ENAIRE='https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V1/MapServer';
const FAA_UAS='https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/FAA_UAS_FacilityMap_Data_V5/FeatureServer/0';
const CANADA_AIRPORTS='https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canadian_airports_w_air_navigation_services_en/MapServer/0';
const CANADA_NATIONAL_PARKS='https://proxyinternet.nrcan-rncan.gc.ca/arcgis/rest/services/CLSS-SATC/CLSS_Administrative_Boundaries/MapServer/1';
const SWISS_UAS='https://data.geo.admin.ch/ch.bazl.einschraenkungen-drohnen/einschraenkungen-drohnen/einschraenkungen-drohnen_4326.geojson';
const ESTONIA_UAS='https://utm.eans.ee/avm/utm/uas.geojson';
const DENMARK_ZONES='https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/980697acd04d4a9bb1fd34bbefab924a/data';
const DENMARK_NATURE='https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/ff657943724944faaf19807380f5e24a/data';
const OPENFREEMAP_TILEJSON='https://tiles.openfreemap.org/planet';
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
export type OfflineCountryCode='AT'|'BG'|'CA'|'CH'|'DE'|'DK'|'EE'|'ES'|'FI'|'FR'|'GB'|'IE'|'LU'|'NL'|'NO'|'PT'|'SE'|'US';
export type OfflinePackConfig={scope:OfflineScope;country:OfflineCountryCode;region:string;center:Location;radiusKm?:number;bounds:OfflineBounds;layers:OfflineLayerId[];basemapMaxZoom:number};
export type OfflinePackMetadata={country:string;countryCode?:OfflineCountryCode;region:string;center:Location;radiusKm?:number;bounds:OfflineBounds;layers:OfflineLayerId[];version:number;downloadedAt:string;updatedAt:string;sizeBytes:number;itemCount:number;sourceUpdatedAt:string;tileCount?:number;basemapMaxZoom?:number};
export type OfflineGeoJson={type:'FeatureCollection';features:any[];properties:Record<string,unknown>};
export type OfflinePack={
 id:string;name:string;location:Location;savedAt:string;weather?:Weather;zoneInfo?:ZoneInfo;notice:string;
 config:OfflinePackConfig;metadata:OfflinePackMetadata;generation?:string;data?:OfflineGeoJson;
};
type OfflineChunk={id:string;packageId:string;generation:string;cell:string;cellKeys:string[];features:any[];sizeBytes:number};
type OfflineTile={id:string;packageId:string;generation:string;z:number;x:number;y:number;data:ArrayBuffer;sizeBytes:number};
export type OfflineDownloadProgress={percent:number;stage:string;items:number};
export type OfflineStorageStatus={supported:boolean;usageBytes:number;quotaBytes:number;freeBytes:number;persistent:boolean};
export type OfflinePackVerification={ok:boolean;chunks:number;tiles:number;sizeBytes:number};

type CountryAdapter='dipul'|'france'|'static'|'sweden'|'denmark'|'switzerland'|'estonia'|'portugal'|'spain'|'usa'|'canada'|'none';
type OfflineCountryDefinition={name:string;bounds:OfflineBounds;center:Location;source:string;sourceUrl:string;layers:OfflineLayerId[];adapter:CountryAdapter;file?:string;scopeLabel?:string;offlineNote?:string};
export const OFFLINE_COUNTRIES:Record<OfflineCountryCode,OfflineCountryDefinition>={
 AT:{name:'Austria',bounds:[9.45,46.25,17.2,49.15],center:{lat:47.5162,lng:14.5501,name:'Austria'},source:'Austro Control Dronespace',sourceUrl:'https://map.dronespace.at/',layers:[],adapter:'none',offlineNote:'Austro Control does not provide a redistributable feed here; this package contains the offline street map and official handoff only.'},
 BG:{name:'Bulgaria',bounds:[22.2,41.1,28.7,44.3],center:{lat:42.7339,lng:25.4858,name:'Bulgaria'},source:'Bulgarian CAA',sourceUrl:'https://www.caa.bg/bg/category/633/7062',layers:[],adapter:'none',offlineNote:'Bulgarian CAA geometry is not redistributed without explicit permission; this package contains the offline street map and official handoff only.'},
 CA:{name:'Canada',bounds:[-141,41,-52,84],center:{lat:56.1304,lng:-106.3468,name:'Canada'},source:'Government of Canada Open Data',sourceUrl:'https://nrc.canada.ca/en/drone-tool-2/map.html',layers:['airports','nature'],adapter:'canada'},
 CH:{name:'Switzerland',bounds:[5.75,45.75,10.65,47.85],center:{lat:46.8182,lng:8.2275,name:'Switzerland'},source:'FOCA / geo.admin.ch',sourceUrl:'https://map.geo.admin.ch/#/map?lang=en&topic=ech&layers=ch.bazl.einschraenkungen-drohnen',layers:['restricted'],adapter:'switzerland'},
 DE:{name:'Germany',bounds:GERMANY_BOUNDS,center:{lat:51.1657,lng:10.4515,name:'Germany'},source:'DIPUL WFS',sourceUrl:'https://dipul.bund.de/',layers:Object.keys(OFFLINE_LAYERS) as OfflineLayerId[],adapter:'dipul'},
 DK:{name:'Denmark',bounds:[7.8,54.4,15.3,58],center:{lat:56.2639,lng:9.5018,name:'Denmark'},source:'Trafikstyrelsen Dronezoner',sourceUrl:'https://www.droneregler.dk/dronezoner/dronezoner-data-vejledninger/data-downloads',layers:['restricted','nature'],adapter:'denmark'},
 EE:{name:'Estonia',bounds:[21.5,57.3,28.3,60.1],center:{lat:58.5953,lng:25.0136,name:'Estonia'},source:'Transport Administration / EANS',sourceUrl:'https://transpordiamet.ee/en/aviation-and-aviation-safety/flying-drones-estonia/geographical-zones',layers:['restricted'],adapter:'estonia'},
 ES:{name:'Spain',bounds:[-18.5,27.5,4.5,44.5],center:{lat:40.4637,lng:-3.7492,name:'Spain'},source:'ENAIRE servAIS',sourceUrl:'https://aip.enaire.es/AIP/UAS-en.html',layers:['restricted','airports','controlled'],adapter:'spain'},
 FI:{name:'Finland',bounds:[19,59.5,31.6,70.2],center:{lat:61.9241,lng:25.7482,name:'Finland'},source:'Traficom',sourceUrl:'https://www.traficom.fi/fi/miehittamaton-ilmailu/uas-ilmatilavyohykkeet-koneluettavassa-muodossa',layers:['restricted'],adapter:'static',file:'FI.geojson'},
 FR:{name:'France',bounds:[-5.5,41,10,51.6],center:{lat:46.6034,lng:1.8883,name:'France'},source:'IGN / Géoportail WFS',sourceUrl:'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme',layers:['restricted'],adapter:'france',scopeLabel:'Mainland France'},
 GB:{name:'United Kingdom',bounds:[-9,49,2.5,61],center:{lat:54.5,lng:-3.5,name:'United Kingdom'},source:'NATS UK AIS',sourceUrl:'https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/',layers:['restricted'],adapter:'static',file:'GB.geojson'},
 IE:{name:'Ireland',bounds:[-11,51.2,-5,55.6],center:{lat:53.1424,lng:-7.6921,name:'Ireland'},source:'Irish Aviation Authority',sourceUrl:'https://www.iaa.ie/general-aviation/drones/uas-geographic-zones',layers:['restricted'],adapter:'static',file:'IE.geojson'},
 LU:{name:'Luxembourg',bounds:[5.65,49.35,6.65,50.25],center:{lat:49.8153,lng:6.1296,name:'Luxembourg'},source:'DAC Geoportal',sourceUrl:'https://drones.geoportail.lu/',layers:['restricted'],adapter:'static',file:'LU.geojson'},
 NL:{name:'Netherlands',bounds:[3.2,50.7,7.25,53.7],center:{lat:52.1326,lng:5.2913,name:'Netherlands'},source:'Ministry of Infrastructure and Water Management',sourceUrl:'https://www.rijksoverheid.nl/vraag-en-antwoord/drone/waar-mag-ik-vliegen-met-een-drone',layers:['restricted'],adapter:'static',file:'NL.geojson'},
 NO:{name:'Norway',bounds:[4,57.5,31.5,71.5],center:{lat:60.472,lng:8.4689,name:'Norway'},source:'Avinor drone map',sourceUrl:'https://www.avinor.no/en/practical-info/drone/dronekart/',layers:[],adapter:'none',offlineNote:'Avinor prohibits presenting its service data through another application; this package contains the offline street map and official handoff only.'},
 PT:{name:'Portugal',bounds:[-31.5,30,-6,42.3],center:{lat:39.3999,lng:-8.2245,name:'Portugal'},source:'ANAC Portugal',sourceUrl:'https://www.anac.pt/vPT/Generico/drones/zona_proibidas_condicionadas/Paginas/Zonasproibidasoucondicionadas.aspx',layers:['restricted'],adapter:'portugal'},
 SE:{name:'Sweden',bounds:[10.4,55,24.5,69.2],center:{lat:60.1282,lng:18.6435,name:'Sweden'},source:'LFV Dronechart',sourceUrl:'https://daim.lfv.se/echarts/dronechart/API/',layers:['restricted','airports'],adapter:'sweden'},
 US:{name:'United States',bounds:[-125,24,-66,49.5],center:{lat:39.8283,lng:-98.5795,name:'United States'},source:'FAA UAS Facility Maps',sourceUrl:'https://www.faa.gov/uas/getting_started/b4ufly',layers:['controlled'],adapter:'usa',scopeLabel:'Contiguous United States'}
};

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
  if(!database.objectStoreNames.contains(TILES)){
   const tiles=database.createObjectStore(TILES,{keyPath:'id'});
   tiles.createIndex('packageId','packageId');
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
async function putTiles(tiles:OfflineTile[]){
 if(!tiles.length)return;
 const database=await openDb();
 await new Promise<void>((resolve,reject)=>{
  const transaction=database.transaction(TILES,'readwrite'),store=transaction.objectStore(TILES);
  tiles.forEach(tile=>store.put(tile));
  transaction.oncomplete=()=>{database.close();resolve()};transaction.onerror=()=>{database.close();reject(transaction.error)};transaction.onabort=()=>{database.close();reject(transaction.error)};
 });
}
async function deleteByPackage(storeName:string,packageId:string,generation?:string){
 const database=await openDb();
 await new Promise<void>((resolve,reject)=>{
  const transaction=database.transaction(storeName,'readwrite'),store=transaction.objectStore(storeName),request=store.index('packageId').openCursor(IDBKeyRange.only(packageId));
  request.onsuccess=()=>{const cursor=request.result;if(!cursor)return;const item=cursor.value as {generation:string};if(!generation||item.generation===generation)cursor.delete();cursor.continue()};
  transaction.oncomplete=()=>{database.close();resolve()};transaction.onerror=()=>{database.close();reject(transaction.error)};
 });
}
const deleteChunks=(packageId:string,generation?:string)=>deleteByPackage(CHUNKS,packageId,generation);
const deleteTiles=(packageId:string,generation?:string)=>deleteByPackage(TILES,packageId,generation);

const rad=(value:number)=>value*Math.PI/180;
export const distanceKm=(a:{lat:number;lng:number},b:{lat:number;lng:number})=>{const dLat=rad(b.lat-a.lat),dLng=rad(b.lng-a.lng),h=Math.sin(dLat/2)**2+Math.cos(rad(a.lat))*Math.cos(rad(b.lat))*Math.sin(dLng/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))};
export function radiusBounds(center:Location,radiusKm:number):OfflineBounds{const lat=radiusKm/110.574,lng=radiusKm/(111.32*Math.max(.2,Math.cos(rad(center.lat))));return[center.lng-lng,center.lat-lat,center.lng+lng,center.lat+lat]}
const basemapZoomFor=(scope:OfflineScope,radiusKm:number)=>scope==='country'?7:scope==='state'?10:scope==='city'?12:radiusKm<=15?12:radiusKm<=45?11:10;
export function createOfflineConfig(scope:OfflineScope,center:Location,layers:OfflineLayerId[],stateName?:string,radiusKm=20,country:OfflineCountryCode='DE'):OfflinePackConfig{
 const definition=OFFLINE_COUNTRIES[country],allowed=layers.filter(layer=>definition.layers.includes(layer));
 if(scope==='country')return{scope,country,region:definition.scopeLabel??`All ${definition.name}`,center:definition.center,bounds:definition.bounds,layers:allowed,basemapMaxZoom:basemapZoomFor(scope,radiusKm)};
 if(scope==='state'&&country==='DE'){const state=GERMAN_STATES.find(item=>item.name===stateName)??GERMAN_STATES[2];return{scope,country,region:state.name,center:{lng:(state.bounds[0]+state.bounds[2])/2,lat:(state.bounds[1]+state.bounds[3])/2,name:state.name},layers:allowed,bounds:state.bounds,basemapMaxZoom:basemapZoomFor(scope,radiusKm)}}
 const effectiveRadius=scope==='city'?Math.min(25,Math.max(5,radiusKm||15)):Math.min(100,Math.max(1,radiusKm));
 return{scope,country,region:scope==='city'?center.name:`${effectiveRadius} km around ${center.name}`,center,radiusKm:effectiveRadius,bounds:radiusBounds(center,effectiveRadius),layers:allowed,basemapMaxZoom:basemapZoomFor(scope,effectiveRadius)};
}
const areaKm2=([west,south,east,north]:OfflineBounds)=>Math.max(1,(east-west)*111.32*Math.cos(rad((south+north)/2))*(north-south)*110.574);
const lngToTile=(lng:number,z:number)=>Math.floor((lng+180)/360*2**z);
const latToTile=(lat:number,z:number)=>Math.floor((1-Math.asinh(Math.tan(rad(Math.max(-85.0511,Math.min(85.0511,lat)))))/Math.PI)/2*2**z);
export function offlineTileCoordinates(bounds:OfflineBounds,maxZoom:number){
 const tiles:{z:number;x:number;y:number}[]=[];
 for(let z=2;z<=maxZoom;z++){const limit=2**z-1,x0=Math.max(0,lngToTile(bounds[0],z)),x1=Math.min(limit,lngToTile(bounds[2],z)),y0=Math.max(0,latToTile(bounds[3],z)),y1=Math.min(limit,latToTile(bounds[1],z));for(let x=x0;x<=x1;x++)for(let y=y0;y<=y1;y++)tiles.push({z,x,y})}
 return tiles;
}
export function estimateOfflinePackage(config:OfflinePackConfig){const density:Record<OfflineLayerId,number>={droneZones:120,restricted:55,airports:18,controlled:12,nature:310,warnings:220,basic:530},area=areaKm2(config.bounds),features=Math.round(config.layers.reduce((sum,id)=>sum+density[id]*Math.pow(area/1000,.72),0)),tileCount=offlineTileCoordinates(config.bounds,config.basemapMaxZoom).length,bytes=Math.round(180000+features*1150+tileCount*28000);return{bytes,items:features+tileCount,tileCount,label:formatBytes(bytes)}}
export const formatBytes=(bytes:number)=>bytes<1024*1024?`${Math.max(1,Math.round(bytes/1024))} KB`:bytes<1024*1024*1024?`${(bytes/1024/1024).toFixed(bytes<10*1024*1024?1:0)} MB`:`${(bytes/1024/1024/1024).toFixed(1)} GB`;
export async function getOfflineStorageStatus(requestPersistence=false):Promise<OfflineStorageStatus>{
 const manager=navigator.storage;
 if(!manager)return{supported:false,usageBytes:0,quotaBytes:0,freeBytes:0,persistent:false};
 if(requestPersistence&&manager.persist)await manager.persist().catch(()=>false);
 const [estimate,persistent]=await Promise.all([manager.estimate().catch(()=>({} as StorageEstimate)),manager.persisted?.().catch(()=>false)??false]);
 const usageBytes=estimate.usage??0,quotaBytes=estimate.quota??0;
 return{supported:true,usageBytes,quotaBytes,freeBytes:Math.max(0,quotaBytes-usageBytes),persistent:Boolean(persistent)};
}
const OFFLINE_TEST_KEY='aeris-offline-test';
export const isOfflineTestMode=()=>sessionStorage.getItem(OFFLINE_TEST_KEY)==='1';
export function setOfflineTestMode(enabled:boolean){if(enabled)sessionStorage.setItem(OFFLINE_TEST_KEY,'1');else sessionStorage.removeItem(OFFLINE_TEST_KEY);window.dispatchEvent(new CustomEvent('aeris-offline-test-changed'))}
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
 if(config.country!=='DE')return estimateOfflinePackage(config);
 const fallback=estimateOfflinePackage(config),entries=config.layers.flatMap(category=>OFFLINE_LAYERS[category].layers.map(layer=>({category,layer}))),results:{count:number;sampleBytes:number}[]=[];
 for(let offset=0;offset<entries.length;offset+=6){
  const group=entries.slice(offset,offset+6),counts=await Promise.allSettled(group.map(entry=>layerFeatureStats(entry.layer,config.bounds)));
  counts.forEach(result=>{if(result.status==='fulfilled')results.push(result.value)});
 }
 if(!results.length)return fallback;
 const tileCount=offlineTileCoordinates(config.bounds,config.basemapMaxZoom).length,items=results.reduce((sum,item)=>sum+item.count,0)+tileCount,bytes=Math.round(240000+results.reduce((sum,item)=>sum+item.count*(item.sampleBytes+140)*1.08,0)+tileCount*28000);
 return{bytes,items,tileCount,label:formatBytes(bytes)};
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
   const properties={...feature.properties,_aerisOfflineLayer:layer,_aerisOfflineCategory:category};
   const tagged={...feature,properties:{...properties,_aerisSemantic:classifyZoneSemantic(properties,category==='nature'?'nature':undefined)}},spatial=cellsForFeature(tagged,bounds),group=groups.get(spatial.primary)??{features:[],cells:new Set<string>()};
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

const boundsOverlap=(a:OfflineBounds,b:OfflineBounds)=>a[2]>=b[0]&&a[0]<=b[2]&&a[3]>=b[1]&&a[1]<=b[3];
async function saveFeatureCollection(features:any[],category:OfflineLayerId,bounds:OfflineBounds,packageId:string,generation:string,sourceName:string){
 const groups=new Map<string,{features:any[];cells:Set<string>}>();
 for(const feature of features){
  const featureBounds=geometryBounds(feature.geometry);if(featureBounds&&!boundsOverlap(bounds,featureBounds))continue;
  const properties={...feature.properties,_aerisOfflineLayer:sourceName,_aerisOfflineCategory:category};
  const tagged={...feature,properties:{...properties,_aerisSemantic:classifyZoneSemantic(properties,category==='nature'?'nature':undefined)}},spatial=cellsForFeature(tagged,bounds),group=groups.get(spatial.primary)??{features:[],cells:new Set<string>()};
  group.features.push(tagged);spatial.cells.forEach(cell=>group.cells.add(cell));groups.set(spatial.primary,group);
 }
 let items=0,sizeBytes=0,index=0;const chunks:OfflineChunk[]=[];
 for(const [cell,group] of groups){const chunkBytes=new Blob([JSON.stringify(group.features)]).size;items+=group.features.length;sizeBytes+=chunkBytes;chunks.push({id:`${packageId}:${generation}:${sourceName}:${index++}:${cell}`,packageId,generation,cell,cellKeys:[...group.cells].map(value=>`${packageId}|${generation}|${value}`),features:group.features,sizeBytes:chunkBytes})}
 await putChunks(chunks);return{items,sizeBytes};
}
async function fetchGeoJson(url:string){
 const response=await fetch(url);if(!response.ok)throw new Error(`Official source failed (${response.status})`);
 const payload=await response.json();if(!Array.isArray(payload.features))throw new Error('Official source returned invalid GeoJSON');return payload;
}
async function fetchArcGis(endpoint:string,bounds:OfflineBounds,pageSize=2000,maxFeatures=60000){
 const features:any[]=[],geometry=bounds.join(',');
 for(let offset=0;offset<maxFeatures;offset+=pageSize){
  const params=new URLSearchParams({where:'1=1',geometry,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outSR:'4326',outFields:'*',returnGeometry:'true',geometryPrecision:'6',resultOffset:String(offset),resultRecordCount:String(pageSize),f:'geojson'});
  const response=await fetch(`${endpoint}/query?${params}`);if(!response.ok)throw new Error(`Official ArcGIS source failed (${response.status})`);
  const page=await response.json();if(!Array.isArray(page.features))throw new Error('Official ArcGIS source returned invalid GeoJSON');
  features.push(...page.features);if(page.features.length<pageSize&&!page.properties?.exceededTransferLimit)break;
 }
 return features;
}
async function saveCountryZones(config:OfflinePackConfig,packageId:string,generation:string){
 const definition=OFFLINE_COUNTRIES[config.country],results:{items:number;sizeBytes:number}[]=[];
 const save=async(features:any[],category:OfflineLayerId,name:string)=>results.push(await saveFeatureCollection(features,category,config.bounds,packageId,generation,name));
 if(definition.adapter==='none')return{items:0,sizeBytes:0};
 if(definition.adapter==='static'&&config.layers.includes('restricted')){
  const payload=await fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/${definition.file}`);
  const visiblePayload=config.country==='GB'?filterUkDroneRelevant(payload):payload;
  await save(visiblePayload.features,'restricted',`${config.country.toLowerCase()}-zones`);
 }else if(definition.adapter==='sweden'){
  const files=['mais-TIZ','mais-RSTA','mais-DNGA','mais-CTR','mais-ATZ','dynais-NOTAM','DAIM_TOPO-SUP','DAIM_TOPO-RWY5K','DAIM_TOPO-HKP1K'];
  if(config.layers.includes('restricted'))for(const file of files){const payload=await fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/sweden/${file}.geojson`);await save(payload.features,'restricted',`lfv-${file}`)}
  if(config.layers.includes('airports')){const airports=await fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/sweden/mais-ARP.geojson`);await save(airports.features,'airports','lfv-airports')}
 }else if(definition.adapter==='denmark'){
  if(config.layers.includes('restricted')){const zones=await fetchGeoJson(DENMARK_ZONES);await save(zones.features,'restricted','trafikstyrelsen-zones')}
  if(config.layers.includes('nature')){const nature=await fetchGeoJson(DENMARK_NATURE);await save(nature.features,'nature','trafikstyrelsen-nature')}
 }else if(definition.adapter==='switzerland'&&config.layers.includes('restricted')){
  const payload=await fetchGeoJson(SWISS_UAS);await save(payload.features,'restricted','foca-zones');
 }else if(definition.adapter==='estonia'&&config.layers.includes('restricted')){
  const payload=await fetchGeoJson(ESTONIA_UAS);await save(payload.features.filter((feature:any)=>feature.properties?.identifier!=='EERZout'),'restricted','eans-zones');
 }else if(definition.adapter==='portugal'&&config.layers.includes('restricted')){
  const payload=normalizeEd269(await fetchGeoJson(await latestPortugalEd269Url()));await save(payload.features,'restricted','anac-ed269');
 }else if(definition.adapter==='spain'){
  if(config.layers.includes('restricted'))await save(await fetchArcGis(`${ENAIRE}/0`,config.bounds,5000,30000),'restricted','enaire-infrastructure');
  if(config.layers.includes('airports'))await save(await fetchArcGis(`${ENAIRE}/2`,config.bounds,5000,30000),'airports','enaire-aero');
  if(config.layers.includes('controlled'))await save(await fetchArcGis(`${ENAIRE}/3`,config.bounds,5000,30000),'controlled','enaire-urban');
 }else if(definition.adapter==='usa'&&config.layers.includes('controlled')){
  await save(await fetchArcGis(FAA_UAS,config.bounds,2000,80000),'controlled','faa-facility');
 }else if(definition.adapter==='canada'){
  if(config.layers.includes('airports'))await save(await fetchArcGis(CANADA_AIRPORTS,config.bounds,1000,10000),'airports','canada-airports');
  if(config.layers.includes('nature'))await save(await fetchArcGis(CANADA_NATIONAL_PARKS,config.bounds,500,5000),'nature','canada-national-parks');
 }else if(definition.adapter==='france'&&config.layers.includes('restricted')){
  const firstParams=new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:FRANCE_WFS_LAYER,OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',BBOX:[...config.bounds,'EPSG:4326'].join(','),COUNT:'5000',STARTINDEX:'0'});
  const firstResponse=await fetch(`${FRANCE_WFS}?${firstParams}`);if(!firstResponse.ok)throw new Error(`French Géoportail zones failed (${firstResponse.status})`);
  const first=await firstResponse.json(),matched=Number(first.numberMatched),features=[...(first.features??[])];
  for(let start=5000;Number.isFinite(matched)&&start<matched;start+=5000){const params=new URLSearchParams(firstParams);params.set('STARTINDEX',String(start));const response=await fetch(`${FRANCE_WFS}?${params}`);if(!response.ok)throw new Error(`French Géoportail zones failed (${response.status})`);features.push(...((await response.json()).features??[]))}
  await save(features,'restricted','geoportail-uas');
 }
 return{items:results.reduce((sum,result)=>sum+result.items,0),sizeBytes:results.reduce((sum,result)=>sum+result.sizeBytes,0)};
}
let openFreeMapTileTemplate:Promise<string>|undefined;
const getOpenFreeMapTileTemplate=()=>openFreeMapTileTemplate??=(fetch(OPENFREEMAP_TILEJSON).then(async response=>{if(!response.ok)throw new Error(`Offline basemap directory failed (${response.status})`);const data=await response.json();const template=data.tiles?.[0];if(typeof template!=='string')throw new Error('Offline basemap directory returned no tile template');return template}).catch(error=>{openFreeMapTileTemplate=undefined;throw error}));
async function saveBasemap(config:OfflinePackConfig,packageId:string,generation:string,onProgress?:(done:number,total:number)=>void){
 const coordinates=offlineTileCoordinates(config.bounds,config.basemapMaxZoom);if(coordinates.length>3000)throw new Error('This basemap selection is too large. Choose a smaller area.');
 const template=await getOpenFreeMapTileTemplate();let sizeBytes=0,tileCount=0;
 for(let offset=0;offset<coordinates.length;offset+=8){
  const group=coordinates.slice(offset,offset+8),results=await Promise.all(group.map(async coordinate=>{const url=template.replace('{z}',String(coordinate.z)).replace('{x}',String(coordinate.x)).replace('{y}',String(coordinate.y));const response=await fetch(url);if(response.status===204||response.status===404)return{coordinate};if(!response.ok)throw new Error(`Offline basemap tile failed (${response.status})`);return{coordinate,data:await response.arrayBuffer()}})),tiles:OfflineTile[]=[];
  for(const {coordinate,data} of results){if(!data)continue;sizeBytes+=data.byteLength;tileCount++;tiles.push({id:`${packageId}:${generation}:${coordinate.z}:${coordinate.x}:${coordinate.y}`,packageId,generation,...coordinate,data,sizeBytes:data.byteLength})}
  try{await putTiles(tiles)}catch(error){if(error instanceof DOMException&&error.name==='QuotaExceededError')throw new Error('Browser storage is full. Delete an offline package or select a smaller area.');throw error}
  onProgress?.(Math.min(offset+group.length,coordinates.length),coordinates.length);
 }
 return{sizeBytes,tileCount};
}
async function verifyGeneration(packageId:string,generation:string):Promise<OfflinePackVerification>{
 const database=await openDb();
 return new Promise((resolve,reject)=>{
  const transaction=database.transaction([CHUNKS,TILES],'readonly');
  let chunks=0,tiles=0,sizeBytes=0,pending=2;
  const finish=()=>{if(--pending===0){database.close();resolve({ok:tiles>0,chunks,tiles,sizeBytes})}};
  const scan=(storeName:string,onItem:(value:OfflineChunk|OfflineTile)=>void)=>{
   const request=transaction.objectStore(storeName).index('packageId').openCursor(IDBKeyRange.only(packageId));
   request.onsuccess=()=>{const cursor=request.result;if(!cursor){finish();return}const value=cursor.value as OfflineChunk|OfflineTile;if(value.generation===generation)onItem(value);cursor.continue()};
   request.onerror=()=>reject(request.error);
  };
  scan(CHUNKS,value=>{chunks++;sizeBytes+=value.sizeBytes});
  scan(TILES,value=>{tiles++;sizeBytes+=value.sizeBytes});
  transaction.onerror=()=>{database.close();reject(transaction.error)};
 });
}
export async function verifyOfflinePack(packOrId:OfflinePack|string):Promise<OfflinePackVerification>{
 const pack=typeof packOrId==='string'?await getOfflinePack(packOrId):packOrId;
 if(!pack?.generation)return{ok:false,chunks:0,tiles:0,sizeBytes:0};
 const result=await verifyGeneration(pack.id,pack.generation);
 return{...result,ok:result.ok&&result.tiles===(pack.metadata.tileCount??0)};
}

export async function createOfflinePack(config:OfflinePackConfig,weather?:Weather,zoneInfo?:ZoneInfo,onProgress?:(value:OfflineDownloadProgress)=>void,replaceId?:string):Promise<OfflinePack>{
 if(!navigator.onLine)throw new Error('Connect to the internet to download or update an offline package.');
 const estimate=await estimateOfflinePackageFromSource(config),storage=await navigator.storage?.estimate?.();
 if(storage?.quota&&storage.usage!=null&&storage.quota-storage.usage<estimate.bytes*1.15)throw new Error(`Not enough browser storage. This package needs about ${estimate.label}.`);
 await navigator.storage?.persist?.().catch(()=>false);
 const entries=config.country==='DE'?config.layers.flatMap(category=>OFFLINE_LAYERS[category].layers.map(layer=>({category,layer}))):[],featuresByKey=new Set<string>(),warnings:string[]=[];
 const existing=replaceId?await getOfflinePack(replaceId):(await getOfflinePacks()).find(pack=>pack.config.country===config.country&&pack.config.scope===config.scope&&pack.config.region===config.region&&pack.config.layers.length===config.layers.length&&pack.config.layers.every(layer=>config.layers.includes(layer)));
 const old=existing,id=existing?.id??crypto.randomUUID(),generation=crypto.randomUUID(),previousGeneration=old?.generation;
 let completed=0,itemCount=0,sizeBytes=0,tileCount=0;
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
  if(config.country!=='DE'&&config.layers.length){onProgress?.({percent:8,stage:`Downloading ${OFFLINE_COUNTRIES[config.country].source} zones`,items:itemCount});try{const result=await saveCountryZones(config,id,generation);itemCount+=result.items;sizeBytes+=result.sizeBytes;featuresByKey.add('country-zones')}catch(error){warnings.push(error instanceof Error?error.message:'Official zones failed')}}
  if(config.layers.length&&!featuresByKey.size&&warnings.length)throw new Error(`No official layer could be downloaded. ${warnings[0]}`);
  onProgress?.({percent:entries.length?96:15,stage:'Downloading offline street map',items:itemCount});
  const basemap=await saveBasemap(config,id,generation,(done,total)=>onProgress?.({percent:Math.round((entries.length?96:15)+(done/Math.max(1,total))*(entries.length?3:84)),stage:`Downloading offline street map (${done}/${total} tiles)`,items:itemCount+done}));
  sizeBytes+=basemap.sizeBytes;tileCount=basemap.tileCount;itemCount+=tileCount;
  onProgress?.({percent:99,stage:'Verifying offline package',items:itemCount});
  const verification=await verifyGeneration(id,generation);
  if(!verification.ok||verification.tiles!==tileCount)throw new Error('The offline package could not be verified. Please retry the download.');
  const now=new Date().toISOString(),pack:OfflinePack={
   id,name:config.region,location:config.center,savedAt:old?.savedAt??now,weather,zoneInfo,generation,
   notice:'Offline data can become outdated. Temporary restrictions and weather can change. Re-check online before flying.',config,
   metadata:{country:OFFLINE_COUNTRIES[config.country].name,countryCode:config.country,region:config.region,center:config.center,radiusKm:config.radiusKm,bounds:config.bounds,layers:config.layers,version:OFFLINE_PACKAGE_VERSION,downloadedAt:old?.metadata.downloadedAt??now,updatedAt:now,sizeBytes,itemCount,sourceUpdatedAt:now,tileCount,basemapMaxZoom:config.basemapMaxZoom}
  };
  await storeRequest(PACKAGES,'readwrite',store=>store.put(pack));if(previousGeneration){await deleteChunks(id,previousGeneration);await deleteTiles(id,previousGeneration)}
  window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'));onProgress?.({percent:100,stage:`Verified · saved ${formatBytes(sizeBytes)}`,items:itemCount});return pack;
 }catch(error){await deleteChunks(id,generation);await deleteTiles(id,generation);throw error}
}
export const getOfflinePacks=async():Promise<OfflinePack[]>=>((await storeRequest(PACKAGES,'readonly',store=>store.getAll())) as OfflinePack[]).sort((a,b)=>b.metadata.updatedAt.localeCompare(a.metadata.updatedAt));
export const getOfflinePack=(id:string)=>storeRequest(PACKAGES,'readonly',store=>store.get(id)) as Promise<OfflinePack|undefined>;
export async function deleteOfflinePack(id:string){await deleteChunks(id);await deleteTiles(id);await storeRequest(PACKAGES,'readwrite',store=>store.delete(id));window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'))}
export async function deleteAllOfflinePacks(){const database=await openDb();await new Promise<void>((resolve,reject)=>{const transaction=database.transaction([PACKAGES,CHUNKS,TILES],'readwrite');transaction.objectStore(PACKAGES).clear();transaction.objectStore(CHUNKS).clear();transaction.objectStore(TILES).clear();transaction.oncomplete=()=>{database.close();resolve()};transaction.onerror=()=>reject(transaction.error)});window.dispatchEvent(new CustomEvent('aeris-offline-packages-changed'))}
export async function refreshOfflinePack(id:string,onProgress?:(value:OfflineDownloadProgress)=>void){const pack=await getOfflinePack(id);if(!pack)throw new Error('Offline package no longer exists.');const config={...pack.config,country:pack.config.country??'DE',basemapMaxZoom:pack.config.basemapMaxZoom??8} as OfflinePackConfig;return createOfflinePack(config,pack.weather,pack.zoneInfo,onProgress,id)}
const contains=(pack:OfflinePack,point:{lat:number;lng:number})=>{const[west,south,east,north]=pack.metadata.bounds;return point.lng>=west&&point.lng<=east&&point.lat>=south&&point.lat<=north&&(!pack.metadata.radiusKm||distanceKm(pack.metadata.center,point)<=pack.metadata.radiusKm)};
export async function getBestOfflinePack(point:{lat:number;lng:number}){const matches=(await getOfflinePacks()).filter(pack=>contains(pack,point));return matches.sort((a,b)=>areaKm2(a.metadata.bounds)-areaKm2(b.metadata.bounds)||new Date(b.metadata.updatedAt).getTime()-new Date(a.metadata.updatedAt).getTime())[0]}
export async function getOfflineMapTile(packageId:string,generation:string,z:number,x:number,y:number){
 const tile=await storeRequest(TILES,'readonly',store=>store.get(`${packageId}:${generation}:${z}:${x}:${y}`)) as OfflineTile|undefined;return tile?.data;
}
const cellsForBounds=([west,south,east,north]:OfflineBounds)=>{const cells:string[]=[];for(let lng=Math.floor(west);lng<=Math.floor(east);lng++)for(let lat=Math.floor(south);lat<=Math.floor(north);lat++)cells.push(`${lng},${lat}`);return cells};
export async function getOfflinePackageData(packOrId:OfflinePack|string,bounds?:OfflineBounds,maxFeatures=60000):Promise<OfflineGeoJson>{
 const pack=typeof packOrId==='string'?await getOfflinePack(packOrId):packOrId;if(!pack)return EMPTY_DATA;
 if(pack.data?.features?.length)return pack.data;
 if(!pack.generation)return EMPTY_DATA;
 const requested=bounds??pack.metadata.bounds,packageBounds=pack.metadata.bounds,queryBounds:[number,number,number,number]=[Math.max(requested[0],packageBounds[0]),Math.max(requested[1],packageBounds[1]),Math.min(requested[2],packageBounds[2]),Math.min(requested[3],packageBounds[3])];
 if(queryBounds[0]>queryBounds[2]||queryBounds[1]>queryBounds[3])return EMPTY_DATA;
 const features:any[]=[],seen=new Set<string>(),seenChunks=new Set<string>(),cells=cellsForBounds(queryBounds);
 // Large country packages can span thousands of one-degree cells. Querying
 // every cell in one Promise.all caused memory spikes when users zoomed out.
 for(let offset=0;offset<cells.length;offset+=40){
  const database=await openDb(),batch=cells.slice(offset,offset+40);
  try{
   const index=database.transaction(CHUNKS,'readonly').objectStore(CHUNKS).index('cellKeys'),requests=batch.map(cell=>idbRequest(index.getAll(IDBKeyRange.only(`${pack.id}|${pack.generation}|${cell}`))) as Promise<OfflineChunk[]>);
   for(const chunks of await Promise.all(requests))for(const chunk of chunks){if(seenChunks.has(chunk.id))continue;seenChunks.add(chunk.id);for(const feature of chunk.features){const key=feature.id!=null?String(feature.id):JSON.stringify(feature.geometry);if(seen.has(key))continue;seen.add(key);features.push(feature);if(features.length>=maxFeatures)return{type:'FeatureCollection',features,properties:{packageId:pack.id,truncated:true}}}}
  }finally{database.close()}
 }
 return{type:'FeatureCollection',features,properties:{packageId:pack.id,truncated:false}};
}
export async function getOfflineContext(location:Location,language='en'){
 const pack=await getBestOfflinePack(location);if(!pack)return;
 const d=.12,data=await getOfflinePackageData(pack,[location.lng-d,location.lat-d,location.lng+d,location.lat+d],30000);
 const insideRing=(ring:number[][])=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const[xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>location.lat)!==(yj>location.lat))&&(location.lng<(xj-xi)*(location.lat-yi)/(yj-yi)+xi))inside=!inside}return inside};
 const containsGeometry=(geometry:any):boolean=>geometry?.type==='Point'?distanceKm(location,{lng:geometry.coordinates[0],lat:geometry.coordinates[1]})<=1:geometry?.type==='Polygon'?insideRing(geometry.coordinates[0])&&!geometry.coordinates.slice(1).some(insideRing):geometry?.type==='MultiPolygon'?geometry.coordinates.some((polygon:number[][][])=>insideRing(polygon[0])&&!polygon.slice(1).some(insideRing)):false;
 const countryCode=pack.config.country??'DE',country=OFFLINE_COUNTRIES[countryCode];
 const overlaps=data.features.filter(feature=>containsGeometry(feature.geometry)).slice(0,50).map((feature,index)=>{const properties=feature.properties??{},layer=String(properties._aerisOfflineLayer??'drone zone'),rawName=String(properties.name??properties.generated_name_EN??properties.generated_name_DE??layer.replaceAll('_',' ')),category=String(properties.type_code??properties._aerisOfflineCategory??layer);return{id:String(feature.id??`offline-${index}`),name:rawName,originalName:rawName,type:category.replaceAll('_',' '),categoryCode:category,lower:properties.lower_limit_altitude!=null?`${properties.lower_limit_altitude} ${properties.lower_limit_unit??''} ${properties.lower_limit_alt_ref??''}`:undefined,upper:properties.upper_limit_altitude!=null?`${properties.upper_limit_altitude} ${properties.upper_limit_unit??''} ${properties.upper_limit_alt_ref??''}`:undefined,legalReference:properties.legal_ref,officialLayerName:layer.replaceAll('_',' '),layerCode:layer,source:`${country.source} offline package`,updated:pack.metadata.sourceUpdatedAt}});
 const zoneInfo:ZoneInfo={countryCode,countryName:country.name,sourceName:`${country.source} offline package`,sourceUrl:country.sourceUrl,status:overlaps.length?'loaded':'none',zones:overlaps,checkedAt:pack.metadata.updatedAt,warning:`Offline package “${pack.name}”, downloaded ${new Date(pack.metadata.updatedAt).toLocaleDateString()}. Reconnect before flight to check temporary changes.`};
 return{pack,weather:distanceKm(location,pack.metadata.center)<=1?pack.weather:undefined,zoneInfo:localizeZoneInfo(zoneInfo,language)};
}
export async function downloadGeoJson(pack:OfflinePack){
 const data=await getOfflinePackageData(pack,pack.metadata.bounds,250000),parts:BlobPart[]=[`{"type":"FeatureCollection","properties":${JSON.stringify(data.properties)},"features":[`];
 data.features.forEach((feature,index)=>{if(index)parts.push(',');parts.push(JSON.stringify(feature))});parts.push(']}');
 const blob=new Blob(parts,{type:'application/geo+json'}),url=URL.createObjectURL(blob),link=document.createElement('a');link.href=url;link.download=`aeris-offline-${pack.name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-')}.geojson`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
