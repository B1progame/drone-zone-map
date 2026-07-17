import type { Location, Weather } from './types';
const weatherRequests=new Map<string,Promise<Weather>>();
const weatherCacheKey=(location:Location)=>`aeris-weather:${location.lat.toFixed(2)},${location.lng.toFixed(2)}`;
const readWeatherCache=(location:Location,maxAge:number)=>{
 try{const cached=JSON.parse(localStorage.getItem(weatherCacheKey(location))||'null');return cached&&Date.now()-cached.savedAt<maxAge?cached.weather as Weather:undefined}catch{return undefined}
};
export function parseCoordinates(input:string): Location | null {
 const m = input.trim().match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
 if (!m) return null; const lat=Number(m[1]), lng=Number(m[2]);
 return Math.abs(lat)<=90 && Math.abs(lng)<=180 ? {lat,lng,name:`${lat.toFixed(5)}, ${lng.toFixed(5)}`} : null;
}
export async function getWeather(location:Location):Promise<Weather> {
 const fresh=readWeatherCache(location,20*60*1000);if(fresh)return fresh;
 const key=weatherCacheKey(location),existing=weatherRequests.get(key);if(existing)return existing;
 const pending=(async()=>{
  const fields='temperature_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,visibility,is_day';
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&hourly=${fields}&forecast_hours=48&timezone=auto&wind_speed_unit=kmh`;
  let response:Response|undefined;
  for(let attempt=0;attempt<2;attempt++){response=await fetch(url);if(response.ok)break;if(response.status!==429&&response.status<500)break;await new Promise(resolve=>setTimeout(resolve,1200*(attempt+1)))}
  if(!response?.ok){const stale=readWeatherCache(location,12*60*60*1000);if(stale)return stale;throw new Error('Weather service unavailable')}
  const data=await response.json();
  const scoreFor=(wind:number,gusts:number,rain:number,rainProbability:number,cloud:number,visibility:number,temp:number)=>Math.max(0,Math.min(100,Math.round(100-wind*1.25-gusts*.55-rain*20-rainProbability*.18-Math.max(0,cloud-80)*.12-Math.max(0,3000-visibility)/120-Math.max(0,-temp)*2-Math.max(0,temp-38)*2)));
  const hourly:import('./types').WeatherHour[]=data.hourly.time.map((time:string,i:number)=>{const wind=data.hourly.wind_speed_10m[i]??0,gusts=data.hourly.wind_gusts_10m[i]??0,rain=data.hourly.precipitation[i]??0,rainProbability=data.hourly.precipitation_probability[i]??0,cloud=data.hourly.cloud_cover[i]??0,visibility=data.hourly.visibility[i]??10000,temperature=data.hourly.temperature_2m[i]??0;return{time,temperature:Math.round(temperature),wind:Math.round(wind),gusts:Math.round(gusts),rain,rainProbability,cloud,visibility:Math.round(visibility),score:scoreFor(wind,gusts,rain,rainProbability,cloud,visibility,temperature),isDay:Boolean(data.hourly.is_day[i])}}).slice(0,36);
  if(!hourly.length)throw new Error('Weather service returned no forecast');
  const current=hourly[0],weather:Weather={temperature:current.temperature,wind:current.wind,gusts:current.gusts,rain:current.rain,rainProbability:current.rainProbability,cloud:current.cloud,visibility:current.visibility,score:current.score,hourly,timezone:data.timezone??'Local'};
  try{localStorage.setItem(key,JSON.stringify({savedAt:Date.now(),weather}))}catch{}
  return weather;
 })().finally(()=>weatherRequests.delete(key));
 weatherRequests.set(key,pending);return pending;
}
export async function searchLocation(input:string,language=navigator.language.split('-')[0]||'en'):Promise<Location|null>{
 const coordinates=parseCoordinates(input);if(coordinates)return coordinates;
 const query=input.trim();if(query.length<2)return null;
 const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=${encodeURIComponent(language)}&format=json`);
 if(!response.ok)throw new Error('Location search unavailable');const item=(await response.json()).results?.[0];
 return item?{lat:item.latitude,lng:item.longitude,name:[item.name,item.admin1,item.country].filter(Boolean).join(', ')}:null;
}
export function quality(score:number){ return score>=90?'Great flying weather':score>=70?'Good conditions':score>=50?'Okay, be careful':score>=30?'Bad for small drones':'Do not fly'; }
