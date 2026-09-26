import type { Location, Weather } from './types';
const weatherRequests=new Map<string,Promise<Weather>>();
let weatherRetryAfter=0;
const weatherCacheKey=(location:Location)=>`aeris-weather:${location.lat.toFixed(4)},${location.lng.toFixed(4)}`;
const readWeatherCache=(location:Location,maxAge:number)=>{
 try{const cached=JSON.parse(localStorage.getItem(weatherCacheKey(location))||'null');return cached&&Date.now()-cached.savedAt<maxAge?{weather:cached.weather as Weather,savedAt:Number(cached.savedAt)}:undefined}catch{return undefined}
};
type ForecastFormatOptions=Intl.DateTimeFormatOptions;
export function formatForecastTime(time:number|string,timezone:string,language:string,options:ForecastFormatOptions={hour:'2-digit',minute:'2-digit'}):string{
 if(typeof time==='number'&&Number.isFinite(time))return new Intl.DateTimeFormat(language,{...options,timeZone:timezone}).format(new Date(time*1000));
 const value=String(time);
 // Older offline packs store local wall-clock timestamps without an offset.
 if(/^\d{4}-\d\d-\d\dT\d\d:\d\d/.test(value)&&!/(Z|[+-]\d\d:\d\d)$/.test(value))return new Intl.DateTimeFormat(language,{...options,timeZone:'UTC'}).format(new Date(`${value.slice(0,16)}:00Z`));
 return new Intl.DateTimeFormat(language,{...options,timeZone:timezone}).format(new Date(value));
}
export function weatherCodeKind(code:number|undefined):'clear'|'cloudy'|'fog'|'rain'|'snow'|'thunderstorm'|'unknown'{
 if(code===undefined||!Number.isFinite(code))return'unknown';
 if(code>=95&&code<=99)return'thunderstorm';
 if((code>=71&&code<=77)||(code>=85&&code<=86))return'snow';
 if((code>=51&&code<=67)||(code>=80&&code<=82))return'rain';
 if(code===45||code===48)return'fog';
 if(code===0||code===1)return'clear';
 if(code===2||code===3)return'cloudy';
 return'unknown';
}
export function isCompleteWeatherGridSample(sample:{precipitationProbability:unknown;precipitation:unknown;clouds:unknown;wind:unknown;temperature:unknown}):boolean{
 return [sample.precipitationProbability,sample.precipitation,sample.clouds,sample.wind,sample.temperature].every(value=>typeof value==='number'&&Number.isFinite(value));
}
const severeWeather=(code:number)=>code===56||code===57||code===65||code===66||code===67||code===75||code===82||code===86||(code>=95&&code<=99);
const finiteArray=(hourly:any,key:string,length:number)=>Array.isArray(hourly?.[key])&&hourly[key].length>=length&&hourly[key].slice(0,length).every((value:any)=>typeof value==='number'&&Number.isFinite(value));
const scoreFor=(wind:number,gusts:number,rain:number,rainProbability:number,cloud:number,visibility:number,temp:number,wind80:number|null,weatherCode:number)=>{
 const sustainedWind=Math.max(wind,wind80??wind),base=Math.max(0,Math.min(100,Math.round(100-sustainedWind*1.25-gusts*.55-rain*20-rainProbability*.18-Math.max(0,cloud-80)*.12-Math.max(0,3000-visibility)/120-Math.max(0,-temp)*2-Math.max(0,temp-38)*2)));
 return severeWeather(weatherCode)?Math.min(base,20):base;
};
export function parseCoordinates(input:string): Location | null {
 const m = input.trim().match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[, ]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
 if (!m) return null; const lat=Number(m[1]), lng=Number(m[2]);
 return Math.abs(lat)<=90 && Math.abs(lng)<=180 ? {lat,lng,name:`${lat.toFixed(5)}, ${lng.toFixed(5)}`} : null;
}
export type LocationSuggestion=Location&{primary:string;secondary:string};
export async function searchLocationSuggestions(input:string,language=navigator.language.split('-')[0]||'en',signal?:AbortSignal):Promise<LocationSuggestion[]>{
 const coordinates=parseCoordinates(input);
 if(coordinates)return[{...coordinates,primary:coordinates.name,secondary:'Coordinates'}];
 const query=input.trim();if(query.length<2)return[];
 const response=await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=6&language=${encodeURIComponent(language)}&format=json`,{signal});
 if(!response.ok)throw new Error('Location search unavailable');
 const seen=new Set<string>(),items:LocationSuggestion[]=[];
 for(const item of (await response.json()).results??[]){
  const primary=String(item.name??'').trim(),secondary=[item.admin1,item.country].filter(Boolean).join(', ');
  const key=`${Number(item.latitude).toFixed(5)},${Number(item.longitude).toFixed(5)}`;
  if(!primary||seen.has(key))continue;seen.add(key);
  items.push({lat:item.latitude,lng:item.longitude,name:[primary,secondary].filter(Boolean).join(', '),primary,secondary});
 }
 return items;
}
export async function getWeather(location:Location):Promise<Weather> {
 const fresh=readWeatherCache(location,20*60*1000);if(fresh)return{...fresh.weather,retrievedAt:fresh.weather.retrievedAt??fresh.savedAt,stale:false};
 const key=weatherCacheKey(location),existing=weatherRequests.get(key);if(existing)return existing;
 const pending=(async()=>{
  const fields='temperature_2m,wind_speed_10m,wind_direction_10m,wind_speed_80m,wind_gusts_10m,cloud_cover,precipitation,precipitation_probability,visibility,is_day,weather_code';
  const url=`https://api.open-meteo.com/v1/forecast?latitude=${location.lat}&longitude=${location.lng}&hourly=${fields}&forecast_hours=48&timezone=auto&timeformat=unixtime&temperature_unit=celsius&wind_speed_unit=kmh&precipitation_unit=mm`;
  try{
  if(Date.now()<weatherRetryAfter)throw new Error('The weather provider is temporarily rate-limiting requests.');
  let response:Response|undefined;
  for(let attempt=0;attempt<2;attempt++){
   response=await fetch(url);if(response.ok)break;
   if(response.status===429){const retrySeconds=Number(response.headers.get('Retry-After'));weatherRetryAfter=Date.now()+Math.max(60_000,Number.isFinite(retrySeconds)&&retrySeconds>0?retrySeconds*1000:60_000);break}
   if(response.status<500)break;
   await new Promise(resolve=>setTimeout(resolve,1200*(attempt+1)));
  }
  if(!response?.ok)throw response?.status===429?new Error('The weather provider is temporarily rate-limiting requests.'):new Error('Weather service unavailable');
  const data=await response.json();
  const forecastHours=36,hourlyData=data?.hourly;
  const required=['time','temperature_2m','wind_speed_10m','wind_gusts_10m','cloud_cover','precipitation','precipitation_probability','visibility','is_day','weather_code'];
  if(!Array.isArray(hourlyData?.time)||hourlyData.time.length<forecastHours||!hourlyData.time.slice(0,forecastHours).every((value:any)=>typeof value==='number'&&Number.isFinite(value))||required.slice(1).some(field=>!finiteArray(hourlyData,field,forecastHours))||!data.timezone)throw new Error('Weather service returned an incomplete forecast');
  const rangeValid=(key:string,min:number,max:number)=>hourlyData[key].slice(0,forecastHours).every((value:number)=>value>=min&&value<=max);
  if(!rangeValid('precipitation_probability',0,100)||!rangeValid('cloud_cover',0,100)||!rangeValid('visibility',0,Infinity)||!rangeValid('is_day',0,1)||!hourlyData.weather_code.slice(0,forecastHours).every((code:number)=>Number.isInteger(code)&&code>=0&&code<=99))throw new Error('Weather service returned an incomplete forecast');
  const wind80Field=Array.isArray(hourlyData.wind_speed_80m)?hourlyData.wind_speed_80m:[];
  const retrievedAt=Date.now();
  const hourly:import('./types').WeatherHour[]=hourlyData.time.slice(0,forecastHours).map((time:number,i:number)=>{
   const wind=hourlyData.wind_speed_10m[i],gusts=hourlyData.wind_gusts_10m[i],rain=hourlyData.precipitation[i],rainProbability=hourlyData.precipitation_probability[i],cloud=hourlyData.cloud_cover[i],visibility=hourlyData.visibility[i],temperature=hourlyData.temperature_2m[i],weatherCode=hourlyData.weather_code[i];
   const wind80Value=wind80Field[i],wind80=typeof wind80Value==='number'&&Number.isFinite(wind80Value)?wind80Value:null;
   const windDirection=typeof hourlyData.wind_direction_10m?.[i]==='number'?hourlyData.wind_direction_10m[i]:null;
   return{time,temperature:Math.round(temperature),wind:Math.round(wind),windDirection,wind80,gusts:Math.round(gusts),rain,rainProbability,cloud,visibility:Math.round(visibility),weatherCode,score:scoreFor(wind,gusts,rain,rainProbability,cloud,visibility,temperature,wind80,weatherCode),isDay:hourlyData.is_day[i]===1};
  });
  const current=hourly[0],weather:Weather={temperature:current.temperature,wind:current.wind,gusts:current.gusts,rain:current.rain,rainProbability:current.rainProbability,cloud:current.cloud,visibility:current.visibility,score:current.score,hourly,timezone:data.timezone,retrievedAt,stale:false};
  try{localStorage.setItem(key,JSON.stringify({savedAt:retrievedAt,weather}))}catch{}
  return weather;
  }catch(error){
   const stale=readWeatherCache(location,12*60*60*1000);
   if(stale)return{...stale.weather,retrievedAt:stale.weather.retrievedAt??stale.savedAt,stale:true};
   throw error;
  }
 })().finally(()=>weatherRequests.delete(key));
 weatherRequests.set(key,pending);return pending;
}
export async function searchLocation(input:string,language=navigator.language.split('-')[0]||'en'):Promise<Location|null>{
 return (await searchLocationSuggestions(input,language))[0]??null;
}
export function quality(score:number){ return score>=90?'Favorable forecast':score>=70?'Generally favorable forecast':score>=50?'Mixed forecast':score>=30?'Challenging forecast':'Adverse weather signal'; }
