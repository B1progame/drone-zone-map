import type { Location, ZoneDetail, ZoneInfo } from './types';

const DIPUL_LAYERS=['flugbeschraenkungsgebiete','temporaere_betriebseinschraenkungen','kontrollzonen','flughaefen','flugplaetze','militaerische_anlagen','nationalparks','naturschutzgebiete','vogelschutzgebiete','ffh-gebiete','krankenhaeuser','polizei','justizvollzugsanstalten','industrieanlagen','kraftwerke','windkraftanlagen','modellflugplaetze'];
const language=()=>navigator.language.toLowerCase().split('-')[0];
const COUNTRY_SOURCES={
 GB:{name:'United Kingdom',source:'NATS UK AIS',url:'https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/',warning:'Official permanent NATS UAS restrictions render from the current AIRAC visualization dataset. Check the UK AIP and current NOTAMs before flight.'},
 FR:{name:'France',source:'IGN / Géoportail',url:'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme',warning:'The official IGN restrictions render on the map, but this WMTS layer does not provide a verified point-query result in Aeris.'},
 SE:{name:'Sweden',source:'LFV Dronechart',url:'https://dronechart.lfv.se/',warning:'Official LFV vectors render on the map with the published ground-level filters. Check LFV and current NOTAMs before flight.'},
 DK:{name:'Denmark',source:'Trafikstyrelsen Dronezoner',url:'https://www.droneregler.dk/dronezoner',warning:'Official static drone-zone data is loaded from Trafikstyrelsen. Check Dronezoner for temporary changes before flight.'},
 NO:{name:'Norway',source:'Avinor drone map',url:'https://www.avinor.no/en/practical-info/drone/dronekart/',warning:'Avinor prohibits presenting its service data in another application, so Aeris links to the official map instead of copying its zones.'},
 IT:{name:'Italy',source:'D-Flight / ENAC',url:'https://www.d-flight.it/web-app/',warning:'Italy provides its ED-269 zone download only to authenticated D-Flight operator subscriptions. Use the official D-Flight map.'},
 US:{name:'United States',source:'FAA UAS Facility Maps',url:'https://www.faa.gov/uas/getting_started/b4ufly',warning:'FAA UAS Facility Map grids render live and show pre-coordinated authorization altitudes, not permission or every restriction. Check B4UFLY and current TFRs.'},
 CA:{name:'Canada',source:'NRC / Transport Canada',url:'https://www.nrc.canada.ca/en/drone-tool-2/',warning:'The official NRC Drone Site Selection Tool is embedded on the map. Its underlying NAV CANADA database cannot be redistributed or queried by Aeris.'}
} as const;
type CountryCode=keyof typeof COUNTRY_SOURCES|'DE'|'ES'|'LU'|'IE'|'XX';
function countryAt(p:Location):CountryCode{
 const named=p.name.toLowerCase();
 const namedCountry:[CountryCode,string[]][]=[
  ['LU',['luxembourg']],['IE',['ireland','éire','irland']],['ES',['spain','españa','spanien']],['DK',['denmark','danmark','dänemark']],
  ['GB',['united kingdom','great britain','england','scotland','wales','northern ireland','vereinigtes königreich','großbritannien']],
  ['US',['united states','usa','vereinigte staaten']],
  ['DE',['germany','deutschland']],['FR',['france','frankreich']],['IT',['italy','italia','italien']],['SE',['sweden','sverige','schweden']],
  ['NO',['norway','norge','norwegen']],['CA',['canada','kanada']]
 ];
 for(const [code,names] of namedCountry)if(names.some(name=>named.includes(name)))return code;
 if(p.lat>=49.35&&p.lat<=50.25&&p.lng>=5.65&&p.lng<=6.65)return'LU';
 if(p.lat>=51.2&&p.lat<=55.6&&p.lng>=-11&&p.lng<=-5)return'IE';
 if(p.lat>=49&&p.lat<=61&&p.lng>=-9&&p.lng<=2.5)return'GB';
 if(p.lat>=27&&p.lat<=44.5&&p.lng>=-18.5&&p.lng<=5)return'ES';
 if(p.lat>=54.4&&p.lat<=58&&p.lng>=7.8&&p.lng<=15.3)return'DK';
 if(p.lat>=47&&p.lat<=55.2&&p.lng>=5.5&&p.lng<=15.5)return'DE';
 if(p.lat>=41&&p.lat<=51.5&&p.lng>=-5.5&&p.lng<=10)return'FR';
 if(p.lat>=35.3&&p.lat<=47.2&&p.lng>=6.5&&p.lng<=18.8)return'IT';
 if(p.lat>=57.5&&p.lat<=71.5&&p.lng>=4&&p.lng<=31.5){
  const border=p.lat<60.5?11.3:p.lat<63?12.5:p.lat<66?15:p.lat<68?18:p.lat<69?23:31.5;
  if(p.lng<border)return'NO';
 }
 if(p.lat>=55&&p.lat<=69.2&&p.lng>=10.4&&p.lng<=24.5)return'SE';
 if(p.lat>=49&&p.lat<=83.5&&p.lng>=-141&&p.lng<=-52)return'CA';
 if(p.lat>=24&&p.lat<=49.5&&p.lng>=-125&&p.lng<=-66)return'US';
 return'XX';
}
const labels:Record<string,Record<string,string>>={
 en:{FLUGBESCHRAENKUNGSGEBIET:'Flight restriction area',KONTROLLZONE:'Control zone',PROHIBITED:'Prohibited zone',REQ_AUTHORIZATION:'Authorization required',CONDITIONAL:'Conditional zone',COMMON:'Geographical zone'},
 de:{FLUGBESCHRAENKUNGSGEBIET:'Flugbeschränkungsgebiet',KONTROLLZONE:'Kontrollzone',PROHIBITED:'Verbotszone',REQ_AUTHORIZATION:'Genehmigung erforderlich',CONDITIONAL:'Bedingte Zone',COMMON:'Geografisches Gebiet'},
 es:{FLUGBESCHRAENKUNGSGEBIET:'Zona de restricción de vuelo',KONTROLLZONE:'Zona de control',PROHIBITED:'Zona prohibida',REQ_AUTHORIZATION:'Autorización requerida',CONDITIONAL:'Zona condicional',COMMON:'Zona geográfica'},
 fr:{FLUGBESCHRAENKUNGSGEBIET:'Zone de restriction de vol',KONTROLLZONE:'Zone de contrôle',PROHIBITED:'Zone interdite',REQ_AUTHORIZATION:'Autorisation requise',CONDITIONAL:'Zone conditionnelle',COMMON:'Zone géographique'}
};
const translate=(value:string)=>labels[language()]?.[value]??labels.en[value]??value.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
const cleanHtml=(value='')=>{const doc=new DOMParser().parseFromString(value,'text/html');return (doc.body.textContent??'').replace(/\s+/g,' ').trim()};
const base=(code:string,name:string,sourceName:string,sourceUrl:string):ZoneInfo=>({countryCode:code,countryName:name,sourceName,sourceUrl,status:'none',zones:[],checkedAt:new Date().toISOString(),warning:'This is planning information, not legal clearance. Check the official source before takeoff.'});
const geoJsonCache=new Map<string,Promise<any>>();
const fetchGeoJson=(url:string)=>{let pending=geoJsonCache.get(url);if(!pending){pending=fetch(url).then(response=>{if(!response.ok)throw new Error(`Zone file unavailable: ${response.status}`);return response.json()});geoJsonCache.set(url,pending)}return pending};

