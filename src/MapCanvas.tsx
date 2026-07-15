import { useEffect, useRef, useState } from 'react';
import maplibregl, { Map as MapLibreMap, Marker } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Location } from './types';
export function MapCanvas({location,onPick}:{location?:Location;onPick:(l:Location)=>void}){
 const mapRef=useRef<MapLibreMap | null>(null);const host=useRef<HTMLDivElement>(null); const marker=useRef<Marker | null>(null);const [error,setError]=useState('');
 useEffect(()=>{if(!host.current||mapRef.current)return; const map=mapRef.current=new maplibregl.Map({container:host.current,style:'https://demotiles.maplibre.org/style.json',center:[10.2,51.1],zoom:4.3}); map.addControl(new maplibregl.NavigationControl({showCompass:false}),'top-right'); map.on('click',e=>onPick({lat:e.lngLat.lat,lng:e.lngLat.lng,name:`${e.lngLat.lat.toFixed(5)}, ${e.lngLat.lng.toFixed(5)}`})); map.on('error',()=>setError('Base map could not load. Check your connection and retry.')); return()=>map.remove()},[onPick]);
 useEffect(()=>{if(!location||!mapRef.current)return; mapRef.current.flyTo({center:[location.lng,location.lat],zoom:11,essential:true});marker.current?.remove(); marker.current=new maplibregl.Marker({color:'#a7ff87'}).setLngLat([location.lng,location.lat]).addTo(mapRef.current)},[location]);
 return <div className="mapHost" ref={host}>{error&&<div className="mapError">{error}</div>}<div className="mapHint">Click anywhere to check a location</div></div>
}
