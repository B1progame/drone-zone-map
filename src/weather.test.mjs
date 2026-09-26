import assert from 'node:assert/strict';
import { afterEach, test } from 'node:test';

const storage = new Map();
globalThis.localStorage = {
  getItem: key => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, String(value)),
  removeItem: key => storage.delete(key),
  clear: () => storage.clear(),
};

const service = await import('./services.ts');
const originalFetch = globalThis.fetch;
const location = (lat, lng) => ({ lat, lng, name: `${lat}, ${lng}` });
const buildForecast = ({ weatherCode = 1, wind80 = 12, overrides = {} } = {}) => {
  const start = Math.floor(Date.UTC(2026, 0, 1, 23) / 1000);
  const hourly = {
    time: Array.from({ length: 48 }, (_, index) => start + index * 3600),
    temperature_2m: Array(48).fill(14),
    wind_speed_10m: Array(48).fill(8),
    wind_speed_80m: Array(48).fill(wind80),
    wind_gusts_10m: Array(48).fill(15),
    cloud_cover: Array(48).fill(40),
    precipitation: Array(48).fill(0),
    precipitation_probability: Array(48).fill(10),
    visibility: Array(48).fill(10000),
    is_day: Array(48).fill(1),
    weather_code: Array(48).fill(weatherCode),
    ...overrides,
  };
  return { timezone: 'Asia/Tokyo', hourly };
};
const response = (payload, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => payload });

afterEach(() => {
  globalThis.fetch = originalFetch;
  storage.clear();
});

test('requests and returns the fields used to describe drone weather', async () => {
  let requestUrl = '';
  globalThis.fetch = async input => {
    requestUrl = String(input);
    return response(buildForecast());
  };

  const weather = await service.getWeather(location(11.11, 22.22));
  const params = new URL(requestUrl).searchParams;
  assert.match(params.get('hourly'), /weather_code/);
  assert.match(params.get('hourly'), /wind_speed_80m/);
  assert.equal(params.get('timeformat'), 'unixtime');
  assert.equal(params.get('temperature_unit'), 'celsius');
  assert.equal(params.get('precipitation_unit'), 'mm');
  assert.equal(weather.hourly[0].time, Math.floor(Date.UTC(2026, 0, 1, 23) / 1000));
  assert.equal(weather.hourly[0].weatherCode, 1);
  assert.equal(weather.hourly[0].wind80, 12);
});

test('keeps nearby selected points in separate weather cache entries', async () => {
  let calls = 0;
  globalThis.fetch = async () => response(buildForecast({ overrides: { temperature_2m: Array(48).fill(++calls === 1 ? 10 : 25) } }));
  const first = await service.getWeather(location(17.1711, 28.2811));
  const second = await service.getWeather(location(17.1721, 28.2811));
  assert.equal(calls, 2);
  assert.equal(first.temperature, 10);
  assert.equal(second.temperature, 25);
});

test('rejects an incomplete forecast instead of treating missing wind as calm', async () => {
  globalThis.fetch = async () => response(buildForecast({ overrides: { wind_speed_10m: [null] } }));
  await assert.rejects(service.getWeather(location(12.12, 23.23)), /incomplete/i);
});

test('rejects timestamps that do not match the requested Unix time format', async () => {
  globalThis.fetch = async () => response(buildForecast({ overrides: { time: Array(48).fill('2026-01-02T08:00') } }));
  await assert.rejects(service.getWeather(location(16.16, 27.27)), /incomplete/i);
});

test('marks a cached forecast stale when the live request fails', async () => {
  const point = location(13.13, 24.24);
  const key = `aeris-weather:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  const savedAt = Date.now() - 60 * 60 * 1000;
  storage.set(key, JSON.stringify({ savedAt, weather: { hourly: [], timezone: 'Europe/Berlin', score: 90 } }));
  globalThis.fetch = async () => response({}, 404);

  const weather = await service.getWeather(point);
  assert.equal(weather.stale, true);
  assert.equal(weather.retrievedAt, savedAt);
});

test('uses a stale forecast when the weather request itself throws', async () => {
  const point = location(15.15, 26.26);
  const key = `aeris-weather:${point.lat.toFixed(4)},${point.lng.toFixed(4)}`;
  const savedAt = Date.now() - 90 * 60 * 1000;
  storage.set(key, JSON.stringify({ savedAt, weather: { hourly: [], timezone: 'Europe/Berlin', score: 80 } }));
  globalThis.fetch = async () => { throw new Error('network disconnected'); };

  const weather = await service.getWeather(point);
  assert.equal(weather.stale, true);
  assert.equal(weather.retrievedAt, savedAt);
});

test('scores thunderstorms as unsafe even when ordinary metrics look calm', async () => {
  globalThis.fetch = async () => response(buildForecast({ weatherCode: 95, wind80: 5 }));
  const weather = await service.getWeather(location(14.14, 25.25));
  assert.ok(weather.hourly[0].score < 30);
  assert.equal(service.weatherCodeKind(95), 'thunderstorm');
});

test('describes the heuristic result as a forecast assessment, not flight clearance', () => {
  assert.equal(service.quality(98), 'Favorable forecast');
  assert.equal(service.quality(20), 'Adverse weather signal');
});

test('formats forecast instants in the selected location time zone', () => {
  const instant = Math.floor(Date.UTC(2026, 0, 1, 23) / 1000);
  const result = service.formatForecastTime(instant, 'Asia/Tokyo', 'en-GB', {
    weekday: 'long', hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  });
  assert.match(result, /Friday/);
  assert.match(result, /08:00/);
});

test('rejects incomplete map-grid samples instead of painting missing values as clear weather', () => {
  assert.equal(service.isCompleteWeatherGridSample({ precipitationProbability: 0, precipitation: 0, clouds: 0, wind: 0, temperature: 12 }), true);
  assert.equal(service.isCompleteWeatherGridSample({ precipitationProbability: 0, precipitation: 0, clouds: 0, wind: null, temperature: 12 }), false);
});