async function dipul(point:Location):Promise<ZoneInfo>{const result=base('DE',language()==='de'?'Deutschland':'Germany','DIPUL','https://dipul.bund.de/');const d=.035,bbox=`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d}`,layers=DIPUL_LAYERS.map(x=>`dipul:${x}`).join(',');const params=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',LAYERS:layers,QUERY_LAYERS:layers,STYLES:'',SRS:'EPSG:4326',BBOX:bbox,WIDTH:'256',HEIGHT:'256',X:'128',Y:'128',INFO_FORMAT:'text/plain',FEATURE_COUNT:'50'});const response=await fetch(`https://uas-betrieb.de/geoservices/dipul/wms?${params}`);if(!response.ok)throw new Error('DIPUL query failed');const text=await response.text(),blocks=text.split(/Results for FeatureType/).slice(1);result.zones=blocks.map((block,index)=>{const attrs=Object.fromEntries(block.split('\n').map(line=>line.match(/^([^=]+) = (.*)$/)).filter(Boolean).map(match=>[match![1].trim(),match![2].trim()]));const layer=(block.match(/'[^:]+:([^']+)'/)?.[1]??'zone');return{id:`DE-${index}-${attrs.external_reference??layer}`,name:attrs[`generated_name_${language().toUpperCase()}`]??attrs.generated_name_EN??attrs.name??translate(layer.toUpperCase()),type:translate(attrs.type_code??layer.toUpperCase()),lower:attrs.lower_limit_altitude?`${attrs.lower_limit_altitude} ${attrs.lower_limit_unit??''} ${attrs.lower_limit_alt_ref??''}`:undefined,upper:attrs.upper_limit_altitude?`${attrs.upper_limit_altitude} ${attrs.upper_limit_unit??''} ${attrs.upper_limit_alt_ref??''}`:undefined,legalReference:attrs.legal_ref,source:'DIPUL'} as ZoneDetail});result.status=result.zones.length?'loaded':'none';return result}

