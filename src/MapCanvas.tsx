import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker, type FilterSpecification, type StyleSpecification } from 'maplibre-gl';
import { CloudRain, CloudSun, Layers3, Map as MapIcon, Satellite, Wind } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { AppSettings, Location, RenderDetail, Weather } from './types';
import { latestPortugalEd269Url, normalizeEd269 } from './data/ed269';

type BaseMap = 'satellite' | 'streets';

export type MapCanvasHandle = {
  downloadVisibleGeoJson: (name?: string) => void;
  downloadCleanSnapshot: (name?: string) => Promise<void>;
};

const DIPUL_LAYER_NAMES = [
  'bahnanlagen', 'behoerden', 'binnenwasserstrassen', 'bundesautobahnen',
  'bundesstrassen', 'diplomatische_vertretungen', 'ffh-gebiete',
  'flugbeschraenkungsgebiete', 'flughaefen', 'flugplaetze', 'freibaeder',
  'haengegleiter', 'industrieanlagen', 'internationale_organisationen',
  'justizvollzugsanstalten', 'kontrollzonen', 'kraftwerke', 'krankenhaeuser',
  'labore', 'militaerische_anlagen', 'modellflugplaetze', 'nationalparks',
  'naturschutzgebiete', 'polizei', 'schifffahrtsanlagen', 'seewasserstrassen',
  'sicherheitsbehoerden', 'stromleitungen', 'temporaere_betriebseinschraenkungen',
  'umspannwerke', 'vogelschutzgebiete', 'windkraftanlagen', 'wohngrundstuecke'
];
const DIPUL_CORE_NAMES=['ffh-gebiete','flugbeschraenkungsgebiete','flughaefen','flugplaetze','haengegleiter','kontrollzonen','militaerische_anlagen','modellflugplaetze','nationalparks','naturschutzgebiete','temporaere_betriebseinschraenkungen','vogelschutzgebiete','windkraftanlagen'];
const DIPUL_LAYERS = DIPUL_LAYER_NAMES.map(layer => `dipul:${layer}`).join(',');
const DIPUL_CORE_LAYERS=DIPUL_CORE_NAMES.map(layer=>`dipul:${layer}`).join(',');
const DIPUL_DETAIL_LAYERS=DIPUL_LAYER_NAMES.filter(layer=>!DIPUL_CORE_NAMES.includes(layer)).map(layer=>`dipul:${layer}`).join(',');

