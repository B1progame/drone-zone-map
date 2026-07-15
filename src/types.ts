export type Page = 'home' | 'map' | 'weather' | 'ai' | 'saved';
export type Location = { lat: number; lng: number; name: string };
export type Weather = { temperature: number; wind: number; gusts: number; rain: number; cloud: number; score: number };
export type SavedPlace = Location & { id: string; savedAt: string; score?: number };
