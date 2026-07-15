export type Page = 'home' | 'map' | 'weather' | 'ai' | 'saved';
export type Location = { lat: number; lng: number; name: string };
export type WeatherHour = { time:string; temperature:number; wind:number; gusts:number; rain:number; rainProbability:number; cloud:number; visibility:number; score:number; isDay:boolean };
export type Weather = { temperature: number; wind: number; gusts: number; rain: number; rainProbability:number; cloud: number; visibility:number; score: number; hourly:WeatherHour[]; timezone:string };
export type SavedPlace = Location & { id: string; savedAt: string; score?: number };
