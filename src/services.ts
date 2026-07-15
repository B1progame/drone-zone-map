import type { Location, Weather } from './types';
export function parseCoordinates(input:string): Location | null {
 const m = input.trim().match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
 if (!m) return null; const lat=Number(m[1]), lng=Number(m[2]);
 return Math.abs(lat)<=90 && Math.abs(lng)<=180 ? {lat,lng,name:`${lat.toFixed(5)}, ${lng.toFixed(5)}`} : null;
}
export async function getWeather(location:Location):Promise<Weather> {
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=temperature_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation&wind_speed_unit=kmh`;
 const r=await fetch(url); if(!r.ok) throw new Error('Weather service unavailable'); const c=(await r.json()).current;
 const wind=c.wind_speed_10m??0,gusts=c.wind_gusts_10m??0,rain=c.precipitation??0,cloud=c.cloud_cover??0;
 const score=Math.max(0,Math.round(100-wind*1.5-gusts*.6-rain*22-Math.max(0,cloud-65)*.18));
 return {temperature:Math.round(c.temperature_2m),wind:Math.round(wind),gusts:Math.round(gusts),rain,cloud,score};
}
export function quality(score:number){ return score>=90?'Great flying weather':score>=70?'Good conditions':score>=50?'Okay, be careful':score>=30?'Bad for small drones':'Do not fly'; }
