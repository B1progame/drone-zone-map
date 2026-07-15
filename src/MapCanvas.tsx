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
const enaireTiles='https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V0/MapServer/export?bbox={bbox-epsg-3857}&bboxSR=3857&imageSR=3857&size=256,256&format=png32&transparent=true&layers=show%3A0%2C2%2C3&f=image';

function mapStyle(baseMap: BaseMap, zonesVisible: boolean): StyleSpecification {
  const satellite = baseMap === 'satellite';
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
      enaire: { type:'raster', tiles:[enaireTiles], tileSize:256, attribution:'<a href="https://aip.enaire.es/AIP/UAS-en.html" target="_blank">UAS zones © ENAIRE / AIS</a>' },
      luxembourg: { type:'geojson', data:`${import.meta.env.BASE_URL}data/zones/LU.geojson`, attribution:'Direction de l’Aviation Civile Luxembourg · CC0' },
      weather: { type:'geojson', data:{type:'FeatureCollection',features:[]} }
    },
    layers: [
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 250 } },
      { id: 'dipul-zones', type: 'raster', source: 'dipul', layout: { visibility: zonesVisible ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.78, 'raster-fade-duration': 150 } },
      { id:'enaire-zones', type:'raster', source:'enaire', layout:{visibility:zonesVisible?'visible':'none'}, paint:{'raster-opacity':.76,'raster-fade-duration':150} },
      { id:'luxembourg-zones', type:'fill', source:'luxembourg', layout:{visibility:zonesVisible?'visible':'none'}, paint:{'fill-color':['match',['get','restriction'],'PROHIBITED','#ff4d57','REQ_AUTHORIZATION','#ff9e43','#ffd75e'],'fill-opacity':.42,'fill-outline-color':'#fff2d0'} },
      { id:'weather-halo', type:'circle', source:'weather', paint:{'circle-radius':['interpolate',['linear'],['zoom'],4,22,10,110,15,210],'circle-color':['get','color'],'circle-opacity':.2,'circle-blur':.65,'circle-stroke-width':2,'circle-stroke-color':['get','color'],'circle-stroke-opacity':.55} }
    ]
  };
}

export function MapCanvas({ location, weather, onPick }: { location?: Location; weather?:Weather; onPick: (location: Location) => void }) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
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
    map.on('load', () => { setLoaded(true); setError(''); map.resize(); });
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
  }, [baseMap, zonesVisible]);

  useEffect(() => {
    const map = mapRef.current;
    if (!location || !map) return;
    map.flyTo({ center: [location.lng, location.lat], zoom: Math.max(map.getZoom(), 11), essential: true });
    markerRef.current?.remove();
    markerRef.current = new maplibregl.Marker({ color: '#b6ff94' })
      .setLngLat([location.lng, location.lat])
      .addTo(map);
  }, [location]);

  useEffect(()=>{const map=mapRef.current,hour=weather?.hourly[weatherHour];if(!map)return;const apply=()=>{const source=map.getSource('weather') as maplibregl.GeoJSONSource|undefined;if(!source)return;const score=hour?.score??weather?.score??0,color=score>=70?'#78f5a4':score>=45?'#ffd463':'#ff6b6b';source.setData({type:'FeatureCollection',features:location&&weatherVisible?[{type:'Feature',properties:{color,score},geometry:{type:'Point',coordinates:[location.lng,location.lat]}}]:[]})};if(map.isStyleLoaded())apply();else map.once('styledata',apply)},[location,weather,weatherHour,weatherVisible,baseMap,zonesVisible]);

  useEffect(()=>{if(weatherHour>8)setWeatherHour(8)},[weatherHour]);

  return <div className="mapHost" ref={hostRef}>
    {!loaded && !error && <div className="mapLoading"><span />Loading satellite map…</div>}
    {error && <div className="mapError">{error} Try the Streets basemap.</div>}
    <div className="mapHint">Click anywhere to check a location</div>
    <div className="mapStyleControl" aria-label="Map display controls">
      <button className={baseMap === 'satellite' ? 'active' : ''} onClick={() => setBaseMap('satellite')} aria-label="Satellite map"><Satellite size={16}/><span>Satellite</span></button>
      <button className={baseMap === 'streets' ? 'active' : ''} onClick={() => setBaseMap('streets')} aria-label="Street map"><MapIcon size={16}/><span>Streets</span></button>
      <button className={zonesVisible ? 'active zones' : ''} onClick={() => setZonesVisible(value => !value)} aria-pressed={zonesVisible} aria-label="Toggle verified official drone zones"><Layers3 size={16}/><span>Zones</span></button>
      <button className={weatherVisible?'active weather':''} onClick={()=>setWeatherVisible(value=>!value)} aria-pressed={weatherVisible} aria-label="Toggle weather forecast overlay"><CloudSun size={16}/><span>Weather</span></button>
    </div>
    {weather&&location&&weatherVisible&&<div className="mapWeatherControl liquid"><div className="mapWeatherNow">{(weather.hourly[weatherHour]?.rainProbability??0)>45?<CloudRain/>:<CloudSun/>}<div><small>FORECAST OVERLAY · +{weatherHour}H</small><b>{weather.hourly[weatherHour]?.score??weather.score}/100</b><span><Wind/> {weather.hourly[weatherHour]?.wind??weather.wind} km/h · {weather.hourly[weatherHour]?.rainProbability??weather.rainProbability}% rain</span></div></div><input type="range" min="0" max="8" step="1" value={weatherHour} onChange={event=>setWeatherHour(Number(event.target.value))} aria-label="Weather forecast hour"/><div className="weatherTicks">{Array.from({length:9},(_,i)=><button className={i===weatherHour?'active':''} onClick={()=>setWeatherHour(i)} key={i}>{i===0?'Now':`+${i}`}</button>)}</div></div>}
  </div>;
}
