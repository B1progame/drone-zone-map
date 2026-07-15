import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker, type StyleSpecification } from 'maplibre-gl';
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
const ENAIRE='https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V0/MapServer';
const AVINOR='https://services-eu1.arcgis.com/WCiVfG6duh6vR43N/arcgis/rest/services/Dronerestriksjonsomraader_gdb/FeatureServer/0/query?where=1%3D1&outFields=*&returnGeometry=true&outSR=4326&f=geojson';
const SWEDEN_POLYGON_SOURCES = ['mais-TIZ','mais-RSTA','mais-DNGA','mais-CTR','mais-ATZ','dynais-NOTAM','DAIM_TOPO-SUP','DAIM_TOPO-RWY5K','DAIM_TOPO-HKP1K'] as const;
const ZONE_LAYER_IDS = ['dipul-zones','enaire-zones','enaire-lines','luxembourg-zones','norway-zones','norway-lines',...SWEDEN_POLYGON_SOURCES.flatMap(id=>[`sweden-${id}-fill`,`sweden-${id}-line`]),'sweden-airports'] as const;
const enaireRequests=new WeakMap<MapLibreMap,AbortController>();

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

async function loadSpainViewport(map:MapLibreMap){
 const source=map.getSource('enaire') as maplibregl.GeoJSONSource|undefined;if(!source)return;
 const bounds=map.getBounds(),west=bounds.getWest(),east=bounds.getEast(),south=bounds.getSouth(),north=bounds.getNorth();
 if(map.getZoom()<7||east<-19||west>5||north<27||south>45){source.setData({type:'FeatureCollection',features:[]});return}
 enaireRequests.get(map)?.abort();const controller=new AbortController();enaireRequests.set(map,controller);
 const geometry=[Math.max(-19,west),Math.max(27,south),Math.min(5,east),Math.min(45,north)].join(',');
 try{const collections=await Promise.all([0,2,3].map(async layer=>{const params=new URLSearchParams({where:'1=1',geometry,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'identifier,type,name,reasons,lower,upper,uom,updateDateTime',returnGeometry:'true',outSR:'4326',geometryPrecision:'5',resultRecordCount:'2000',f:'geojson'});const response=await fetch(`${ENAIRE}/${layer}/query?${params}`,{signal:controller.signal});if(!response.ok)throw new Error(`ENAIRE layer ${layer} failed`);const data=await response.json();return(data.features??[]).map((feature:any)=>({...feature,properties:{...feature.properties,enaireLayer:layer}}))}));if(!controller.signal.aborted)source.setData({type:'FeatureCollection',features:collections.flat()})}catch(error){if((error as Error).name!=='AbortError')console.warn('ENAIRE viewport query unavailable',error)}
}

