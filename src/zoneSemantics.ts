export type ZoneSemantic = 'altitude' | 'nature';

const NATURE_LAYER_NAMES = new Set([
  'ffh-gebiete',
  'nationalparks',
  'naturschutzgebiete',
  'vogelschutzgebiete',
  'canada-national-parks',
  'trafikstyrelsen-nature',
  'denmark-nature'
]);

const NATURE_PATTERN = /\b(national\s*park|nationalpark|naturpark|nature\s*(?:park|reserve)|natural\s*(?:park|reserve)|protected\s*natural|natura\s*2000|naturschutz|naturreservat|réserve\s*naturelle|parc\s*national|parque\s*(?:natural|nacional)|nationaal\s*park|natuurgebied|vogelschutz|bird\s*(?:reserve|sanctuary)|wildlife\s*(?:reserve|sanctuary)|fauna|flora|biodivers|habitat\s*protection)\b/i;
const NATURE_CODES = new Set([
  'NATURE',
  'NATURAL',
  'NATIONAL_PARK',
  'ENVIRONMENTAL_PROTECTION',
  'WILDLIFE',
  'FAUNA',
  'FLORA',
  'HABITAT'
]);
const LOWER_KEYS = [
  'lower',
  'LOWER',
  'lowerLimit',
  'lower_limit_altitude',
  'altitudeFloor',
  'lowerAltitude',
  'lower_altitude',
  'RESTRICCION_LOWER',
  'LOWER_VAL_AGL'
];
const TEXT_KEYS = [
  'name',
  'NAME',
  'NAMEOFAREA',
  'LOCATION',
  'type',
  'TYPEOFAREA',
  'category',
  'description',
  'message',
  'reason',
  'reasons',
  'otherReasonInfo',
  '_aerisOfflineLayer',
  '_aerisOfflineCategory'
];

function values(value:unknown):string[]{
  if(Array.isArray(value))return value.flatMap(values);
  if(value&&typeof value==='object')return Object.values(value).flatMap(values);
  return value==null?[]:[String(value)];
}

function isNature(properties:Record<string,unknown>){
  const layer=String(properties._aerisOfflineLayer??'').toLowerCase();
  if(NATURE_LAYER_NAMES.has(layer)||properties._aerisOfflineCategory==='nature')return true;
  const candidates=TEXT_KEYS.flatMap(key=>values(properties[key]));
  return candidates.some(value=>NATURE_CODES.has(value.trim().toUpperCase())||NATURE_PATTERN.test(value));
}

function isAltitudeOnly(properties:Record<string,unknown>){
  const value=LOWER_KEYS.map(key=>properties[key]).find(candidate=>candidate!==undefined&&candidate!==null&&String(candidate).trim()!=='');
  if(value===undefined)return false;
  if(typeof value==='number')return Number.isFinite(value)&&value>0;
  const normalized=String(value).trim().toUpperCase().replaceAll('·','').trim();
  if(!normalized||/^(?:SFC|GND|GROUND|SURFACE)(?:\s|$)/.test(normalized))return false;
  const numeric=Number.parseFloat(normalized.replace(',','.'));
  return Number.isFinite(numeric)?numeric>0:true;
}

export function classifyZoneSemantic(properties:Record<string,unknown>={},forced?:ZoneSemantic):ZoneSemantic|undefined{
  if(forced==='nature'||isNature(properties))return 'nature';
  if(forced==='altitude'||isAltitudeOnly(properties))return 'altitude';
  return undefined;
}

export function enrichZoneSemantics<T extends {features?:any[]}>(data:T,forced?:ZoneSemantic):T{
  if(!Array.isArray(data?.features))return data;
  return {
    ...data,
    features:data.features.map(feature=>{
      const properties=feature?.properties??{};
      const semantic=classifyZoneSemantic(properties,forced);
      if(!semantic&&properties._aerisSemantic===undefined)return feature;
      return {...feature,properties:{...properties,_aerisSemantic:semantic??properties._aerisSemantic}};
    })
  };
}

export function isUkDroneRelevant(properties:Record<string,unknown>={}){
  const match=String(properties.lower??'').trim().toUpperCase().match(/^FL\s*(\d+(?:\.\d+)?)/);
  return !match||Number(match[1])<500;
}

export function filterUkDroneRelevant<T extends {features?:any[]}>(data:T):T{
  if(!Array.isArray(data?.features))return data;
  return {...data,features:data.features.filter(feature=>isUkDroneRelevant(feature?.properties??{}))};
}
