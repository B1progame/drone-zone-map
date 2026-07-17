export type Page = 'home' | 'map' | 'weather' | 'ai' | 'saved';
export type RenderDetail = 'efficient' | 'balanced' | 'maximum';
export type AppSettings = {
  renderDetail: RenderDetail;
  glassOpacity: number;
  reducedMotion: boolean;
  language: string;
};
export type Location = { lat: number; lng: number; name: string };
export type WeatherHour = { time:string; temperature:number; wind:number; gusts:number; rain:number; rainProbability:number; cloud:number; visibility:number; score:number; isDay:boolean };
export type Weather = { temperature: number; wind: number; gusts: number; rain: number; rainProbability:number; cloud: number; visibility:number; score: number; hourly:WeatherHour[]; timezone:string };
export type ZoneDetail = { id:string; name:string; type:string; message?:string; lower?:string; upper?:string; legalReference?:string; contact?:string; source:string; updated?:string };
export type ZoneInfo = { countryCode:string; countryName:string; sourceName:string; sourceUrl:string; status:'loaded'|'none'|'unsupported'|'error'; zones:ZoneDetail[]; checkedAt:string; warning:string };
export type SavedPlace = Location & { id: string; savedAt: string; score?: number };