const dipulTiles=(layers:string)=>`https://uas-betrieb.de/geoservices/dipul/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(layers)}&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=true&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;
const ENAIRE='https://servais.enaire.es/insigniads/rest/services/NSF_SRV/SRV_UAS_ZG_V1/MapServer';
const FAA_UAS='https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/FAA_UAS_FacilityMap_Data_V5/FeatureServer/0';
const CANADA_AIRPORTS='https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canadian_airports_w_air_navigation_services_en/MapServer/0';
const CANADA_NATIONAL_PARKS='https://proxyinternet.nrcan-rncan.gc.ca/arcgis/rest/services/CLSS-SATC/CLSS_Administrative_Boundaries/MapServer/1';
const SWISS_UAS='https://data.geo.admin.ch/ch.bazl.einschraenkungen-drohnen/einschraenkungen-drohnen/einschraenkungen-drohnen_4326.geojson';
const franceTiles='https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=TRANSPORTS.DRONES.RESTRICTIONS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png';
const DENMARK_ZONES='https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/980697acd04d4a9bb1fd34bbefab924a/data';
const DENMARK_NATURE='https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/ff657943724944faaf19807380f5e24a/data';
const SWEDEN_POLYGON_SOURCES = ['mais-TIZ','mais-RSTA','mais-DNGA','mais-CTR','mais-ATZ','dynais-NOTAM','DAIM_TOPO-SUP','DAIM_TOPO-RWY5K','DAIM_TOPO-HKP1K'] as const;
const SWEDEN_SOURCE_IDS=[...SWEDEN_POLYGON_SOURCES,'mais-ARP'] as const;
const NATIONAL_GEOZONE_SOURCES=[
 {id:'netherlands',file:'NL.geojson',bounds:[3.2,50.7,7.25,53.7],minzoom:5,attribution:'<a href="https://www.rijksoverheid.nl/vraag-en-antwoord/drone/waar-mag-ik-vliegen-met-een-drone" target="_blank">UAS zones © Ministerie van Infrastructuur en Waterstaat</a>'},
 {id:'finland',file:'FI.geojson',bounds:[19,59.5,31.6,70.2],minzoom:4,attribution:'<a href="https://www.traficom.fi/en/news/spatial-dataset-material/use-and-licences-data" target="_blank">Source: Traficom · modified · CC BY 4.0</a>'},
 {id:'estonia',url:'https://utm.eans.ee/avm/utm/uas.geojson',bounds:[21.5,57.3,28.3,60.1],minzoom:5,attribution:'<a href="https://transpordiamet.ee/en/aviation-and-aviation-safety/flying-drones-estonia/geographical-zones" target="_blank">Live UAS zones © Transport Administration / EANS</a>'},
 {id:'portugal',url:latestPortugalEd269Url,bounds:[-31.5,30,-6,42.3],minzoom:4,attribution:'<a href="https://www.anac.pt/vPT/Generico/drones/zona_proibidas_condicionadas/Paginas/Zonasproibidasoucondicionadas.aspx" target="_blank">Live ED-269 UAS zones © ANAC Portugal</a>',transform:normalizeEd269}
] as const;
const ZONE_LAYER_IDS = ['dipul-zones','dipul-detail','enaire-infrastructure-fill','enaire-infrastructure-line','enaire-aero-fill','enaire-aero-line','enaire-urban-fill','enaire-urban-line','france-zones','uk-zones','uk-lines','swiss-zones','swiss-lines','us-facility-fill','us-facility-line','canada-national-parks','canada-national-park-lines','canada-airport-rings','canada-airport-lines','canada-airports','luxembourg-zones','ireland-zones','ireland-lines','denmark-zones','denmark-lines','denmark-nature','denmark-nature-lines',...NATIONAL_GEOZONE_SOURCES.flatMap(source=>[`${source.id}-zones`,`${source.id}-lines`]),...SWEDEN_POLYGON_SOURCES.flatMap(id=>[`sweden-${id}-fill`,`sweden-${id}-line`]),'sweden-airports'] as const;
const loadedVectorSources=new WeakMap<MapLibreMap,Set<string>>();
const dynamicRequestKeys=new WeakMap<MapLibreMap,Map<string,string>>();
const radarUnavailableMaps=new WeakSet<MapLibreMap>();
const emptyGeoJson={type:'FeatureCollection' as const,features:[]};

// These are LFV's published Dronechart display rules. The underlying files stay
// byte-for-byte unmodified; MapLibre excludes records the official map excludes.
function swedenDisplayFilter(id:typeof SWEDEN_POLYGON_SOURCES[number]):FilterSpecification|undefined{
 if(id==='mais-RSTA')return ['match',['get','LOWER'],['GND','SFC'],true,false] as unknown as FilterSpecification;
 if(id==='mais-DNGA')return ['==',['get','LOWER'],'GND'] as FilterSpecification;
 if(id==='DAIM_TOPO-SUP')return ['match',['get','LOWER'],['GND','SFC'],true,false] as unknown as FilterSpecification;
 if(id==='dynais-NOTAM')return ['all',['<=',['to-number',['get','LOWER']],500],['match',['slice',['get','CODE23'],0,1],['R','W'],true,false],['!=',['get','CODE45'],'TT']] as unknown as FilterSpecification;
 return undefined;
}

type VectorSourceConfig={id:string;url:string|(()=>Promise<string>);bounds:[number,number,number,number];transform?:(data:any)=>any};
const vectorSources=():VectorSourceConfig[]=>[
 {id:'luxembourg',url:`${import.meta.env.BASE_URL}data/zones/LU.geojson`,bounds:[5.65,49.35,6.65,50.25]},
 {id:'ireland',url:`${import.meta.env.BASE_URL}data/zones/IE.geojson`,bounds:[-11,51.2,-5,55.6]},
 {id:'uk',url:`${import.meta.env.BASE_URL}data/zones/GB.geojson`,bounds:[-9,49,2.5,61]},
 {id:'switzerland',url:SWISS_UAS,bounds:[5.75,45.75,10.65,47.85]},
 {id:'denmark',url:DENMARK_ZONES,bounds:[7.8,54.4,15.3,58]},
 {id:'denmark-nature',url:DENMARK_NATURE,bounds:[7.8,54.4,15.3,58]},
 ...NATIONAL_GEOZONE_SOURCES.map(source=>({id:source.id,url:'url' in source?source.url:`${import.meta.env.BASE_URL}data/zones/${source.file}`,bounds:source.bounds as [number,number,number,number],...('transform' in source?{transform:source.transform}:{})})),
 ...SWEDEN_SOURCE_IDS.map(id=>({id:`sweden-${id}`,url:`${import.meta.env.BASE_URL}data/zones/sweden/${id}.geojson`,bounds:[10.4,55,24.5,69.2] as [number,number,number,number]}))
];

function viewportIntersects(map:MapLibreMap,[west,south,east,north]:VectorSourceConfig['bounds']){
 const visible=map.getBounds();
 return visible.getEast()>=west&&visible.getWest()<=east&&visible.getNorth()>=south&&visible.getSouth()<=north;
}

type ArcGisViewportConfig={
 id:string;
 endpoint:string;
 bounds:[number,number,number,number];
 minZoom:number;
 pageSize:number;
 maxFeatures:number;
 outFields:string;
 transform?:(data:any)=>any;
};

function tagEnaireScale(data:any){
 const features=(data.features??[]).map((feature:any)=>{
   const coordinates=feature.geometry?.type==='Polygon'
     ? feature.geometry.coordinates.flat()
     : feature.geometry?.type==='MultiPolygon'
       ? feature.geometry.coordinates.flat(2)
       : [];
   if(!coordinates.length)return feature;
   const longitudes=coordinates.map((coordinate:number[])=>coordinate[0]),latitudes=coordinates.map((coordinate:number[])=>coordinate[1]);
   const west=Math.min(...longitudes),east=Math.max(...longitudes),south=Math.min(...latitudes),north=Math.max(...latitudes);
   const middleLatitude=(south+north)/2;
   const areaKm2=Math.max(0,(east-west)*111.32*Math.cos(middleLatitude*Math.PI/180)*(north-south)*110.574);
   return{...feature,properties:{...feature.properties,_aerisAreaKm2:Math.round(areaKm2)}};
 });
 return{...data,features};
}

const arcGisViewportSources:ArcGisViewportConfig[]=[
 {id:'enaire-infrastructure',endpoint:`${ENAIRE}/0`,bounds:[-19,27,5,45],minZoom:4,pageSize:5000,maxFeatures:15000,outFields:'OBJECTID,identifier,name,type,reasons,variant,provider,lower,upper,uom,updateDateTime',transform:tagEnaireScale},
 {id:'enaire-aero',endpoint:`${ENAIRE}/2`,bounds:[-19,27,5,45],minZoom:4,pageSize:5000,maxFeatures:15000,outFields:'OBJECTID,identifier,name,type,reasons,variant,provider,lower,upper,uom,updateDateTime',transform:tagEnaireScale},
 // ENAIRE's urban layer contains province-sized coverage polygons. Its own
 // viewer only makes that detail useful locally, so do not paint it nationwide.
 {id:'enaire-urban',endpoint:`${ENAIRE}/3`,bounds:[-19,27,5,45],minZoom:8,pageSize:5000,maxFeatures:15000,outFields:'OBJECTID,identifier,name,type,reasons,lower,upper,uom,updateDateTime',transform:tagEnaireScale},
 {id:'us-facility',endpoint:FAA_UAS,bounds:[-179,13,-64,72],minZoom:6,pageSize:1000,maxFeatures:6000,outFields:'OBJECTID,CEILING,UNIT,MAP_EFF,LAST_EDIT,APT1_FAAID,APT1_ICAO,APT1_NAME,APT1_LAANC,AIRSPACE_1,REGION'},
 {id:'canada-airports',endpoint:CANADA_AIRPORTS,bounds:[-141,41,-52,84],minZoom:3.5,pageSize:1000,maxFeatures:2000,outFields:'*',transform:bufferCanadaAirports},
 {id:'canada-national-parks',endpoint:CANADA_NATIONAL_PARKS,bounds:[-141,41,-52,84],minZoom:3,pageSize:200,maxFeatures:600,outFields:'OBJECTID,adminAreaId,adminAreaNameEng,adminAreaNameFra,distributionTypeEng,jurisdictionEng,webReference'}
];

const detailConfig:Record<RenderDetail,{zoomDelta:number;featureScale:number;weatherColumns:number;weatherRows:number}> = {
 efficient:{zoomDelta:.8,featureScale:.55,weatherColumns:3,weatherRows:3},
 balanced:{zoomDelta:0,featureScale:1,weatherColumns:4,weatherRows:3},
 maximum:{zoomDelta:-1.6,featureScale:1.75,weatherColumns:5,weatherRows:4}
};
const weatherGridCache=new Map<string,{time:number;data:any}>();
const weatherGridPending=new Map<string,Promise<any>>();
let radarMetadata:Promise<{tiles:string[];time:number}>|undefined;

function bufferCanadaAirports(data:any){
 const features:any[]=[];
 for(const feature of data.features??[]){
   if(feature.geometry?.type!=='Point')continue;
   const [lng,lat]=feature.geometry.coordinates,ring:number[][]=[];
   const latRadius=5.6/110.574,lngRadius=5.6/(111.32*Math.max(.2,Math.cos(lat*Math.PI/180)));
   for(let i=0;i<=48;i++){const angle=i/48*Math.PI*2;ring.push([lng+Math.cos(angle)*lngRadius,lat+Math.sin(angle)*latRadius])}
   features.push(feature,{type:'Feature',properties:{...feature.properties,advisoryKm:5.6},geometry:{type:'Polygon',coordinates:[ring]}});
 }
 return {type:'FeatureCollection',features};
}

type OverlayHooks={start:(id:string,label:string)=>void;finish:(id:string)=>void};

async function queryArcGisViewport(map:MapLibreMap,config:ArcGisViewportConfig,detail:RenderDetail){
 const bounds=map.getBounds(),features:any[]=[];
 const geometry=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()].join(',');
 const offsetTolerance=map.getZoom()<7?.003:map.getZoom()<10?.0005:.00005;
 const maxFeatures=Math.round(config.maxFeatures*detailConfig[detail].featureScale);
 for(let offset=0;offset<maxFeatures;offset+=config.pageSize){
   const params=new URLSearchParams({
     where:'1=1',geometry,geometryType:'esriGeometryEnvelope',inSR:'4326',
     spatialRel:'esriSpatialRelIntersects',outSR:'4326',outFields:config.outFields,
     returnGeometry:'true',maxAllowableOffset:String(offsetTolerance),geometryPrecision:'6',
     resultOffset:String(offset),resultRecordCount:String(config.pageSize),f:'geojson'
   });
   const response=await fetch(`${config.endpoint}/query?${params}`);
   if(!response.ok)throw new Error(`${config.id} query failed (${response.status})`);
   const page=await response.json();
   if(!Array.isArray(page.features))throw new Error(`${config.id} returned invalid GeoJSON`);
   features.push(...page.features);
   if(page.features.length<config.pageSize&&!page.properties?.exceededTransferLimit)break;
 }
 const data={type:'FeatureCollection' as const,features};
 return config.transform?config.transform(data):data;
}

function loadDynamicCountrySources(map:MapLibreMap,detail:RenderDetail,hooks?:OverlayHooks){
 const requestKeys=dynamicRequestKeys.get(map)??new Map<string,string>();
 dynamicRequestKeys.set(map,requestKeys);
 for(const config of arcGisViewportSources){
   const source=map.getSource(config.id) as maplibregl.GeoJSONSource|undefined;
   if(!source)continue;
   const visible=map.getZoom()>=config.minZoom+detailConfig[detail].zoomDelta&&viewportIntersects(map,config.bounds);
   if(!visible){
     const emptyKey=`${config.id}:empty`;
     if(requestKeys.get(config.id)!==emptyKey){requestKeys.set(config.id,emptyKey);source.setData(emptyGeoJson)}
     continue;
   }
   const b=map.getBounds(),key=[config.id,detail,Math.floor(map.getZoom()*2),b.getWest().toFixed(2),b.getSouth().toFixed(2),b.getEast().toFixed(2),b.getNorth().toFixed(2)].join(':');
   if(requestKeys.get(config.id)===key)continue;
   requestKeys.set(config.id,key);
   hooks?.start(key,config.id.replaceAll('-',' '));
   void queryArcGisViewport(map,config,detail).then(data=>{
     if(requestKeys.get(config.id)===key)(map.getSource(config.id) as maplibregl.GeoJSONSource|undefined)?.setData(data);
   }).catch(error=>console.warn(error)).finally(()=>hooks?.finish(key));
 }
}

function loadVisibleVectorSources(map:MapLibreMap,hooks?:OverlayHooks){
 const loaded=loadedVectorSources.get(map)??new Set<string>();
 loadedVectorSources.set(map,loaded);
 for(const config of vectorSources()){
   if(loaded.has(config.id)||!viewportIntersects(map,config.bounds))continue;
   const source=map.getSource(config.id) as maplibregl.GeoJSONSource|undefined;
   if(!source)continue;
   const key=`vector:${config.id}`;
   hooks?.start(key,config.id.replaceAll('-',' '));
   void Promise.resolve(typeof config.url==='function'?config.url():config.url).then(url=>fetch(url)).then(response=>{if(!response.ok)throw new Error(`${config.id} failed (${response.status})`);return response.json()}).then(data=>{
     source.setData(config.transform?config.transform(data):data);loaded.add(config.id);
   }).catch(error=>console.warn(error)).finally(()=>hooks?.finish(key));
 }
}

function weatherData(location?:Location,weather?:Weather,hourIndex=0,visible=true){
 const hour=weather?.hourly[hourIndex];
 if(!location||!weather||!visible)return {type:'FeatureCollection' as const,features:[]};
 const score=hour?.score??weather.score,color=score>=70?'#78f5a4':score>=45?'#ffd463':'#ff6b6b';
 return {type:'FeatureCollection' as const,features:[{type:'Feature' as const,properties:{color,score},geometry:{type:'Point' as const,coordinates:[location.lng,location.lat]}}]};
}

function applyWeather(map:MapLibreMap,location?:Location,weather?:Weather,hourIndex=0,visible=true){
 const source=map.getSource('weather-location') as maplibregl.GeoJSONSource|undefined;
 source?.setData(weatherData(location,weather,hourIndex,visible));
}

function flightPlanData(points:Location[]){
 const pointFeatures=points.map((point,index)=>({type:'Feature' as const,properties:{index:index+1,last:index===points.length-1},geometry:{type:'Point' as const,coordinates:[point.lng,point.lat]}}));
 const line=points.length>1?[{type:'Feature' as const,properties:{},geometry:{type:'LineString' as const,coordinates:points.map(point=>[point.lng,point.lat])}}]:[];
 return{type:'FeatureCollection' as const,features:[...line,...pointFeatures]};
}

function applyFlightPlan(map:MapLibreMap,points:Location[]){
 (map.getSource('flight-plan') as maplibregl.GeoJSONSource|undefined)?.setData(flightPlanData(points));
}

async function latestRadar(){
 if(!radarMetadata)radarMetadata=fetch('https://api.rainviewer.com/public/weather-maps.json').then(async response=>{
   if(!response.ok)throw new Error(`radar metadata failed (${response.status})`);
   const data=await response.json(),frame=data.radar?.past?.at(-1);
   if(!frame?.path||!data.host)throw new Error('radar metadata contained no frame');
   return{tiles:[`${data.host}${frame.path}/256/{z}/{x}/{y}/2/1_1.png`],time:Number(frame.time??0)};
 }).finally(()=>window.setTimeout(()=>{radarMetadata=undefined},5*60*1000));
 return radarMetadata;
}

function ensureRadar(map:MapLibreMap,visible:boolean,hooks?:OverlayHooks){
 if(map.getLayer('weather-radar')){map.setLayoutProperty('weather-radar','visibility',visible?'visible':'none');return}
 if(!visible||!map.isStyleLoaded()||radarUnavailableMaps.has(map))return;
 const key='weather:radar';hooks?.start(key,'live precipitation radar');
 void latestRadar().then(({tiles,time})=>{
   if(!map.isStyleLoaded()||map.getSource('weather-radar'))return;
   map.addSource('weather-radar',{type:'raster',tiles,tileSize:256,maxzoom:7,attribution:`<a href="https://www.rainviewer.com/" target="_blank">Radar © RainViewer · ${new Date(time*1000).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</a>`});
   map.addLayer({id:'weather-radar',type:'raster',source:'weather-radar',paint:{'raster-opacity':.62,'raster-fade-duration':180}},map.getLayer('weather-clouds')?'weather-clouds':undefined);
 }).catch(error=>console.warn(error)).finally(()=>hooks?.finish(key));
}

async function queryWeatherGrid(map:MapLibreMap,hourIndex:number,detail:RenderDetail){
 const bounds=map.getBounds(),{weatherColumns:columns,weatherRows:rows}=detailConfig[detail];
 const west=Math.max(-179.5,bounds.getWest()),east=Math.min(179.5,bounds.getEast());
 const south=Math.max(-80,bounds.getSouth()),north=Math.min(80,bounds.getNorth());
 const latitudes:number[]=[],longitudes:number[]=[];
 for(let row=0;row<rows;row++)for(let column=0;column<columns;column++){
   latitudes.push(south+(north-south)*(row+.5)/rows);
   longitudes.push(west+(east-west)*(column+.5)/columns);
 }
 const params=new URLSearchParams({
   latitude:latitudes.map(value=>value.toFixed(3)).join(','),
   longitude:longitudes.map(value=>value.toFixed(3)).join(','),
   hourly:'temperature_2m,precipitation_probability,precipitation,cloud_cover,wind_speed_10m,wind_direction_10m',
   forecast_hours:'12',timezone:'UTC'
 });
 let response:Response|undefined;
 for(let attempt=0;attempt<2;attempt++){response=await fetch(`https://api.open-meteo.com/v1/forecast?${params}`);if(response.ok)break;if(response.status!==429&&response.status<500)break;await new Promise(resolve=>setTimeout(resolve,1400*(attempt+1)))}
 if(!response?.ok)throw new Error(`weather grid failed (${response?.status??'offline'})`);
 const payload=await response.json(),locations=Array.isArray(payload)?payload:[payload],features:any[]=[];
 const cellWidth=Math.max(.08,Math.abs(east-west)/columns),cellHeight=Math.max(.08,Math.abs(north-south)/rows);
 locations.forEach((item:any,index:number)=>{
   const hourly=item.hourly??{},slot=Math.min(hourIndex,Math.max(0,(hourly.time?.length??1)-1));
   const lat=Number(item.latitude??latitudes[index]),lng=Number(item.longitude??longitudes[index]);
   const rain=Number(hourly.precipitation_probability?.[slot]??0),precipitation=Number(hourly.precipitation?.[slot]??0);
   const clouds=Number(hourly.cloud_cover?.[slot]??0),wind=Number(hourly.wind_speed_10m?.[slot]??0),direction=Number(hourly.wind_direction_10m?.[slot]??0);
   const properties={kind:'cell',rain,precipitation,clouds,wind,direction,temperature:Number(hourly.temperature_2m?.[slot]??0)};
   features.push({type:'Feature',properties,geometry:{type:'Point',coordinates:[lng,lat]}});
   const radians=(direction+180)*Math.PI/180,length=Math.min(1,.22+wind/75);
   const dx=Math.sin(radians)*cellWidth*.42*length,dy=Math.cos(radians)*cellHeight*.42*length;
   features.push({type:'Feature',properties:{...properties,kind:'wind'},geometry:{type:'LineString',coordinates:[[lng-dx*.35,lat-dy*.35],[lng+dx,lat+dy]]}});
 });
 return {type:'FeatureCollection' as const,features};
}

