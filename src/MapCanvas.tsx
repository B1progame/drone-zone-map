import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker, type StyleSpecification } from 'maplibre-gl';
import { Layers3, Map as MapIcon, Satellite } from 'lucide-react';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location } from './types';

type BaseMap = 'satellite' | 'streets';

const DIPUL_LAYERS = [
  'flugbeschraenkungsgebiete', 'temporaere_betriebseinschraenkungen',
  'kontrollzonen', 'flughaefen', 'flugplaetze', 'militaerische_anlagen',
  'nationalparks', 'naturschutzgebiete', 'vogelschutzgebiete', 'ffh-gebiete',
  'krankenhaeuser', 'polizei', 'justizvollzugsanstalten', 'industrieanlagen',
  'kraftwerke', 'windkraftanlagen', 'modellflugplaetze'
].map(layer => `dipul:${layer}`).join(',');

const dipulTiles = `https://uas-betrieb.de/geoservices/dipul/wms?SERVICE=WMS&VERSION=1.1.1&REQUEST=GetMap&LAYERS=${encodeURIComponent(DIPUL_LAYERS)}&STYLES=&FORMAT=image%2Fpng&TRANSPARENT=true&SRS=EPSG%3A3857&BBOX={bbox-epsg-3857}&WIDTH=256&HEIGHT=256`;

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
      }
    },
    layers: [
      { id: 'basemap', type: 'raster', source: 'basemap', paint: { 'raster-fade-duration': 250 } },
      { id: 'dipul-zones', type: 'raster', source: 'dipul', layout: { visibility: zonesVisible ? 'visible' : 'none' }, paint: { 'raster-opacity': 0.78, 'raster-fade-duration': 150 } }
    ]
  };
}

export function MapCanvas({ location, onPick }: { location?: Location; onPick: (location: Location) => void }) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<Marker | null>(null);
  const onPickRef = useRef(onPick);
  const [baseMap, setBaseMap] = useState<BaseMap>('satellite');
  const [zonesVisible, setZonesVisible] = useState(true);
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

  return <div className="mapHost" ref={hostRef}>
    {!loaded && !error && <div className="mapLoading"><span />Loading satellite map…</div>}
    {error && <div className="mapError">{error} Try the Streets basemap.</div>}
    <div className="mapHint">Click anywhere to check a location</div>
    <div className="mapStyleControl" aria-label="Map display controls">
      <button className={baseMap === 'satellite' ? 'active' : ''} onClick={() => setBaseMap('satellite')} aria-label="Satellite map"><Satellite size={16}/><span>Satellite</span></button>
      <button className={baseMap === 'streets' ? 'active' : ''} onClick={() => setBaseMap('streets')} aria-label="Street map"><MapIcon size={16}/><span>Streets</span></button>
      <button className={zonesVisible ? 'active zones' : ''} onClick={() => setZonesVisible(value => !value)} aria-pressed={zonesVisible} aria-label="Toggle German DIPUL drone zones"><Layers3 size={16}/><span>DIPUL</span></button>
    </div>
  </div>;
}
