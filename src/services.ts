import type { Location, Weather } from './types';
export function parseCoordinates(input:string): Location | null {
 const m = input.trim().match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
 if (!m) return null; const lat=Number(m[1]), lng=Number(m[2]);
 return Math.abs(lat)<=90 && Math.abs(lng)<=180 ? {lat,lng,name:`${lat.toFixed(5)}, ${lng.toFixed(5)}`} : null;
}
export async function getWeather(location:Location):Promise<Weather> {
 const fields='temperature_2m,wind_speed_10m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,visibility,is_day';
 const url=`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&current=${fields}&hourly=${fields}&forecast_hours=48&timezone=auto&wind_speed_unit=kmh`;
 let r:Response|undefined;
 for(let attempt=0;attempt<3;attempt++){r=await fetch(url);if(r.ok)break;if(r.status!==429&&r.status<500)break;await new Promise(resolve=>setTimeout(resolve,700*(attempt+1)))}
 if(!r?.ok) throw new Error('Weather service unavailable'); const data=await r.json(); const c=data.current;
 const scoreFor=(wind:number,gusts:number,rain:number,rainProbability:number,cloud:number,visibility:number,temp:number)=>Math.max(0,Math.min(100,Math.round(100-wind*1.25-gusts*.55-rain*20-rainProbability*.18-Math.max(0,cloud-80)*.12-Math.max(0,3000-visibility)/120-Math.max(0,-temp)*2-Math.max(0,temp-38)*2)));
 const hourly:import('./types').WeatherHour[]=data.hourly.time.map((time:string,i:number)=>{const wind=data.hourly.wind_speed_10m[i]??0,gusts=data.hourly.wind_gusts_10m[i]??0,rain=data.hourly.precipitation[i]??0,rainProbability=data.hourly.precipitation_probability[i]??0,cloud=data.hourly.cloud_cover[i]??0,visibility=data.hourly.visibility[i]??10000,temperature=data.hourly.temperature_2m[i]??0;return{time,temperature:Math.round(temperature),wind:Math.round(wind),gusts:Math.round(gusts),rain,rainProbability,cloud,visibility:Math.round(visibility),score:scoreFor(wind,gusts,rain,rainProbability,cloud,visibility,temperature),isDay:Boolean(data.hourly.is_day[i])}}).slice(0,36);
 const wind=c.wind_speed_10m??0,gusts=c.wind_gusts_10m??0,rain=c.precipitation??0,rainProbability=c.precipitation_probability??0,cloud=c.cloud_cover??0,visibility=c.visibility??10000,temperature=c.temperature_2m??0;
 return {temperature:Math.round(temperature),wind:Math.round(wind),gusts:Math.round(gusts),rain,rainProbability,cloud,visibility:Math.round(visibility),score:scoreFor(wind,gusts,rain,rainProbability,cloud,visibility,temperature),hourly,timezone:data.timezone??'Local'};
}
export async function searchLocation(input:string):Promise<Location|null>{
 const coordinates=parseCoordinates(input);if(coordinates)return coordinates;
 const query=input.trim();if(query.length<2)return null;
 const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=1&language=${encodeURIComponent(navigator.language.split('-')[0]||'en')}&format=json`);
 if(!response.ok)throw new Error('Location search unavailable');const item=(await response.json()).results?.[0];
 return item?{lat:item.latitude,lng:item.longitude,name:[item.name,item.admin1,item.country].filter(Boolean).join(', ')}:null;
}
export function quality(score:number){ return score>=90?'Great flying weather':score>=70?'Good conditions':score>=50?'Okay, be careful':score>=30?'Bad for small drones':'Do not fly'; }