function loadWeatherGrid(map:MapLibreMap,hourIndex:number,visible:boolean,detail:RenderDetail,enabled:boolean,hooks?:OverlayHooks){
 const source=map.getSource('weather-grid') as maplibregl.GeoJSONSource|undefined;
 if(!source)return;
 if(!visible||!enabled){source.setData(emptyGeoJson);return}
 const keys=dynamicRequestKeys.get(map)??new Map<string,string>();dynamicRequestKeys.set(map,keys);
 const b=map.getBounds(),key=['weather',detail,hourIndex,Math.floor(map.getZoom()),b.getWest().toFixed(1),b.getSouth().toFixed(1),b.getEast().toFixed(1),b.getNorth().toFixed(1)].join(':');
 if(keys.get('weather-grid')===key)return;
 const cached=weatherGridCache.get(key);
 if(cached&&Date.now()-cached.time<10*60*1000){keys.set('weather-grid',key);source.setData(cached.data);return}
 keys.set('weather-grid',key);hooks?.start(key,'weather field');
 const pending=weatherGridPending.get(key)??queryWeatherGrid(map,hourIndex,detail).finally(()=>weatherGridPending.delete(key));
 weatherGridPending.set(key,pending);
 void pending.then(data=>{
   weatherGridCache.set(key,{time:Date.now(),data});
   if(keys.get('weather-grid')===key)(map.getSource('weather-grid') as maplibregl.GeoJSONSource|undefined)?.setData(data);
 }).catch(error=>{if(keys.get('weather-grid')===key)keys.delete('weather-grid');console.warn(error)}).finally(()=>hooks?.finish(key));
}

