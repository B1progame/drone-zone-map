import type { Location, Weather, ZoneInfo } from './types';

export type OfflinePack={id:string;name:string;location:Location;savedAt:string;weather?:Weather;zoneInfo?:ZoneInfo;notice:string};
export async function createOfflinePack(location:Location,weather?:Weather,zoneInfo?:ZoneInfo):Promise<OfflinePack>{
 const pack:OfflinePack={id:`${location.lat.toFixed(4)},${location.lng.toFixed(4)}`,name:location.name,location,savedAt:new Date().toISOString(),weather,zoneInfo,notice:'Offline data may be outdated. Temporary restrictions and weather can change. Re-check online before flying.'};
 const packs:OfflinePack[]=JSON.parse(localStorage.getItem('dzm-offline-packs')||'[]');
 localStorage.setItem('dzm-offline-packs',JSON.stringify([pack,...packs.filter(item=>item.id!==pack.id)].slice(0,12)));
 if('caches'in window){const cache=await caches.open('aeris-offline-packs-v1');await Promise.allSettled([`${import.meta.env.BASE_URL}data/sources/countries.json`,`${import.meta.env.BASE_URL}data/zones/LU.geojson`].map(url=>cache.add(url)))}
 return pack;
}
export function getOfflinePacks():OfflinePack[]{return JSON.parse(localStorage.getItem('dzm-offline-packs')||'[]')}
export function downloadGeoJson(pack:OfflinePack){
 const properties={name:pack.name,checkedAt:pack.savedAt,weather:pack.weather?{score:pack.weather.score,windKmh:pack.weather.wind,gustsKmh:pack.weather.gusts,rainProbability:pack.weather.rainProbability}:undefined,officialSource:pack.zoneInfo?.sourceName,officialSourceUrl:pack.zoneInfo?.sourceUrl,warning:pack.notice};
 const features=[{type:'Feature',id:pack.id,geometry:{type:'Point',coordinates:[pack.location.lng,pack.location.lat]},properties},...(pack.zoneInfo?.zones??[]).map(zone=>({type:'Feature',id:zone.id,geometry:{type:'Point',coordinates:[pack.location.lng,pack.location.lat]},properties:{...zone,geometryNotice:'Point-query result only; this feature does not represent the full zone boundary.'}}))];
 const blob=new Blob([JSON.stringify({type:'FeatureCollection',name:`Aeris flight check - ${pack.name}`,features},null,2)],{type:'application/geo+json'}),url=URL.createObjectURL(blob),link=document.createElement('a');
 link.href=url;link.download=`aeris-${pack.name.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'flight-check'}.geojson`;link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
