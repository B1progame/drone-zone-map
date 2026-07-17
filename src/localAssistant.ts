import type { Location, Weather, ZoneInfo } from './types';

type FlightContext = {
  question: string;
  location?: Location;
  weather?: Weather;
  zoneInfo?: ZoneInfo;
};

const formatHour = (value: string) =>
  new Date(value).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' });

export function answerFlightQuestion({ question, location, weather, zoneInfo }: FlightContext) {
  if (!location) {
    return 'Select a point on the map first. I can then explain its loaded airspace zones, weather risk and best forecast window without an account or API key.';
  }

  const normalized = question.toLowerCase();
  const weatherSummary = weather
    ? `The current weather score is ${weather.score}/100 with ${weather.wind} km/h wind, gusts up to ${weather.gusts} km/h and ${weather.rainProbability}% rain probability.`
    : 'Live weather has not loaded for this point yet.';
  const zoneSummary = !zoneInfo
    ? 'The official airspace source is still loading.'
    : zoneInfo.status === 'loaded'
      ? `${zoneInfo.zones.length} overlapping ${zoneInfo.zones.length === 1 ? 'zone is' : 'zones are'} loaded from ${zoneInfo.sourceName}.`
      : zoneInfo.status === 'none'
        ? `${zoneInfo.sourceName} returned no overlapping zone, but normal rules and temporary restrictions may still apply.`
        : `${zoneInfo.countryName} is currently handled through its official map.`;

  if (/best|time|hour|window|when/.test(normalized) && weather?.hourly.length) {
    const best = weather.hourly
      .slice(0, 24)
      .map(hour => ({ ...hour }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return `The strongest forecast windows in the next 24 hours are ${best.map(hour => `${formatHour(hour.time)} (${hour.score}/100, ${hour.wind} km/h wind, ${hour.rainProbability}% rain)`).join(', ')}. Recheck the forecast and official source immediately before takeoff.`;
  }

  if (/zone|airspace|restriction|overlay|source/.test(normalized)) {
    if (!zoneInfo?.zones.length) return `${zoneSummary} Open the official map before takeoff for the authoritative result.`;
    const visible = zoneInfo.zones.slice(0, 5).map(zone => `${zone.name} (${zone.type})`).join(', ');
    return `${zoneSummary} The loaded matches are: ${visible}. These overlays are context, not legal clearance; use the official map for the final decision.`;
  }

  if (/weather|wind|rain|visibility|risk|gust/.test(normalized)) {
    if (!weather) return 'Live weather is not available yet. Wait for the forecast to finish loading or select the point again.';
    const visibility = Math.round(weather.visibility / 1000);
    const risk = weather.score >= 75 ? 'relatively favorable' : weather.score >= 50 ? 'mixed and worth extra care' : 'unfavorable';
    return `${weatherSummary} Visibility is about ${visibility} km. Based only on these forecast values, conditions look ${risk}; also check local wind, precipitation and your aircraft limits at takeoff time.`;
  }

  if (/can i|fly|allowed|legal|permission|safe/.test(normalized)) {
    return `I cannot grant permission to fly at ${location.name}. ${zoneSummary} ${weatherSummary} Open the official national map and verify local rules, temporary restrictions and landowner requirements before takeoff.`;
  }

  return `For ${location.name}: ${zoneSummary} ${weatherSummary} Ask about visible zones, weather risk or the best time in the next 24 hours for a more focused answer.`;
}
