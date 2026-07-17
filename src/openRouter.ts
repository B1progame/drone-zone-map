import type { Location, Weather, ZoneInfo } from './types';

export async function askOpenRouter({apiKey,question,location,weather,zoneInfo}:{apiKey:string;question:string;location?:Location;weather?:Weather;zoneInfo?:ZoneInfo}){
  if(!apiKey.trim())throw new Error('Connect an OpenRouter API key first.');
  const context={
    location:location?{name:location.name,latitude:location.lat,longitude:location.lng}:null,
    weather:weather?{score:weather.score,temperatureC:weather.temperature,windKmh:weather.wind,gustsKmh:weather.gusts,rainProbability:weather.rainProbability,visibilityM:weather.visibility}:null,
    airspace:zoneInfo?{country:zoneInfo.countryName,source:zoneInfo.sourceName,status:zoneInfo.status,zones:zoneInfo.zones.slice(0,12).map(zone=>({name:zone.name,type:zone.type,lower:zone.lower,upper:zone.upper,message:zone.message}))}:null
  };
  const response=await fetch('https://openrouter.ai/api/v1/chat/completions',{
    method:'POST',
    headers:{Authorization:`Bearer ${apiKey.trim()}`,'Content-Type':'application/json','HTTP-Referer':window.location.origin,'X-OpenRouter-Title':'Aeris Drone Airspace'},
    body:JSON.stringify({
      model:'openrouter/free',
      messages:[
        {role:'system',content:'You are Aeris, a cautious drone-flight planning assistant. Use only the supplied context. Never claim legal clearance or permission. Clearly identify missing data and always tell the pilot to verify the official aviation source.'},
        {role:'user',content:`Flight context:\\n${JSON.stringify(context)}\\n\\nPilot question: ${question}`}
      ],
      temperature:.2,
      max_tokens:650
    })
  });
  const payload=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(payload?.error?.message||`OpenRouter request failed (${response.status}).`);
  const answer=payload?.choices?.[0]?.message?.content;
  if(typeof answer!=='string'||!answer.trim())throw new Error('OpenRouter returned no answer.');
  return answer.trim();
}
