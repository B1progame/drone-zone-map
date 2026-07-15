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