async function enaire(point:Location):Promise<ZoneInfo>{const result=base('ES',language()==='es'?'España':'Spain','ENAIRE servAIS','https://aip.enaire.es/AIP/UAS-en.html'),d=.12;const params=new URLSearchParams({geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',sr:'4326',tolerance:'3',mapExtent:`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d}`,imageDisplay:'800,600,96',layers:'all:0,1,2,3',returnGeometry:'false',f:'json'});const response=await fetch(`https://servais.enaire.es/insigniads/rest/services/NSF_SRV/SRV_UAS_ZG_V1/MapServer/identify?${params}`);if(!response.ok)throw new Error('ENAIRE query failed');const data=await response.json();result.zones=(data.results??[]).map((item:any,index:number)=>{const a=item.attributes??{};return{id:`ES-${item.layerId}-${a.OBJECTID??index}`,name:a.name&&a.name!=='Nulo'?a.name:item.value||item.layerName,type:translate(a.type||a.restriction||'COMMON'),message:cleanHtml(a.message||a.description).slice(0,700),lower:a.lower?`${a.lower} ${a.uom??''} ${a.lowerReference??''}`:undefined,upper:a.upper?`${a.upper} ${a.uom??''} ${a.upperReference??''}`:undefined,contact:[a.email,a.phone].filter((x:string)=>x&&x!=='Nulo').join(' · ')||undefined,source:'ENAIRE',updated:a.updateDateTime||undefined}});result.status=result.zones.length?'loaded':'none';return result}

const insideRing=(point:Location,ring:number[][])=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>point.lat)!==(yj>point.lat))&&(point.lng<(xj-xi)*(point.lat-yi)/(yj-yi)+xi))inside=!inside}return inside};
const insidePolygon=(point:Location,polygon:number[][][])=>insideRing(point,polygon[0])&&!polygon.slice(1).some(ring=>insideRing(point,ring));
const contains=(point:Location,geometry:any)=>geometry.type==='Polygon'?insidePolygon(point,geometry.coordinates):geometry.type==='MultiPolygon'?geometry.coordinates.some((polygon:number[][][])=>insidePolygon(point,polygon)):false;
async function luxembourg(point:Location):Promise<ZoneInfo>{const result=base('LU','Luxembourg','DAC Luxembourg','https://g-o.lu/uas');const response=await fetch(`${import.meta.env.BASE_URL}data/zones/LU.geojson`);if(!response.ok)throw new Error('Offline Luxembourg pack missing');const data=await response.json();result.zones=data.features.filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties;return{id:p.id??`LU-${index}`,name:p.name??'Luxembourg UAS zone',type:translate(p.restriction??p.type??'COMMON'),message:(p.reasons??[]).join(', '),lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.unit??'M'} ${p.lowerReference??''}`:undefined,upper:p.upperLimit!=null?`${p.upperLimit} ${p.unit??'M'} ${p.upperReference??''}`:undefined,contact:p.authority,source:'DAC Luxembourg',updated:p.updated}});result.status=result.zones.length?'loaded':'none';return result}
async function ireland(point:Location):Promise<ZoneInfo>{const result=base('IE','Ireland','Irish Aviation Authority','https://www.iaa.ie/general-aviation/drones/uas-geographic-zones');const response=await fetch(`${import.meta.env.BASE_URL}data/zones/IE.geojson`);if(!response.ok)throw new Error('Ireland zone file missing');const data=await response.json();result.zones=data.features.filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties,authority=(p.zoneAuthority??[])[0]??{};return{id:p.identifier??`IE-${index}`,name:p.name??'Ireland UAS geographical zone',type:translate(p.type??'COMMON'),message:[p.restrictionConditions,p.message].filter(Boolean).join(' · '),legalReference:p.regulationExemption??undefined,contact:[authority.name,authority.service,authority.email,authority.phone].filter(Boolean).join(' · ')||undefined,source:'Irish Aviation Authority'}});result.status=result.zones.length?'loaded':'none';return result}
async function uk(point:Location):Promise<ZoneInfo>{const source=COUNTRY_SOURCES.GB,result=base('GB',source.name,source.source,source.url),data=await fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/GB.geojson`);result.zones=(data.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:p.identifier??`GB-${index}`,name:p.name??'UK UAS restriction',type:p.category??'UAS restriction',message:p.description,lower:p.lower,upper:p.upper,source:source.source,updated:p.effective}});result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result}
async function unitedStates(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.US,result=base('US',source.name,source.source,source.url);
 const params=new URLSearchParams({where:'1=1',geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,CEILING,UNIT,MAP_EFF,LAST_EDIT,APT1_FAAID,APT1_ICAO,APT1_NAME,APT1_LAANC,AIRSPACE_1,REGION',returnGeometry:'false',f:'json'});
 const response=await fetch(`https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/FAA_UAS_FacilityMap_Data_V5/FeatureServer/0/query?${params}`);
 if(!response.ok)throw new Error('FAA query failed');
 const data=await response.json();
 result.zones=(data.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{};return{id:`US-${p.OBJECTID??index}`,name:p.APT1_NAME??p.APT1_ICAO??'FAA UAS Facility Map grid',type:`${p.CEILING??0} ${p.UNIT??'Feet'} authorization ceiling`,message:p.APT1_LAANC?'LAANC-enabled facility grid. This value is not an authorization.':'Facility-map planning grid. This value is not an authorization.',upper:`${p.CEILING??0} ${p.UNIT??'Feet'} AGL`,source:source.source,updated:p.MAP_EFF??p.LAST_EDIT}});result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}
async function denmark(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.DK,result=base('DK',source.name,source.source,source.url);
 const [zones,nature]=await Promise.all([fetchGeoJson('https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/980697acd04d4a9bb1fd34bbefab924a/data'),fetchGeoJson('https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/ff657943724944faaf19807380f5e24a/data')]);
 const matches=[...(zones.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:`DK-${p.OBJECTID??index}`,name:p.title??p.typeId??'Danish drone zone',type:p.Farve==='1'?'Flight-safety critical':p.Farve==='4'?'Security critical':p.Farve==='5'?'Attention area':'Drone zone',message:[p.typeId,p.Bufferzone,p.Kommentar].filter(Boolean).join(' · '),source:source.source}}),...(nature.features??[]).filter((feature:any)=>feature.properties?.Aktiv==='JA'&&contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:`DK-NATURE-${p.OBJECTID??index}`,name:p.Fuglebeskyttelsesområder_og_Hab??p.Temanavn??'Active nature zone',type:'Active nature zone',message:[p.Restriktionsperiode_,p.Årsag__].filter(Boolean).join(' · '),source:source.source}})];
 result.zones=matches;result.status=matches.length?'loaded':'none';result.warning=source.warning;return result;
}

export async function getOfficialZoneInfo(point:Location):Promise<ZoneInfo>{
 const code=countryAt(point);
 try{
  if(code==='DE')return await dipul(point);
  if(code==='ES')return await enaire(point);
  if(code==='LU')return await luxembourg(point);
  if(code==='IE')return await ireland(point);
  if(code==='GB')return await uk(point);
  if(code==='DK')return await denmark(point);
  if(code==='US')return await unitedStates(point);
  if(code in COUNTRY_SOURCES){const source=COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES];return{...base(code,source.name,source.source,source.url),status:'unsupported',warning:source.warning}}
  return{...base(code,'Unknown','Official source directory','#'),status:'unsupported'};
 }catch{
  const source=code in COUNTRY_SOURCES?COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES]:undefined;
  return{...base(code,source?.name??code,source?.source??'Official source directory',source?.url??'#'),status:'error',warning:source?.warning??'The official source could not be reached. Check it directly before flight.'};
 }
}