const spainColor=['match',['get','type'],'PROHIBITED','#ff405b','REQ_AUTHORIZATION','#ffad3d','CONDITIONAL','#f2ce50','NO_RESTRICTION','#5ce09a','#69bff5'] as any;
const geozoneColor=['match',['get','restriction'],'PROHIBITED','#ff405d','REQ_AUTHORISATION','#ff9e43','REQ_AUTHORIZATION','#ff9e43','CONDITIONAL','#ffd45d','NO_RESTRICTION','#56d78d','#7fb4ff'] as any;
const geozoneOpacity=['match',['get','restriction'],'NO_RESTRICTION',.075,'CONDITIONAL',.16,.24] as any;
const enaireOpacityAt=(localOpacity:number)=>['case',
 ['>', ['coalesce',['get','_aerisAreaKm2'],0],2500],.035,
 ['>', ['coalesce',['get','_aerisAreaKm2'],0],600],.075,
 localOpacity
] as any;
const enaireFillOpacity=['interpolate',['linear'],['zoom'],3,enaireOpacityAt(.13),8,enaireOpacityAt(.22),12,enaireOpacityAt(.3)] as any;

function mapStyle(baseMap: BaseMap, zonesVisible: boolean): StyleSpecification {
  const satellite = baseMap === 'satellite';
  const swedenSources=Object.fromEntries(SWEDEN_SOURCE_IDS.map(id=>[`sweden-${id}`,{type:'geojson' as const,data:emptyGeoJson,attribution:'<a href="https://daim.lfv.se/echarts/dronechart/API/" target="_blank">LFV Dronechart · CC BY-NC-ND 4.0</a>'}]));
  const nationalGeozoneSources=Object.fromEntries(NATIONAL_GEOZONE_SOURCES.map(source=>[source.id,{type:'geojson' as const,data:emptyGeoJson,attribution:source.attribution}]));
  const nationalGeozoneLayers=NATIONAL_GEOZONE_SOURCES.flatMap(source=>{
    const filter=source.id==='estonia'?{filter:['!=',['get','identifier'],'EERZout'] as FilterSpecification}:{};
    const fillColor=source.id==='estonia'
      ? ['match',['get','restriction'],'PROHIBITED','#ff6670','REQ_AUTHORISATION','#f4dc4b','REQ_AUTHORIZATION','#f4dc4b','NO_RESTRICTION','#60c878','#9db7d8']
      : source.id==='portugal'
        ? ['match',['get','restriction'],'PROHIBITED','#ff2a35','#ffeb19']
      : geozoneColor;
    const lineColor=source.id==='estonia'
      ? ['match',['get','restriction'],'PROHIBITED','#ff2f3f','REQ_AUTHORISATION','#235bd6','REQ_AUTHORIZATION','#235bd6','NO_RESTRICTION','#2c9d52','#5479a8']
      : source.id==='portugal'
        ? ['match',['get','restriction'],'PROHIBITED','#ff1f2d','#fff000']
      : geozoneColor;
    const fillOpacity=source.id==='portugal'?.07:geozoneOpacity;
    return[
      {id:`${source.id}-zones`,type:'fill' as const,source:source.id,minzoom:source.minzoom,...filter,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'fill-color':fillColor as any,'fill-opacity':fillOpacity}},
      {id:`${source.id}-lines`,type:'line' as const,source:source.id,minzoom:source.minzoom,...filter,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'line-color':lineColor as any,'line-width':['interpolate',['linear'],['zoom'],source.minzoom,.7,12,2.2] as any,'line-opacity':.94}}
    ];
  });
  const swedenLayers=SWEDEN_POLYGON_SOURCES.flatMap((id,index)=>{
    const filter=swedenDisplayFilter(id),filterProperty=filter?{filter}:{};
    return[
      {id:`sweden-${id}-fill`,type:'fill' as const,source:`sweden-${id}`,minzoom:index>=5?5.5:5,...filterProperty,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'fill-color':index<5?'#ff8b5b':'#cf6cff','fill-opacity':index<5?.16:.1}},
      {id:`sweden-${id}-line`,type:'line' as const,source:`sweden-${id}`,minzoom:index>=5?5.5:5,...filterProperty,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'line-color':index<5?'#ffb06f':'#e2a1ff','line-width':['interpolate',['linear'],['zoom'],5,.7,12,1.8] as any,'line-opacity':.88}}
    ];
  });
  return {
    version: 8,
    projection:{type:'globe'},
    sky:{'atmosphere-blend':['interpolate',['linear'],['zoom'],0,1,5,.9,7,0] as any},
    sources: {
      basemap: {
        type: 'raster',
        tiles: satellite
          ? ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}']
          : ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: satellite ? 19 : 19,
        attribution: satellite
          ? 'Tiles © Esri — Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community'
          : '© OpenStreetMap contributors'
      },
      dipul: {
        type: 'raster',
        tiles: [dipulTiles(DIPUL_CORE_LAYERS)],
        tileSize: 256,
        bounds:[5.5,47,15.5,55.2],
        attribution: '<a href="https://dipul.bund.de/" target="_blank">Quelle Geodaten: DFS, BKG 2026</a>'
      },
      'dipul-detail': {
        type:'raster',
        tiles:[dipulTiles(DIPUL_DETAIL_LAYERS)],
        tileSize:256,
        bounds:[5.5,47,15.5,55.2],
        attribution:'DIPUL detail objects © DFS, BKG 2026'
      },
      'enaire-infrastructure':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://aip.enaire.es/AIP/UAS-en.html" target="_blank">UAS zones © ENAIRE / AIS</a>'},
      'enaire-aero':{type:'geojson',data:emptyGeoJson,attribution:'UAS zones © ENAIRE / AIS'},
      'enaire-urban':{type:'geojson',data:emptyGeoJson,attribution:'UAS zones © ENAIRE / AIS'},
      france: {type:'raster',tiles:[franceTiles],tileSize:256,bounds:[-5.5,41,10,51.5],minzoom:6,maxzoom:18,attribution:'<a href="https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme" target="_blank">Restrictions UAS © IGN / Géoportail</a>'},
      uk:{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/" target="_blank">NATS UK AIS · effective 9 Jul 2026</a>'},
      switzerland:{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://opendata.swiss/en/dataset/geografische-uas-gebiete-der-schweiz" target="_blank">UAS zones © FOCA / geo.admin.ch</a>'},
      'us-facility':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://www.faa.gov/uas/getting_started/b4ufly" target="_blank">FAA UAS Facility Maps</a>'},
      'canada-airports':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://open.canada.ca/data/en/dataset/3a1eb6ef-6054-4f9d-b1f6-c30322cd7abf" target="_blank">Transport Canada Open Government Licence</a>'},
      'canada-national-parks':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://open.canada.ca/data/en/dataset/9e1507cd-f25c-4c64-995b-6563bf9d65bd" target="_blank">Natural Resources Canada · Open Government Licence</a>'},
      luxembourg: { type:'geojson', data:emptyGeoJson, attribution:'Direction de l’Aviation Civile Luxembourg · CC0' },
      ireland: { type:'geojson', data:emptyGeoJson, attribution:'<a href="https://www.iaa.ie/general-aviation/drones/uas-geographic-zones" target="_blank">Irish Aviation Authority UAS zones</a>' },
      denmark:{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://www.droneregler.dk/dronezoner/dronezoner-data-vejledninger/data-downloads" target="_blank">Drone zones © Trafikstyrelsen</a>'},
      'denmark-nature':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://www.droneregler.dk/dronezoner/dronezoner-data-vejledninger/data-downloads" target="_blank">Nature zones © Trafikstyrelsen</a>'},
      ...nationalGeozoneSources,
      ...swedenSources,
      'weather-grid': { type:'geojson', data:emptyGeoJson, attribution:'Forecast field © Open-Meteo' },
      'weather-location': { type:'geojson', data:emptyGeoJson },
      'flight-plan': { type:'geojson', data:emptyGeoJson }
    },
    layers: [
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 250 } },
      { id: 'dipul-zones', type: 'raster', source: 'dipul', layout: { visibility: zonesVisible ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.78, 'raster-fade-duration': 150 } },
      { id:'dipul-detail',type:'raster',source:'dipul-detail',minzoom:8.5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'raster-opacity':.76,'raster-fade-duration':120}},
      {id:'enaire-infrastructure-fill',type:'fill',source:'enaire-infrastructure',minzoom:3,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':spainColor,'fill-opacity':enaireFillOpacity}},
      {id:'enaire-infrastructure-line',type:'line',source:'enaire-infrastructure',minzoom:3,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':spainColor,'line-width':['interpolate',['linear'],['zoom'],3,.65,12,2.1],'line-opacity':.95}},
      {id:'enaire-aero-fill',type:'fill',source:'enaire-aero',minzoom:3,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':spainColor,'fill-opacity':enaireFillOpacity}},
      {id:'enaire-aero-line',type:'line',source:'enaire-aero',minzoom:3,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':spainColor,'line-width':['interpolate',['linear'],['zoom'],3,.75,12,2.2],'line-opacity':.98}},
      {id:'enaire-urban-fill',type:'fill',source:'enaire-urban',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['match',['get','type'],'REQ_AUTHORIZATION','#bb7cff','PROHIBITED','#ff405b','CONDITIONAL','#f2ce50','#b57cff'],'fill-opacity':enaireFillOpacity}},
      {id:'enaire-urban-line',type:'line',source:'enaire-urban',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#d0a8ff','line-width':1.1,'line-opacity':.86}},
      {id:'france-zones',type:'raster',source:'france',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'raster-opacity':.82,'raster-fade-duration':100}},
      {id:'uk-zones',type:'fill',source:'uk',minzoom:4.5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['match',['get','category'],'Danger','#c43b73','Prohibited','#ff405d','Restricted','#e55270','#e55270'],'fill-opacity':['interpolate',['linear'],['zoom'],4.5,.2,8,.26,12,.32]}},
      {id:'uk-lines',type:'line',source:'uk',minzoom:4.5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['match',['get','category'],'Danger','#ef6098','Prohibited','#ff667d','Restricted','#ff748c','#ff748c'],'line-width':['interpolate',['linear'],['zoom'],4.5,.75,12,2.2],'line-opacity':.98}},
      {id:'swiss-zones',type:'fill',source:'switzerland',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['coalesce',['get','fill'],'#b11313'] as any,'fill-opacity':['interpolate',['linear'],['zoom'],5,.2,10,.34,15,.42]}},
      {id:'swiss-lines',type:'line',source:'switzerland',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['coalesce',['get','stroke'],['get','fill'],'#ff6b6b'] as any,'line-width':['interpolate',['linear'],['zoom'],5,.7,12,2.1],'line-opacity':.92}},
      {id:'us-facility-fill',type:'fill',source:'us-facility',minzoom:7,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['step',['to-number',['get','CEILING']], '#ff4056',1,'#ff7c4d',100,'#ffb44e',300,'#ffe069'],'fill-opacity':.2}},
      {id:'us-facility-line',type:'line',source:'us-facility',minzoom:7,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['step',['to-number',['get','CEILING']], '#ff4056',1,'#ff7c4d',100,'#ffb44e',300,'#ffe069'],'line-width':['interpolate',['linear'],['zoom'],7,.45,13,1.5],'line-opacity':.9}},
      {id:'canada-national-parks',type:'fill',source:'canada-national-parks',minzoom:3,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#ff9e43','fill-opacity':['interpolate',['linear'],['zoom'],3,.13,7,.2,12,.28]}},
      {id:'canada-national-park-lines',type:'line',source:'canada-national-parks',minzoom:3,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#ffc26d','line-width':['interpolate',['linear'],['zoom'],3,.65,12,2.1],'line-opacity':.94}},
      {id:'canada-airport-rings',type:'fill',source:'canada-airports',minzoom:3,filter:['==',['geometry-type'],'Polygon'],layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#ffb548','fill-opacity':['interpolate',['linear'],['zoom'],3,.1,7,.2,12,.27]}},
      {id:'canada-airport-lines',type:'line',source:'canada-airports',minzoom:3,filter:['==',['geometry-type'],'Polygon'],layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#ffd37c','line-width':['interpolate',['linear'],['zoom'],3,.65,12,2],'line-opacity':.92}},
      {id:'canada-airports',type:'circle',source:'canada-airports',minzoom:4,filter:['==',['geometry-type'],'Point'],layout:{visibility:zonesVisible?'visible':'none'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,2.5,11,7],'circle-color':'#f7f4e8','circle-stroke-color':'#ffb548','circle-stroke-width':2}},
      { id:'luxembourg-zones', type:'fill', source:'luxembourg', layout:{visibility:zonesVisible?'visible':'none'}, paint:{'fill-color':['match',['get','restriction'],'PROHIBITED','#ff4d57','REQ_AUTHORIZATION','#ff9e43','#ffd75e'],'fill-opacity':.42,'fill-outline-color':'#fff2d0'} },
      { id:'ireland-zones',type:'fill',source:'ireland',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['match',['get','type'],'PROHIBITED','#ff455d','REQ_AUTHORIZATION','#ffb84d','CONDITIONAL','#55dff0','NO_RESTRICTION','#61df91','#9bc4ff'],'fill-opacity':['match',['get','type'],'NO_RESTRICTION',.1,.24]}},
      { id:'ireland-lines',type:'line',source:'ireland',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['match',['get','type'],'PROHIBITED','#ff6a7c','REQ_AUTHORIZATION','#ffd16a','CONDITIONAL','#76e7f3','NO_RESTRICTION','#79eea4','#a7caff'],'line-width':['interpolate',['linear'],['zoom'],5,.7,12,2.2],'line-opacity':.9}},
      {id:'denmark-zones',type:'fill',source:'denmark',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['match',['to-string',['get','Farve']],'1','#ff455d','4','#4f8cff','5','#ff9d43','#ffd15c'],'fill-opacity':.24}},
      {id:'denmark-lines',type:'line',source:'denmark',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['match',['to-string',['get','Farve']],'1','#ff7182','4','#73a5ff','5','#ffb56f','#ffe08a'],'line-width':['interpolate',['linear'],['zoom'],5,.7,12,2.2],'line-opacity':.92}},
      {id:'denmark-nature',type:'fill',source:'denmark-nature',minzoom:7,filter:['==',['get','Aktiv'],'JA'],layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#50d982','fill-opacity':.13}},
      {id:'denmark-nature-lines',type:'line',source:'denmark-nature',minzoom:7,filter:['==',['get','Aktiv'],'JA'],layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#78efa0','line-width':1.1,'line-opacity':.85}},
      ...nationalGeozoneLayers,
      ...swedenLayers,
      {id:'sweden-airports',type:'circle',source:'sweden-mais-ARP',minzoom:8,layout:{visibility:zonesVisible?'visible':'none'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,2.5,11,6],'circle-color':'#ffdc69','circle-stroke-color':'#2b2110','circle-stroke-width':1}},
      {id:'weather-clouds',type:'heatmap',source:'weather-grid',filter:['==',['get','kind'],'cell'],paint:{'heatmap-weight':['/', ['get','clouds'],100] as any,'heatmap-intensity':['interpolate',['linear'],['zoom'],0,.45,8,.75,14,1.05] as any,'heatmap-radius':['interpolate',['linear'],['zoom'],0,80,6,115,12,150] as any,'heatmap-opacity':.46,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(255,255,255,0)',.18,'rgba(218,233,238,.15)',.45,'rgba(230,241,244,.38)',.75,'rgba(255,255,255,.64)',1,'rgba(255,255,255,.82)'] as any}},
      {id:'weather-rain',type:'heatmap',source:'weather-grid',filter:['==',['get','kind'],'cell'],paint:{'heatmap-weight':['min',1,['+', ['/', ['get','rain'],100],['/', ['get','precipitation'],8]]] as any,'heatmap-intensity':['interpolate',['linear'],['zoom'],0,.7,10,1.2] as any,'heatmap-radius':['interpolate',['linear'],['zoom'],0,45,7,90,13,125] as any,'heatmap-opacity':.76,'heatmap-color':['interpolate',['linear'],['heatmap-density'],0,'rgba(35,169,255,0)',.16,'rgba(63,182,255,.28)',.4,'rgba(46,220,239,.56)',.68,'rgba(255,222,82,.76)',.88,'rgba(255,132,58,.88)',1,'rgba(226,57,82,.95)'] as any}},
      {id:'weather-wind',type:'line',source:'weather-grid',filter:['==',['get','kind'],'wind'],layout:{'line-cap':'round','line-join':'round'},paint:{'line-color':['interpolate',['linear'],['get','wind'],0,'#dff9ff',20,'#79ddff',40,'#ffd267',65,'#ff795f'] as any,'line-width':['interpolate',['linear'],['zoom'],0,.7,8,1.35,14,2.2] as any,'line-opacity':.82,'line-dasharray':[0,4,3]}},
      { id:'weather-field', type:'circle', source:'weather-location', paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,28,10,150,15,280],'circle-color':['get','color'],'circle-opacity':.1,'circle-blur':.82} },
      { id:'weather-halo', type:'circle', source:'weather-location', paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,12,10,56,15,105],'circle-color':['get','color'],'circle-opacity':.17,'circle-blur':.45,'circle-stroke-width':2,'circle-stroke-color':['get','color'],'circle-stroke-opacity':.7} },
      { id:'weather-core', type:'circle', source:'weather-location', paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,3,10,8,15,13],'circle-color':['get','color'],'circle-opacity':.9,'circle-stroke-width':3,'circle-stroke-color':'#ffffff','circle-stroke-opacity':.85} },
      {id:'flight-plan-halo',type:'line',source:'flight-plan',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#07120f','line-width':['interpolate',['linear'],['zoom'],3,5,14,10],'line-opacity':.75}},
      {id:'flight-plan-line',type:'line',source:'flight-plan',filter:['==',['geometry-type'],'LineString'],paint:{'line-color':'#b7ff9c','line-width':['interpolate',['linear'],['zoom'],3,2,14,4],'line-opacity':.98,'line-dasharray':[2,1.1]}},
      {id:'flight-plan-points',type:'circle',source:'flight-plan',filter:['==',['geometry-type'],'Point'],paint:{'circle-radius':['interpolate',['linear'],['zoom'],3,5,14,10],'circle-color':['case',['get','last'],'#ffffff','#b7ff9c'],'circle-stroke-color':'#102017','circle-stroke-width':3}}
    ]
  };
}

