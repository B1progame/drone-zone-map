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
    return '### Load a location first\nSelect a point on the map so I can explain its airspace objects, weather risk and strongest forecast window.';
  }

  const normalized = question.toLowerCase();
  const weatherSummary = weather
    ? `**Weather:** ${weather.score}/100, ${weather.wind} km/h wind, gusts up to ${weather.gusts} km/h, ${weather.rainProbability}% rain probability and about ${Math.round(weather.visibility / 1000)} km visibility.`
    : 'Live weather has not loaded for this point yet.';
  const zoneSummary = !zoneInfo
    ? 'The official airspace source is still loading.'
    : zoneInfo.status === 'loaded'
      ? `${zoneInfo.zones.length} overlapping ${zoneInfo.zones.length === 1 ? 'zone is' : 'zones are'} loaded from ${zoneInfo.sourceName}.`
      : zoneInfo.status === 'none'
        ? `${zoneInfo.sourceName} returned no overlapping zone, but normal rules and temporary restrictions may still apply.`
        : `${zoneInfo.countryName} is currently handled through its official map.`;
  const officialLink=zoneInfo?`[Open ${zoneInfo.sourceName}](${zoneInfo.sourceUrl})`:'Open the responsible national aviation source.';
  const zoneDetails=zoneInfo?.zones.slice(0,5).map(zone=>{
    const startsAtGround=/^0(?:[.,]0+)?\s*m?\s*AGL/i.test(zone.lower??'');
    const vertical=[zone.lower&&`lower ${zone.lower}`,zone.upper&&`upper ${zone.upper}`].filter(Boolean).join(', ');
    const meaning=startsAtGround?'It starts at ground level; that describes its vertical extent and does not by itself mean every flight is prohibited.':vertical||'No verified vertical limit was supplied.';
    return `- **${zone.name} — ${zone.type}:** ${meaning}${zone.message?` ${zone.message}`:''}`;
  }).join('\n')??'';
  const standardAnswer=(quick:string,extra:string[]=[])=>
    `### Quick answer\n${quick}\n\n### What matters\n- ${weatherSummary}\n- **Airspace:** ${zoneSummary}${zoneDetails?`\n${zoneDetails}`:''}${extra.length?`\n${extra.map(item=>`- ${item}`).join('\n')}`:''}\n\n### Before takeoff\n- ${officialLink}\n- Recheck temporary restrictions, local rules, landowner permission and your aircraft limits immediately before flight.`;

  if (/best|time|hour|window|when/.test(normalized) && weather?.hourly.length) {
    const best = weather.hourly
      .slice(0, 24)
      .map(hour => ({ ...hour }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    return standardAnswer(`The strongest forecast windows are ${best.map(hour => `**${formatHour(hour.time)}** (${hour.score}/100, ${hour.wind} km/h wind, ${hour.rainProbability}% rain)`).join(', ')}.`,['Forecast rankings are weather-only and do not override airspace restrictions.']);
  }

  if (/zone|airspace|restriction|overlay|source/.test(normalized)) {
    return standardAnswer(zoneInfo?.zones.length?'The map found relevant airspace or infrastructure objects at this point. Their type and published conditions matter more than their color or lower altitude.':'No overlapping object was returned, but that is not permission to fly.');
  }

  if (/weather|wind|rain|visibility|risk|gust/.test(normalized)) {
    if (!weather) return standardAnswer('Live weather is not available yet. Wait for the forecast to finish loading or select the point again.');
    const risk = weather.score >= 75 ? 'relatively favorable' : weather.score >= 50 ? 'mixed and worth extra care' : 'unfavorable';
    return standardAnswer(`Based only on the loaded forecast, conditions look **${risk}**. This is not a go/no-go decision.`,['Compare wind and gusts with the limits for your exact aircraft and takeoff site.']);
  }

  if (/can i|fly|allowed|legal|permission|safe/.test(normalized)) {
    return standardAnswer(`I cannot confirm legal permission at **${location.name}** from planning overlays alone. The loaded context can identify what needs checking, not authorize the flight.`);
  }

  return standardAnswer(`For **${location.name}**, review the loaded airspace objects and forecast together. Ask about a specific zone, weather risk or the best time for a more focused answer.`);
}
