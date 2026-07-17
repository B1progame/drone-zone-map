import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker, type FilterSpecification, type StyleSpecification } from 'maplibre-gl';
import { CloudRain, CloudSun, Layers3, Map as MapIcon, Satellite, Wind } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location, Weather } from './types';

type BaseMap = 'satellite' | 'streets';

const DIPUL_LAYERS = [
  'flugbeschraenkungsgebiete', 'temporaere_betriebseinschraenkungen',
  'kontrollzonen', 'flughaefen', 'flugplaetze', 'militaerische_anlagen',
  'nationalparks', 'naturschutzgebiete', 'vogelschutzgebiete', 'ffh-gebiete',
  'krankenhaeuser', 'polizei', 'justizvollzugsanstalten', 'industrieanlagen',
  'kraftwerke', 'windkraftanlagen', 'modellflugplaetze'
].map(layer => `dipul:${layer}`).join(',');

const dipulTiles = `https://uas-betrieb.de/geoservices/dipul/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(DIPUL_LAYERS)}&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=true&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;
const ENAIRE='https://servais.enaire.es/insigniads/rest/services/NSF_SRV/SRV_UAS_ZG_V1/MapServer';
const FAA_UAS='https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/FAA_UAS_FacilityMap_Data_V5/FeatureServer/0';
const franceTiles='https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=TRANSPORTS.DRONES.RESTRICTIONS&STYLE=normal&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}&FORMAT=image/png';
const DENMARK_ZONES='https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/980697acd04d4a9bb1fd34bbefab924a/data';
const DENMARK_NATURE='https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/ff657943724944faaf19807380f5e24a/data';
const SWEDEN_POLYGON_SOURCES = ['mais-TIZ','mais-RSTA','mais-DNGA','mais-CTR','mais-ATZ','dynais-NOTAM','DAIM_TOPO-SUP','DAIM_TOPO-RWY5K','DAIM_TOPO-HKP1K'] as const;
const SWEDEN_SOURCE_IDS=[...SWEDEN_POLYGON_SOURCES,'mais-ARP'] as const;
const ZONE_LAYER_IDS = ['dipul-zones','enaire-infrastructure-fill','enaire-infrastructure-line','enaire-aero-fill','enaire-aero-line','enaire-urban-fill','enaire-urban-line','france-zones','uk-zones','uk-lines','us-facility-fill','us-facility-line','luxembourg-zones','ireland-zones','ireland-lines','denmark-zones','denmark-lines','denmark-nature','denmark-nature-lines',...SWEDEN_POLYGON_SOURCES.flatMap(id=>[`sweden-${id}-fill`,`sweden-${id}-line`]),'sweden-airports'] as const;
const loadedVectorSources=new WeakMap<MapLibreMap,Set<string>>();
const dynamicRequestKeys=new WeakMap<MapLibreMap,Map<string,string>>();
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

type VectorSourceConfig={id:string;url:string;bounds:[number,number,number,number]};
const vectorSources=():VectorSourceConfig[]=>[
 {id:'luxembourg',url:`${import.meta.env.BASE_URL}data/zones/LU.geojson`,bounds:[5.65,49.35,6.65,50.25]},
 {id:'ireland',url:`${import.meta.env.BASE_URL}data/zones/IE.geojson`,bounds:[-11,51.2,-5,55.6]},
 {id:'uk',url:`${import.meta.env.BASE_URL}data/zones/GB.geojson`,bounds:[-9,49,2.5,61]},
 {id:'denmark',url:DENMARK_ZONES,bounds:[7.8,54.4,15.3,58]},
 {id:'denmark-nature',url:DENMARK_NATURE,bounds:[7.8,54.4,15.3,58]},
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
};

const arcGisViewportSources:ArcGisViewportConfig[]=[
 {id:'enaire-infrastructure',endpoint:`${ENAIRE}/0`,bounds:[-19,27,5,45],minZoom:6,pageSize:5000,maxFeatures:15000,outFields:'OBJECTID,identifier,name,type,reasons,variant,provider,lower,upper,uom,updateDateTime'},
 {id:'enaire-aero',endpoint:`${ENAIRE}/2`,bounds:[-19,27,5,45],minZoom:6,pageSize:5000,maxFeatures:15000,outFields:'OBJECTID,identifier,name,type,reasons,variant,provider,lower,upper,uom,updateDateTime'},
 // ENAIRE's urban layer contains province-sized coverage polygons. Its own
 // viewer only makes that detail useful locally, so do not paint it nationwide.
 {id:'enaire-urban',endpoint:`${ENAIRE}/3`,bounds:[-19,27,5,45],minZoom:10,pageSize:5000,maxFeatures:15000,outFields:'OBJECTID,identifier,name,type,reasons,lower,upper,uom,updateDateTime'},
 {id:'us-facility',endpoint:FAA_UAS,bounds:[-179,13,-64,72],minZoom:7,pageSize:1000,maxFeatures:6000,outFields:'OBJECTID,CEILING,UNIT,MAP_EFF,LAST_EDIT,APT1_FAAID,APT1_ICAO,APT1_NAME,APT1_LAANC,AIRSPACE_1,REGION'}
];

async function queryArcGisViewport(map:MapLibreMap,config:ArcGisViewportConfig){
 const bounds=map.getBounds(),features:any[]=[];
 const geometry=[bounds.getWest(),bounds.getSouth(),bounds.getEast(),bounds.getNorth()].join(',');
 const offsetTolerance=map.getZoom()<7?.003:map.getZoom()<10?.0005:.00005;
 for(let offset=0;offset<config.maxFeatures;offset+=config.pageSize){
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
 return {type:'FeatureCollection' as const,features};
}

function loadDynamicCountrySources(map:MapLibreMap){
 const requestKeys=dynamicRequestKeys.get(map)??new Map<string,string>();
 dynamicRequestKeys.set(map,requestKeys);
 for(const config of arcGisViewportSources){
   const source=map.getSource(config.id) as maplibregl.GeoJSONSource|undefined;
   if(!source)continue;
   const visible=map.getZoom()>=config.minZoom&&viewportIntersects(map,config.bounds);
   if(!visible){
     const emptyKey=`${config.id}:empty`;
     if(requestKeys.get(config.id)!==emptyKey){requestKeys.set(config.id,emptyKey);source.setData(emptyGeoJson)}
     continue;
   }
   const b=map.getBounds(),key=[config.id,Math.floor(map.getZoom()*2),b.getWest().toFixed(2),b.getSouth().toFixed(2),b.getEast().toFixed(2),b.getNorth().toFixed(2)].join(':');
   if(requestKeys.get(config.id)===key)continue;
   requestKeys.set(config.id,key);
   void queryArcGisViewport(map,config).then(data=>{
     if(requestKeys.get(config.id)===key)(map.getSource(config.id) as maplibregl.GeoJSONSource|undefined)?.setData(data);
   }).catch(error=>console.warn(error));
 }
}

function loadVisibleVectorSources(map:MapLibreMap){
 const loaded=loadedVectorSources.get(map)??new Set<string>();
 loadedVectorSources.set(map,loaded);
 for(const config of vectorSources()){
   if(loaded.has(config.id)||!viewportIntersects(map,config.bounds))continue;
   const source=map.getSource(config.id) as maplibregl.GeoJSONSource|undefined;
   if(source){source.setData(config.url);loaded.add(config.id)}
 }
}

function weatherData(location?:Location,weather?:Weather,hourIndex=0,visible=true){
 const hour=weather?.hourly[hourIndex];
 if(!location||!weather||!visible)return {type:'FeatureCollection' as const,features:[]};
 const score=hour?.score??weather.score,color=score>=70?'#78f5a4':score>=45?'#ffd463':'#ff6b6b';
 return {type:'FeatureCollection' as const,features:[{type:'Feature' as const,properties:{color,score},geometry:{type:'Point' as const,coordinates:[location.lng,location.lat]}}]};
}

function applyWeather(map:MapLibreMap,location?:Location,weather?:Weather,hourIndex=0,visible=true){
 const source=map.getSource('weather') as maplibregl.GeoJSONSource|undefined;
 source?.setData(weatherData(location,weather,hourIndex,visible));
}

function mapStyle(baseMap: BaseMap, zonesVisible: boolean): StyleSpecification {
  const satellite = baseMap === 'satellite';
  const swedenSources=Object.fromEntries(SWEDEN_SOURCE_IDS.map(id=>[`sweden-${id}`,{type:'geojson' as const,data:emptyGeoJson,attribution:'<a href="https://daim.lfv.se/echarts/dronechart/API/" target="_blank">LFV Dronechart · CC BY-NC-ND 4.0</a>'}]));
  const swedenLayers=SWEDEN_POLYGON_SOURCES.flatMap((id,index)=>{
    const filter=swedenDisplayFilter(id),filterProperty=filter?{filter}:{};
    return[
      {id:`sweden-${id}-fill`,type:'fill' as const,source:`sweden-${id}`,minzoom:index>=5?5.5:5,...filterProperty,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'fill-color':index<5?'#ff8b5b':'#cf6cff','fill-opacity':index<5?.16:.1}},
      {id:`sweden-${id}-line`,type:'line' as const,source:`sweden-${id}`,minzoom:index>=5?5.5:5,...filterProperty,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'line-color':index<5?'#ffb06f':'#e2a1ff','line-width':['interpolate',['linear'],['zoom'],5,.7,12,1.8] as any,'line-opacity':.88}}
    ];
  });
  return {
    version: 8,
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
        tiles: [dipulTiles],
        tileSize: 256,
        bounds:[5.5,47,15.5,55.2],
        attribution: '<a href="https://dipul.bund.de/" target="_blank">Quelle Geodaten: DFS, BKG 2026</a>'
      },
      'enaire-infrastructure':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://aip.enaire.es/AIP/UAS-en.html" target="_blank">UAS zones © ENAIRE / AIS</a>'},
      'enaire-aero':{type:'geojson',data:emptyGeoJson,attribution:'UAS zones © ENAIRE / AIS'},
      'enaire-urban':{type:'geojson',data:emptyGeoJson,attribution:'UAS zones © ENAIRE / AIS'},
      france: {type:'raster',tiles:[franceTiles],tileSize:256,bounds:[-5.5,41,10,51.5],minzoom:6,maxzoom:18,attribution:'<a href="https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme" target="_blank">Restrictions UAS © IGN / Géoportail</a>'},
      uk:{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/" target="_blank">NATS UK AIS · effective 9 Jul 2026</a>'},
      'us-facility':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://www.faa.gov/uas/getting_started/b4ufly" target="_blank">FAA UAS Facility Maps</a>'},
      luxembourg: { type:'geojson', data:emptyGeoJson, attribution:'Direction de l’Aviation Civile Luxembourg · CC0' },
      ireland: { type:'geojson', data:emptyGeoJson, attribution:'<a href="https://www.iaa.ie/general-aviation/drones/uas-geographic-zones" target="_blank">Irish Aviation Authority UAS zones</a>' },
      denmark:{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://www.droneregler.dk/dronezoner/dronezoner-data-vejledninger/data-downloads" target="_blank">Drone zones © Trafikstyrelsen</a>'},
      'denmark-nature':{type:'geojson',data:emptyGeoJson,attribution:'<a href="https://www.droneregler.dk/dronezoner/dronezoner-data-vejledninger/data-downloads" target="_blank">Nature zones © Trafikstyrelsen</a>'},
      ...swedenSources,
      weather: { type:'geojson', data:emptyGeoJson }
    },
    layers: [
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 250 } },
      { id: 'dipul-zones', type: 'raster', source: 'dipul', layout: { visibility: zonesVisible ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.78, 'raster-fade-duration': 150 } },
      {id:'enaire-infrastructure-fill',type:'fill',source:'enaire-infrastructure',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#f2a72f','fill-opacity':['interpolate',['linear'],['zoom'],6,.04,11,.12]}},
      {id:'enaire-infrastructure-line',type:'line',source:'enaire-infrastructure',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#f0a01c','line-width':['interpolate',['linear'],['zoom'],6,.8,12,2.1],'line-opacity':.95}},
      {id:'enaire-aero-fill',type:'fill',source:'enaire-aero',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#ff5461','fill-opacity':['interpolate',['linear'],['zoom'],6,.025,11,.1]}},
      {id:'enaire-aero-line',type:'line',source:'enaire-aero',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#ff4655','line-width':['interpolate',['linear'],['zoom'],6,1.1,12,2.2],'line-opacity':.98}},
      {id:'enaire-urban-fill',type:'fill',source:'enaire-urban',minzoom:10,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#ff98a0','fill-opacity':.12}},
      {id:'enaire-urban-line',type:'line',source:'enaire-urban',minzoom:10,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#ff8390','line-width':1,'line-opacity':.78}},
      {id:'france-zones',type:'raster',source:'france',minzoom:6,layout:{visibility:zonesVisible?'visible':'none'},paint:{'raster-opacity':.82,'raster-fade-duration':100}},
      {id:'uk-zones',type:'fill',source:'uk',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['match',['get','category'],'Danger','#ff9e43','Prohibited','#ff455d','Restricted','#ef4e68','Flight Restriction Zones','#ff455d','#d56fff'],'fill-opacity':.15}},
      {id:'uk-lines',type:'line',source:'uk',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['match',['get','category'],'Danger','#ffb45f','Prohibited','#ff6174','Restricted','#ff7082','Flight Restriction Zones','#ff6174','#e39aff'],'line-width':['interpolate',['linear'],['zoom'],5,.8,12,2.2],'line-opacity':.95}},
      {id:'us-facility-fill',type:'fill',source:'us-facility',minzoom:7,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['step',['to-number',['get','CEILING']], '#ff4056',1,'#ff7c4d',100,'#ffb44e',300,'#ffe069'],'fill-opacity':.2}},
      {id:'us-facility-line',type:'line',source:'us-facility',minzoom:7,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['step',['to-number',['get','CEILING']], '#ff4056',1,'#ff7c4d',100,'#ffb44e',300,'#ffe069'],'line-width':['interpolate',['linear'],['zoom'],7,.45,13,1.5],'line-opacity':.9}},
      { id:'luxembourg-zones', type:'fill', source:'luxembourg', layout:{visibility:zonesVisible?'visible':'none'}, paint:{'fill-color':['match',['get','restriction'],'PROHIBITED','#ff4d57','REQ_AUTHORIZATION','#ff9e43','#ffd75e'],'fill-opacity':.42,'fill-outline-color':'#fff2d0'} },
      { id:'ireland-zones',type:'fill',source:'ireland',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['match',['get','type'],'PROHIBITED','#ff455d','REQ_AUTHORIZATION','#ffb84d','CONDITIONAL','#55dff0','NO_RESTRICTION','#61df91','#9bc4ff'],'fill-opacity':['match',['get','type'],'NO_RESTRICTION',.1,.24]}},
      { id:'ireland-lines',type:'line',source:'ireland',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['match',['get','type'],'PROHIBITED','#ff6a7c','REQ_AUTHORIZATION','#ffd16a','CONDITIONAL','#76e7f3','NO_RESTRICTION','#79eea4','#a7caff'],'line-width':['interpolate',['linear'],['zoom'],5,.7,12,2.2],'line-opacity':.9}},
      {id:'denmark-zones',type:'fill',source:'denmark',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':['match',['to-string',['get','Farve']],'1','#ff455d','4','#4f8cff','5','#ff9d43','#ffd15c'],'fill-opacity':.24}},
      {id:'denmark-lines',type:'line',source:'denmark',minzoom:5,layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':['match',['to-string',['get','Farve']],'1','#ff7182','4','#73a5ff','5','#ffb56f','#ffe08a'],'line-width':['interpolate',['linear'],['zoom'],5,.7,12,2.2],'line-opacity':.92}},
      {id:'denmark-nature',type:'fill',source:'denmark-nature',minzoom:7,filter:['==',['get','Aktiv'],'JA'],layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#50d982','fill-opacity':.13}},
      {id:'denmark-nature-lines',type:'line',source:'denmark-nature',minzoom:7,filter:['==',['get','Aktiv'],'JA'],layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#78efa0','line-width':1.1,'line-opacity':.85}},
      ...swedenLayers,
      {id:'sweden-airports',type:'circle',source:'sweden-mais-ARP',minzoom:8,layout:{visibility:zonesVisible?'visible':'none'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],8,2.5,11,6],'circle-color':'#ffdc69','circle-stroke-color':'#2b2110','circle-stroke-width':1}},
      { id:'weather-field', type:'circle', source:'weather', paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,28,10,150,15,280],'circle-color':['get','color'],'circle-opacity':.18,'circle-blur':.82} },
      { id:'weather-halo', type:'circle', source:'weather', paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,12,10,56,15,105],'circle-color':['get','color'],'circle-opacity':.22,'circle-blur':.45,'circle-stroke-width':2,'circle-stroke-color':['get','color'],'circle-stroke-opacity':.8} },
      { id:'weather-core', type:'circle', source:'weather', paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,3,10,8,15,13],'circle-color':['get','color'],'circle-opacity':.9,'circle-stroke-width':3,'circle-stroke-color':'#ffffff','circle-stroke-opacity':.85} }
    ]
  };
}

export function MapCanvas({ location, weather, weatherError='', onPick }: { location?: Location; weather?:Weather; weatherError?:string; onPick: (location: Location) => void }) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  const weatherStateRef=useRef({location,weather,hour:0,visible:true});
  const initialStyleRef=useRef(true);
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [zonesVisible, setZonesVisible] = useState(true);
  const [weatherVisible,setWeatherVisible]=useState(true);
  const [weatherHour,setWeatherHour]=useState(0);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { onPickRef.current = onPick; }, [onPick]);

  useEffect(() => {
    if (!hostRef.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: hostRef.current,
      style: mapStyle('satellite', true),
      center: [10.2, 51.1],
      zoom: 5.1,
      attributionControl: { compact: true },
      maxZoom: 19
    });
    mapRef.current = map;
    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right');
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left');
    map.on('load', () => { setLoaded(true); setError(''); map.resize();loadVisibleVectorSources(map);loadDynamicCountrySources(map);applyWeather(map,weatherStateRef.current.location,weatherStateRef.current.weather,weatherStateRef.current.hour,weatherStateRef.current.visible); });
    map.on('style.load',()=>{loadedVectorSources.set(map,new Set());dynamicRequestKeys.set(map,new Map());loadVisibleVectorSources(map);loadDynamicCountrySources(map);applyWeather(map,weatherStateRef.current.location,weatherStateRef.current.weather,weatherStateRef.current.hour,weatherStateRef.current.visible)});
    map.on('moveend',()=>{loadVisibleVectorSources(map);loadDynamicCountrySources(map)});
    map.on('click', event => onPickRef.current({
      lat: event.lngLat.lat,
      lng: event.lngLat.lng,
      name: `${event.lngLat.lat.toFixed(5)}, ${event.lngLat.lng.toFixed(5)}`
    }));
    map.on('error', event => {
      if (!map.loaded()) setError(event.error?.message || 'The basemap could not load.');
    });
    const resize = new ResizeObserver(() => map.resize());
    resize.observe(hostRef.current);
    return () => {
      resize.disconnect();
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

  useEffect(()=>{weatherStateRef.current={location,weather,hour:weatherHour,visible:weatherVisible};const map=mapRef.current;if(!map)return;if(map.isStyleLoaded())applyWeather(map,location,weather,weatherHour,weatherVisible)},[location,weather,weatherHour,weatherVisible]);

  useEffect(()=>{if(weatherHour>8)setWeatherHour(8)},[weatherHour]);

  const canadaSelected=!!location&&/\b(canada|kanada)\b/i.test(location.name);

  return <div className="mapHost" ref={hostRef}>
    {!loaded && !error && <div className="mapLoading"><span />Loading satellite map…</div>}
    {error && <div className="mapError">{error} Try the Streets basemap.</div>}
    <div className="mapHint">Click anywhere to check a location</div>
    {canadaSelected&&zonesVisible&&<div className="canadaMapEmbed"><iframe title="Official Canada Drone Site Selection Tool" src="https://nrc.canada.ca/en/drone-tool-2/map.html"/><a href="https://nrc.canada.ca/en/drone-tool-2/" target="_blank" rel="noreferrer">Official NRC / Transport Canada map ↗</a></div>}
    {weatherVisible&&!location&&<div className="mapWeatherStatus"><CloudSun/> Select or search a location to load live weather</div>}
    {weatherVisible&&location&&!weather&&!weatherError&&<div className="mapWeatherStatus loading"><span/> Loading live weather…</div>}
    {weatherVisible&&weatherError&&<div className="mapWeatherStatus error"><CloudRain/> {weatherError}</div>}
    <div className="mapStyleControl" aria-label="Map display controls">
      <button className={baseMap === 'satellite' ? 'active' : ''} onClick={() => setBaseMap('satellite')} aria-label="Satellite map"><Satellite size={16}/><span>Satellite</span></button>
      <button className={baseMap === 'streets' ? 'active' : ''} onClick={() => setBaseMap('streets')} aria-label="Street map"><MapIcon size={16}/><span>Streets</span></button>
      <button className={zonesVisible ? 'active zones' : ''} onClick={() => setZonesVisible(value => !value)} aria-pressed={zonesVisible} aria-label="Toggle verified official drone zones"><Layers3 size={16}/><span>Zones</span></button>
      <button className={weatherVisible?'active weather':''} onClick={()=>setWeatherVisible(value=>!value)} aria-pressed={weatherVisible} aria-label="Toggle weather forecast overlay"><CloudSun size={16}/><span>Weather</span></button>
    </div>
    {weather&&location&&weatherVisible&&<div className="mapWeatherControl liquid"><div className="mapWeatherNow">{(weather.hourly[weatherHour]?.rainProbability??0)>45?<CloudRain/>:<CloudSun/>}<div><small>FORECAST OVERLAY · +{weatherHour}H</small><b>{weather.hourly[weatherHour]?.score??weather.score}/100</b><span><Wind/> {weather.hourly[weatherHour]?.wind??weather.wind} km/h · {weather.hourly[weatherHour]?.rainProbability??weather.rainProbability}% rain</span></div></div><input type="range" min="0" max="8" step="1" value={weatherHour} onChange={event=>setWeatherHour(Number(event.target.value))} aria-label="Weather forecast hour"/><div className="weatherTicks">{Array.from({length:9},(_,i)=><button className={i===weatherHour?'active':''} onClick={()=>setWeatherHour(i)} key={i}>{i===0?'Now':`+${i}`}</button>)}</div></div>}
  </div>;
}