const WIND_DASH_FRAMES=[
 [0,4,3],[.5,4,2.5],[1,4,2],[1.5,4,1.5],[2,4,1],[2.5,4,.5],[3,4,0],
 [0,.5,3,3.5],[0,1,3,3],[0,1.5,3,2.5],[0,2,3,2],[0,2.5,3,1.5],[0,3,3,1],[0,3.5,3,.5]
] as number[][];

function startWindLineAnimation(map:MapLibreMap){
 let stopped=false,animation=0,lastFrame=-1;
 const animate=(time:number)=>{
  if(stopped)return;
  const frame=Math.floor(time/75)%WIND_DASH_FRAMES.length;
  if(frame!==lastFrame&&map.getLayer('weather-wind')){
   lastFrame=frame;
   try{map.setPaintProperty('weather-wind','line-dasharray',WIND_DASH_FRAMES[frame])}catch{}
  }
  animation=requestAnimationFrame(animate);
 };
 animation=requestAnimationFrame(animate);
 return()=>{stopped=true;cancelAnimationFrame(animation)};
}

const exportLayerIds=[...ZONE_LAYER_IDS,'weather-clouds','weather-rain','weather-wind','weather-field','weather-halo','weather-core','flight-plan-line','flight-plan-points'] as string[];

function downloadBlob(blob:Blob,filename:string){
 const url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=filename;link.click();
 window.setTimeout(()=>URL.revokeObjectURL(url),1200);
}

