import type { Location, Weather, ZoneInfo } from './types';

const API_ROOT = 'https://openrouter.ai/api/v1';
export const OPENROUTER_MODEL = 'tencent/hunyuan-a13b-instruct';

type FlightContext = {
  question: string;
  location?: Location;
  weather?: Weather;
  zoneInfo?: ZoneInfo;
};

const apiError = async (response: Response) => {
  let detail = '';
  try {
    const body = await response.json();
    detail = body?.error?.message ?? body?.message ?? '';
  } catch {
    detail = await response.text().catch(() => '');
  }
  if (response.status === 401) return 'The OpenRouter key was rejected.';
  if (response.status === 403) return 'This key is not allowed to use the selected free model.';
  if (response.status === 429) return 'The free OpenRouter limit is busy or exhausted. Try again shortly.';
  return detail || `OpenRouter request failed (${response.status}).`;
};

const headers = (apiKey: string) => ({
  Authorization: `Bearer ${apiKey.trim()}`,
  'Content-Type': 'application/json',
  'HTTP-Referer': window.location.origin,
  'X-Title': 'Aeris Drone Map',
});

export async function validateOpenRouterKey(apiKey: string) {
  if (!apiKey.trim()) throw new Error('Enter an OpenRouter API key first.');
  const response = await fetch(`${API_ROOT}/key`, { headers: headers(apiKey) });
  if (!response.ok) throw new Error(await apiError(response));
  return true;
}

export async function askOpenRouter({ question, location, weather, zoneInfo }: FlightContext, apiKey: string) {
  if (!apiKey.trim()) throw new Error('Enter an OpenRouter API key first.');
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 30_000);
  const context = {
    location: location ? { name: location.name, latitude: location.lat, longitude: location.lng } : null,
    weather: weather
      ? {
          flightScore: weather.score,
          temperatureC: weather.temperature,
          windKmh: weather.wind,
          gustKmh: weather.gusts,
          rainMm: weather.rain,
          rainProbabilityPercent: weather.rainProbability,
          visibilityKm: weather.visibility,
        }
      : null,
    airspace: zoneInfo
      ? {
          country: zoneInfo.countryName,
          source: zoneInfo.sourceName,
          sourceUrl: zoneInfo.sourceUrl,
          status: zoneInfo.status,
          warning: zoneInfo.warning,
          zones: zoneInfo.zones.map(zone => ({
            name: zone.name,
            type: zone.type,
            lower: zone.lower,
            upper: zone.upper,
            message: zone.message,
            legalReference: zone.legalReference,
            contact: zone.contact,
          })),
        }
      : null,
  };
  try {
    const response = await fetch(`${API_ROOT}/chat/completions`, {
      method: 'POST',
      headers: headers(apiKey),
      signal: controller.signal,
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        temperature: 0.2,
        max_tokens: 450,
        messages: [
          {
            role: 'system',
            content:
              `You are Aeris Copilot, a practical drone-flight planning assistant. Answer only from the supplied live context.

Write useful GitHub-style Markdown with this compact structure:
### Quick answer
Give the clearest location-specific conclusion possible without claiming legal clearance.
### What matters
- Explain the weather values that materially affect this flight.
- Explain each relevant airspace object by its actual type and message. A lower limit of 0 m AGL means the object starts at ground level; it does not by itself mean all flight is prohibited.
### Before takeoff
- Give concrete next checks and include exactly one clickable Markdown link using the exact airspace.sourceUrl from the context, labelled with airspace.source.

Do not merely repeat coordinates or list zone names. Interpret why each item matters, distinguish infrastructure/advisory objects from prohibitions or authorization zones, and say when the supplied data is insufficient. Never invent rules, distances, permissions, URLs, or contacts. Never claim that a flight is legally cleared.`,
          },
          { role: 'user', content: `Flight context:\n${JSON.stringify(context)}\n\nQuestion: ${question}` },
        ],
      }),
    });
    if (!response.ok) throw new Error(await apiError(response));
    const body = await response.json();
    const answer = body?.choices?.[0]?.message?.content?.trim();
    if (!answer) throw new Error('OpenRouter returned an empty answer.');
    return { answer, model: body.model ?? OPENROUTER_MODEL };
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw new Error('OpenRouter timed out after 30 seconds.');
    throw error;
  } finally {
    window.clearTimeout(timeout);
  }
}