function mapStyle(baseMap: BaseMap, zonesVisible: boolean): StyleSpecification {
  const satellite = baseMap === 'satellite';
  const swedenSources=Object.fromEntries([
    ...SWEDEN_POLYGON_SOURCES.map(id=>[`sweden-${id}`,{type:'geojson' as const,data:`${import.meta.env.BASE_URL}data/zones/sweden/${id}.geojson`,attribution:'<a href="https://daim.lfv.se/echarts/dronechart/API/" target="_blank">LFV Dronechart · CC BY-NC-ND 4.0</a>'}]),
    ['sweden-mais-ARP',{type:'geojson' as const,data:`${import.meta.env.BASE_URL}data/zones/sweden/mais-ARP.geojson`,attribution:'<a href="https://daim.lfv.se/echarts/dronechart/API/" target="_blank">LFV Dronechart · CC BY-NC-ND 4.0</a>'}]
  ]);
  const swedenLayers=SWEDEN_POLYGON_SOURCES.flatMap((id,index)=>[
    {id:`sweden-${id}-fill`,type:'fill' as const,source:`sweden-${id}`,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'fill-color':index<5?'#ff8b5b':'#cf6cff','fill-opacity':index<5?.18:.12}},
    {id:`sweden-${id}-line`,type:'line' as const,source:`sweden-${id}`,layout:{visibility:zonesVisible?'visible' as const:'none' as const},paint:{'line-color':index<5?'#ffb06f':'#e2a1ff','line-width':['interpolate',['linear'],['zoom'],5,.7,12,1.8] as any,'line-opacity':.9}}
  ]);
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
        attribution: '<a href="https://dipul.bund.de/" target="_blank">Quelle Geodaten: DFS, BKG 2026</a>'
      },
      enaire: { type:'geojson', data:{type:'FeatureCollection',features:[]}, attribution:'<a href="https://aip.enaire.es/AIP/UAS-en.html" target="_blank">UAS zones © ENAIRE / AIS</a>' },
      luxembourg: { type:'geojson', data:`${import.meta.env.BASE_URL}data/zones/LU.geojson`, attribution:'Direction de l’Aviation Civile Luxembourg · CC0' },
      norway: { type:'geojson', data:AVINOR, attribution:'<a href="https://www.avinor.no/en/practical-info/drone/dronekart/" target="_blank">Avinor drone restrictions</a>' },
      ...swedenSources,
      weather: { type:'geojson', data:{type:'FeatureCollection',features:[]} }
    },
    layers: [
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 250 } },
      { id: 'dipul-zones', type: 'raster', source: 'dipul', layout: { visibility: zonesVisible ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.78, 'raster-fade-duration': 150 } },
      { id:'enaire-zones', type:'fill', source:'enaire', minzoom:7, layout:{visibility:zonesVisible?'visible':'none'}, paint:{'fill-color':['match',['get','type'],'PROHIBITED','#ff455d','REQ_AUTHORIZATION','#ffb84d','CONDITIONAL','#55dff0','#8bbcff'],'fill-opacity':['match',['get','type'],'PROHIBITED',.34,'REQ_AUTHORIZATION',.28,'CONDITIONAL',.12,.16]} },
      { id:'enaire-lines', type:'line', source:'enaire', minzoom:7, layout:{visibility:zonesVisible?'visible':'none'}, paint:{'line-color':['match',['get','type'],'PROHIBITED','#ff455d','REQ_AUTHORIZATION','#ffd15c','CONDITIONAL','#66e7f5','#9bc4ff'],'line-width':['interpolate',['linear'],['zoom'],7,.7,12,1.8,16,3],'line-opacity':.9} },
      { id:'luxembourg-zones', type:'fill', source:'luxembourg', layout:{visibility:zonesVisible?'visible':'none'}, paint:{'fill-color':['match',['get','restriction'],'PROHIBITED','#ff4d57','REQ_AUTHORIZATION','#ff9e43','#ffd75e'],'fill-opacity':.42,'fill-outline-color':'#fff2d0'} },
      { id:'norway-zones',type:'fill',source:'norway',layout:{visibility:zonesVisible?'visible':'none'},paint:{'fill-color':'#ff596e','fill-opacity':.24}},
      { id:'norway-lines',type:'line',source:'norway',layout:{visibility:zonesVisible?'visible':'none'},paint:{'line-color':'#ff8090','line-width':['interpolate',['linear'],['zoom'],4,.8,12,2.2],'line-opacity':.92}},
      ...swedenLayers,
      {id:'sweden-airports',type:'circle',source:'sweden-mais-ARP',layout:{visibility:zonesVisible?'visible':'none'},paint:{'circle-radius':['interpolate',['linear'],['zoom'],5,2,11,6],'circle-color':'#ffdc69','circle-stroke-color':'#2b2110','circle-stroke-width':1}},
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
    map.on('load', () => { setLoaded(true); setError(''); map.resize();loadSpainViewport(map);applyWeather(map,weatherStateRef.current.location,weatherStateRef.current.weather,weatherStateRef.current.hour,weatherStateRef.current.visible); });
    map.on('style.load',()=>{loadSpainViewport(map);applyWeather(map,weatherStateRef.current.location,weatherStateRef.current.weather,weatherStateRef.current.hour,weatherStateRef.current.visible)});
    map.on('moveend',()=>loadSpainViewport(map));
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

  return <div className="mapHost" ref={hostRef}>
    {!loaded && !error && <div className="mapLoading"><span />Loading satellite map…</div>}
    {error && <div className="mapError">{error} Try the Streets basemap.</div>}
    <div className="mapHint">Click anywhere to check a location</div>
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