function safeMapName(name='map'){
 return name.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'map';
}

function layerIsVisible(map:MapLibreMap,layer:any){
 const zoom=map.getZoom();
 return layer.layout?.visibility!=='none'&&(layer.minzoom==null||zoom>=layer.minzoom)&&(layer.maxzoom==null||zoom<layer.maxzoom);
}

function downloadVisibleGeoJson(map:MapLibreMap,name?:string){
 const style=map.getStyle(),visibleLayers=(style.layers??[]).filter(layer=>exportLayerIds.includes(layer.id)&&layer.type!=='raster'&&layerIsVisible(map,layer));
 const rendered=visibleLayers.length?map.queryRenderedFeatures({layers:visibleLayers.map(layer=>layer.id)}):[];
 const byKey=new Map<string,any>();
 for(const feature of rendered){
   const source=feature.source??'unknown',key=feature.id!=null?`${source}:${feature.id}`:`${source}:${JSON.stringify(feature.geometry)}:${JSON.stringify(feature.properties)}`;
   const layerId=feature.layer?.id??'unknown';
   const existing=byKey.get(key);
   if(existing){if(!existing.properties._aerisRenderedLayers.includes(layerId))existing.properties._aerisRenderedLayers.push(layerId);continue}
   byKey.set(key,{type:'Feature',id:feature.id,geometry:feature.geometry,properties:{...feature.properties,_aerisSource:source,_aerisRenderedLayers:[layerId]}});
 }
 const bounds=map.getBounds();
 const viewIntersectsSource=(source:any)=>{
   if(!source?.bounds)return true;
   const [west,south,east,north]=source.bounds;
   return bounds.getEast()>=west&&bounds.getWest()<=east&&bounds.getNorth()>=south&&bounds.getSouth()<=north;
 };
 const rasterLayers=(style.layers??[]).filter((layer:any)=>{
   const source=(style.sources as any)[String(layer.source)];
   return layer.type==='raster'&&layer.id!=='basemap'&&layerIsVisible(map,layer)&&viewIntersectsSource(source);
 });
 const rasterReferences=rasterLayers.map((layer:any)=>{
   const sourceId=String(layer.source),source=(style.sources as any)[sourceId]??{};
   return{layerId:layer.id,sourceId,tileTemplates:source.tiles??[],attribution:source.attribution??'',note:'Raster pixels cannot be embedded in GeoJSON. The clean PNG snapshot contains the rendered raster overlay.'};
 });
 const collection={
   type:'FeatureCollection',
   name:`Aeris visible overlays - ${name??'current map'}`,
   properties:{
     exportedAt:new Date().toISOString(),
     viewport:{west:bounds.getWest(),south:bounds.getSouth(),east:bounds.getEast(),north:bounds.getNorth(),zoom:map.getZoom(),bearing:map.getBearing(),pitch:map.getPitch()},
     visibleVectorLayers:[...new Set(rendered.map(feature=>feature.layer?.id).filter(Boolean))],
     rasterOverlays:rasterReferences,
     notice:'Contains vector features currently rendered in the viewport. Raster services are referenced as metadata; use the PNG snapshot for their rendered pixels.'
   },
   features:[...byKey.values()]
 };
 downloadBlob(new Blob([JSON.stringify(collection,null,2)],{type:'application/geo+json'}),`aeris-visible-overlays-${safeMapName(name)}.geojson`);
}

async function downloadCleanSnapshot(map:MapLibreMap,name?:string){
 await new Promise<void>(resolve=>{
   let finished=false;
   const done=()=>{if(finished)return;finished=true;resolve()};
   map.once('render',done);map.triggerRepaint();window.setTimeout(done,450);
 });
 const canvas=map.getCanvas();
 const blob=await new Promise<Blob>((resolve,reject)=>{
   try{canvas.toBlob(value=>value?resolve(value):reject(new Error('The map image could not be encoded.')),'image/png')}catch(error){reject(error)}
 });
 downloadBlob(blob,`aeris-map-snapshot-${safeMapName(name)}.png`);
}

export const MapCanvas=forwardRef<MapCanvasHandle,{ location?: Location; weather?:Weather; weatherError?:string; onPick: (location: Location) => void; settings:AppSettings; planPoints?:Location[]; plannerMode?:boolean; onPlanPoint?:(location:Location)=>void }>(function MapCanvas({ location, weather, weatherError='', onPick, settings, planPoints=[], plannerMode=false, onPlanPoint },ref) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const windAnimationRef=useRef<(()=>void)|null>(null);
  const onPickRef = useRef(onPick);
  const plannerRef=useRef({active:plannerMode,onPoint:onPlanPoint});
  const planPointsRef=useRef(planPoints);
  const weatherStateRef=useRef({location,weather,hour:0,visible:true});
  const settingsRef=useRef(settings);
  const overlayTasksRef=useRef({pending:new Set<string>(),done:0,total:0,label:'official overlays'});
  const initialStyleRef=useRef(true);
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [zonesVisible, setZonesVisible] = useState(true);
  const [weatherVisible,setWeatherVisible]=useState(true);
  const [weatherHour,setWeatherHour]=useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [overlayProgress,setOverlayProgress]=useState<{done:number;total:number;label:string}|null>(null);
  const [radarNotice,setRadarNotice]=useState('');
  const hooksRef=useRef<OverlayHooks|null>(null);
  if(!hooksRef.current)hooksRef.current={
    start:(id,label)=>{
      const state=overlayTasksRef.current;if(state.pending.has(id))return;
      if(state.pending.size===0){state.done=0;state.total=0}
      state.pending.add(id);state.total+=1;state.label=label;setOverlayProgress({done:state.done,total:state.total,label});
    },
    finish:id=>{
      const state=overlayTasksRef.current;if(!state.pending.delete(id))return;
      state.done+=1;setOverlayProgress({done:state.done,total:state.total,label:state.label});
      if(state.pending.size===0)window.setTimeout(()=>{if(overlayTasksRef.current.pending.size===0)setOverlayProgress(null)},550);
    }
  };

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);
  useEffect(()=>{plannerRef.current={active:plannerMode,onPoint:onPlanPoint}},[plannerMode,onPlanPoint]);
  useEffect(()=>{planPointsRef.current=planPoints},[planPoints]);
  useEffect(()=>{settingsRef.current=settings},[settings]);
  useEffect(()=>{
    const map=mapRef.current;
    windAnimationRef.current?.();
    windAnimationRef.current=null;
    if(map?.isStyleLoaded()&&!settings.reducedMotion)windAnimationRef.current=startWindLineAnimation(map);
    return()=>{windAnimationRef.current?.();windAnimationRef.current=null};
  },[settings.reducedMotion]);
  useImperativeHandle(ref,()=>({
    downloadVisibleGeoJson:(name?:string)=>{const map=mapRef.current;if(!map)throw new Error('The map is not ready yet.');downloadVisibleGeoJson(map,name)},
    downloadCleanSnapshot:async(name?:string)=>{const map=mapRef.current;if(!map)throw new Error('The map is not ready yet.');await downloadCleanSnapshot(map,name)}
  }),[]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: hostRef.current,
      style: mapStyle('satellite', true),
      center: [10.2, 51.1],
      zoom: 5.1,
      attributionControl: { compact: true },
      maxZoom: 19,
      canvasContextAttributes:{preserveDrawingBuffer:true}
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.GlobeControl(), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.touchZoomRotate.enable();
    map.dragPan.enable();
    const refresh=()=>{const detail=settingsRef.current.renderDetail,hooks=hooksRef.current??undefined,state=weatherStateRef.current;loadVisibleVectorSources(map,hooks);loadDynamicCountrySources(map,detail,hooks);ensureRadar(map,state.visible,hooks);loadWeatherGrid(map,state.hour,state.visible,detail,Boolean(state.location&&state.weather),hooks)};
    map.on('load', () => { map.setProjection({type:'globe'});setLoaded(true); setError(''); map.resize();refresh();applyWeather(map,weatherStateRef.current.location,weatherStateRef.current.weather,weatherStateRef.current.hour,weatherStateRef.current.visible);applyFlightPlan(map,planPointsRef.current);if(!settingsRef.current.reducedMotion&&!windAnimationRef.current)windAnimationRef.current=startWindLineAnimation(map); });
    map.on('style.load',()=>{map.setProjection({type:'globe'});loadedVectorSources.set(map,new Set());dynamicRequestKeys.set(map,new Map());refresh();applyWeather(map,weatherStateRef.current.location,weatherStateRef.current.weather,weatherStateRef.current.hour,weatherStateRef.current.visible);applyFlightPlan(map,planPointsRef.current)});
    map.on('moveend',refresh);
    map.on('click', event => {
      const point={lat:event.lngLat.lat,lng:event.lngLat.lng,name:`${event.lngLat.lat.toFixed(5)}, ${event.lngLat.lng.toFixed(5)}`};
      if(plannerRef.current.active)plannerRef.current.onPoint?.(point);else onPickRef.current(point);
    });
    map.on('error', event => {
      const message=event.error?.message||'';
      const sourceId=String((event as any).sourceId??'');
      if(/rainviewer|tilecache\\.rainviewer|weather-radar/i.test(`${sourceId} ${message}`)){
        radarUnavailableMaps.add(map);
        setRadarNotice('Live radar is unavailable. Forecast rain and wind lines remain active.');
        window.setTimeout(()=>{
          if(map.getLayer('weather-radar'))map.removeLayer('weather-radar');
          if(map.getSource('weather-radar'))map.removeSource('weather-radar');
        },0);
        return;
      }
      if(sourceId&&sourceId!=='basemap'){console.warn(event.error);return}
      if (!map.loaded()) setError(message || 'The basemap could not load.');
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(hostRef.current);
    return () => {
      resize.disconnect();
      windAnimationRef.current?.();
      windAnimationRef.current=null;
      markerRef.current?.remove();
      map.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    if(initialStyleRef.current){initialStyleRef.current=false;return}
    mapRef.current.setStyle(mapStyle(baseMap, zonesVisible));
  }, [baseMap]);

  useEffect(()=>{
    const map=mapRef.current;if(!map)return;
    for(const id of ZONE_LAYER_IDS)if(map.getLayer(id))map.setLayoutProperty(id,'visibility',zonesVisible?'visible':'none');
  },[zonesVisible,loaded,baseMap]);

  useEffect(() => {
    const map = mapRef.current;
    if (!location || !map) return;
    map.flyTo({ center: [location.lng, location.lat], zoom: Math.max(map.getZoom(), 11), essential: true });
    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker({ color: '#b6ff94' })
      .setLngLat([location.lng, location.lat])
      .addTo(map);
  }, [location]);

  useEffect(()=>{weatherStateRef.current={location,weather,hour:weatherHour,visible:weatherVisible};const map=mapRef.current;if(!map)return;if(map.isStyleLoaded()){applyWeather(map,location,weather,weatherHour,weatherVisible);ensureRadar(map,weatherVisible,hooksRef.current??undefined);loadWeatherGrid(map,weatherHour,weatherVisible,settingsRef.current.renderDetail,Boolean(location&&weather),hooksRef.current??undefined)}},[location,weather,weatherHour,weatherVisible]);

  useEffect(()=>{const map=mapRef.current;if(!map||!map.isStyleLoaded())return;const hooks=hooksRef.current??undefined;loadDynamicCountrySources(map,settings.renderDetail,hooks);ensureRadar(map,weatherVisible,hooks);loadWeatherGrid(map,weatherHour,weatherVisible,settings.renderDetail,Boolean(location&&weather),hooks)},[settings.renderDetail,weatherHour,weatherVisible,loaded,baseMap,location,weather]);

  useEffect(()=>{const map=mapRef.current;if(map?.isStyleLoaded())applyFlightPlan(map,planPoints)},[planPoints,loaded,baseMap]);

  useEffect(()=>{if(weatherHour>8)setWeatherHour(8)},[weatherHour]);

  return <div className="mapHost" ref={hostRef}>
    {!loaded && !error && <div className="mapLoading"><span />Loading globe and satellite map…<i><b style={{width:'34%'}}/></i></div>}
    {loaded&&overlayProgress&&<div className="overlayProgress" role="status"><div><Layers3/><span>Loading {overlayProgress.label}…</span><b>{Math.round(overlayProgress.done/Math.max(1,overlayProgress.total)*100)}%</b></div><i><b style={{width:`${Math.max(8,overlayProgress.done/Math.max(1,overlayProgress.total)*100)}%`}}/></i></div>}
    {error && <div className="mapError">{error} Try the Streets basemap.</div>}
    <div className="mapHint">Click or tap anywhere · pinch to zoom · zoom out for globe</div>
    {weatherVisible&&location&&!weather&&!weatherError&&<div className="mapWeatherStatus loading"><span/> Loading live weather…</div>}
    {weatherVisible&&weatherError&&<div className="mapWeatherStatus error"><CloudRain/> {weatherError}</div>}
    {weatherVisible&&radarNotice&&<div className="mapWeatherStatus warning"><CloudRain/> {radarNotice}</div>}
    <div className="mapStyleControl" aria-label="Map display controls">
      <button className={baseMap === 'satellite' ? 'active' : ''} onClick={() => setBaseMap('satellite')} aria-label="Satellite map"><Satellite size={16}/><span>Satellite</span></button>
      <button className={baseMap === 'streets' ? 'active' : ''} onClick={() => setBaseMap('streets')} aria-label="Street map"><MapIcon size={16}/><span>Streets</span></button>
      <button className={zonesVisible ? 'active zones' : ''} onClick={() => setZonesVisible(value => !value)} aria-pressed={zonesVisible} aria-label="Toggle verified official drone zones"><Layers3 size={16}/><span>Zones</span></button>
      <button className={weatherVisible?'active weather':''} onClick={()=>setWeatherVisible(value=>!value)} aria-pressed={weatherVisible} aria-label="Toggle weather forecast overlay"><CloudSun size={16}/><span>Weather</span></button>
    </div>
    {weather&&location&&weatherVisible&&<div className="mapWeatherControl liquid"><div className="mapWeatherNow">{(weather.hourly[weatherHour]?.rainProbability??0)>45?<CloudRain/>:<CloudSun/>}<div><small>FORECAST OVERLAY · +{weatherHour}H</small><b>{weather.hourly[weatherHour]?.score??weather.score}/100</b><span><Wind/> {weather.hourly[weatherHour]?.wind??weather.wind} km/h · {weather.hourly[weatherHour]?.rainProbability??weather.rainProbability}% rain</span></div></div><div className="weatherLegend" aria-label="Weather overlay legend"><span className="cloudKey">Cloud</span><span className="rainKey">Rain field</span><span className="windKey">Wind lines</span></div><input type="range" min="0" max="8" step="1" value={weatherHour} onChange={event=>setWeatherHour(Number(event.target.value))} aria-label="Weather forecast hour"/><div className="weatherTicks">{Array.from({length:9},(_,i)=><button className={i===weatherHour?'active':''} onClick={()=>setWeatherHour(i)} key={i}>{i===0?'Now':`+${i}`}</button>)}</div></div>}
  </div>;
});
