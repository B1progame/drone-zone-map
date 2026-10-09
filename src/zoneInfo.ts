import {zoneExplanation} from './zoneExplanation';
import type { Location, ZoneDetail, ZoneInfo } from './types';
import { latestPortugalEd269Url, normalizeEd269 } from './data/ed269';
import { isUkDroneRelevant } from './zoneSemantics';
import { localizeZoneInfo } from './zoneTranslations';
import { dachCountry, inDachRegion, aroundBodensee, geometryContains, currentZones, zoneValidity } from './zoneGeometry';
import {localZonesAt,localZonePacks} from './localZones';

const DIPUL_LAYERS=['bahnanlagen','behoerden','binnenwasserstrassen','bundesautobahnen','bundesstrassen','diplomatische_vertretungen','ffh-gebiete','flugbeschraenkungsgebiete','flughaefen','flugplaetze','freibaeder','haengegleiter','industrieanlagen','internationale_organisationen','justizvollzugsanstalten','kontrollzonen','kraftwerke','krankenhaeuser','labore','militaerische_anlagen','modellflugplaetze','nationalparks','naturschutzgebiete','polizei','schifffahrtsanlagen','seewasserstrassen','sicherheitsbehoerden','stromleitungen','temporaere_betriebseinschraenkungen','umspannwerke','vogelschutzgebiete','windkraftanlagen','wohngrundstuecke'];
const FAA_US_FACILITIES='https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/FAA_UAS_FacilityMap_Data_V5/FeatureServer/0/query';
const FAA_US_CLASS_AIRSPACE='https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Class_Airspace/FeatureServer/0/query';
const FAA_US_SPECIAL_USE='https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/Special_Use_Airspace/FeatureServer/0/query';
let selectedLanguage=(navigator.language||'en').toLowerCase().split('-')[0];
const language=()=>selectedLanguage;
const COUNTRY_SOURCES={
 BB:{name:'Barbados',source:'Barbados Civil Aviation Authority (BCAA)',url:'https://www.bcaa.gov.bb/remotely-piloted-aircraft-systems/',warning:'BCAA says operators must apply in advance to the Prime Minister’s Office. Its page names five recreational free-to-fly locations (Sterling, Lynches, Dash Valley, College Savannah and Vaucluse) subject to approval, licensing and insurance; it does not publish georeferenced boundaries. Restrictions include 400 ft altitude, 50 m separation and 5 km from controlled aerodromes. Check BCAA and current AIP/NOTAMs.'},
 BS:{name:'The Bahamas',source:'Civil Aviation Authority Bahamas (CAA-B)',url:'https://caabahamas.com/drone-faqs/',warning:'CAA-B requires registration and enabled geofencing for drone operation; commercial operation requires prior written authorization. The public FAQ and application pages do not expose reusable georeferenced zone boundaries. Restrictions include 5 km from aerodromes and designated rotorcraft landing zones; check current CAA-B guidance, AIP and NOTAMs.'},
 AZ:{name:'Azerbaijan',source:'State Civil Aviation Agency / Ministry of Digital Development and Transport',url:'https://mincom.gov.az/en/media-en/news/applications-for-special-permits-and-state-registration-of-civil-uavs-can-now-be-submitted-digitally-via-mygov',warning:'The Ministry says civil UAV circulation requires a special permit and state registration, with remote ID and geofencing. No public reusable drone-zone map was verified. Applications are handled through MyGov; check current AIP, NOTAMs and legal requirements before flight.'},
 AX:{name:'Åland Islands',source:'Traficom (Finland UAS geographical zones)',url:'https://www.traficom.fi/en/unmanned-aviation/where-flying-prohibited',warning:'Åland is covered by Traficom’s daily machine-readable Finnish UAS-zone dataset. The bundled data includes Mariehamn EFMA airport authorization zones; check temporary restrictions and NOTAMs before flight.'},
 AW:{name:'Aruba',source:'Department of Civil Aviation Aruba (DCA)',url:'https://www.dca.gov.aw/',warning:'DCA publishes official regulatory information; no public drone geofence or reusable zone geometry was verified. Check current DCA requirements, AIP and NOTAMs before flight.'},
 AS:{name:'American Samoa',source:'FAA UAS Facility Maps / FAA AIS',url:'https://www.faa.gov/uas/getting_started/b4ufly',warning:'FAA UAS facility, controlled-airspace and restricted-airspace layers cover American Samoa. Facility ceilings are not permission; check B4UFLY, current NOTAMs and local land-access rules.'},
 AQ:{name:'Antarctica',source:'Antarctic Treaty Secretariat APA Database',url:'https://www.ats.aq/devph/en/apa-database',warning:'The public ATS map shows indexed ASPA/ASMA locations, not precise geofences. No precise reusable boundary layer was verified; check the individual management plan, environmental approval and expedition requirements before operating.'},
 AO:{name:'Angola',source:'ANAC / SIAD',url:'https://inavic.gov.ao/sia/introducao_sia',warning:'ANAC SIAD publishes aeronautical charts and NTA 36 RPAS rules. No current reusable drone-zone feed was verified; check the current AIP, NOTAMs and ANAC permissions before flight.'},
 AF:{name:'Afghanistan',source:'Afghanistan Civil Aviation Authority / AIS',url:'https://www.afgais.com/',warning:'Afghanistan AIS publishes the current AIP, airspace NOTAMs and flight permission workflow. No reusable drone-zone geometry was verified; check current official publications and permissions before flight.'},
 AG:{name:'Antigua and Barbuda',source:'V.C. Bird Air Traffic Services (ANU)',url:'https://www.vcbirdats.com/nofly-zones',warning:'V.C. Bird ATS links an official no-fly-zones page and RPAS guidance. The page provided no readable reusable geometry during review; guidance is dated 2019, so verify current rules, AIP/NOTAMs and ATC permissions directly.'},
 AI:{name:'Anguilla',source:'Government of Anguilla / Air Safety Support International',url:'https://www.gov.ai/laws/TCLU/Air%20Navigation%20%28OT%29%20Order%202013/docs/Air%20Navigation%20%28OT%29%20Order%202013_61.pdf',warning:'The official Air Navigation (Overseas Territories) Order contains Anguilla UAS rules and requires ATC permission in specified controlled airspace and aerodrome traffic zones. No reusable current drone-zone geometry was verified; check AIP/NOTAMs and permissions directly.'},
 BA:{name:'Bosnia and Herzegovina',source:'BHANSA AMC / BHDCA',url:'https://amc.bhansa.gov.ba/amc/maps',warning:'The official BHANSA AMC map provides an RPAS/UAS layer. BHDCA rules include border-protection limits and airport/CTR coordination requirements. No reusable zone geometry was verified; the AMC preview does not replace current NAUP/NUUP, NOTAM and authority checks.'},
 AL:{name:'Albania',source:'Albanian Civil Aviation Authority (ACAA) / Albcontrol AIP',url:'https://www.aac.gov.al/avione-pa-pilote-drone/',warning:'ACAA directs operators to AIP-defined prohibited or restricted areas; Albcontrol publishes official airspace charts. No reusable public drone-zone geometry was verified; check the current AIP, amendments and NOTAMs before flight.'},
 AM:{name:'Armenia',source:'Civil Aviation Committee / Armats AIS',url:'https://armats.am/',warning:'The current Armenian eAIP requires advance Civil Aviation Committee applications for RPAS training and special flights. No reusable drone-zone geometry was verified; check current AIP charts, NOTAMs and permissions before flight.'},
 AD:{name:'Andorra',source:'Andorran Civil Aviation Authority / Government of Andorra',url:'https://www.govern.ad/ca/tematiques/accio-climatica/transports/transport-aeri',warning:'The Government of Andorra publishes drone FAQs and the 2025 UAS regulation, which defines free, limited and prohibited flight zones. No current public zone map or reusable geometry download was verified; confirm the planned area and permissions with the authority.'},
 GB:{name:'United Kingdom',source:'NATS UK AIS',url:'https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/',warning:'Official permanent NATS UAS restrictions render from the current AIRAC visualization dataset. Check the UK AIP and current NOTAMs before flight.'},
 FR:{name:'France',source:'IGN / Géoportail',url:'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme',warning:'The official IGN restrictions render and are queried from the published WFS for metropolitan and covered overseas territories. The dataset does not include temporary restrictions; check SIA before flight.'},
 SE:{name:'Sweden',source:'LFV Dronechart',url:'https://dronechart.lfv.se/',warning:'Official LFV vectors render on the map with the published ground-level filters. Check LFV and current NOTAMs before flight.'},
 DK:{name:'Denmark',source:'Trafikstyrelsen Dronezoner',url:'https://www.droneregler.dk/dronezoner',warning:'Official static drone-zone data is loaded from Trafikstyrelsen. Check Dronezoner for temporary changes before flight.'},
 NO:{name:'Norway',source:'Avinor drone map',url:'https://experience.arcgis.com/experience/9d098dbc738e436f9525fdb4ef443f61',warning:'Avinor prohibits presenting its service data in another application, so Aeris links to the official map instead of copying its zones.'},
 CH:{name:'Switzerland',source:'FOCA / geo.admin.ch',url:'https://map.geo.admin.ch/#/map?lang=en&topic=ech&layers=ch.bazl.einschraenkungen-drohnen',warning:'FOCA UAS boundaries render from the dated local dataset, refreshed weekly. Cantonal rules and temporary restrictions can still apply.'},
 LI:{name:'Liechtenstein',source:'FOCA / geo.admin.ch',url:'https://map.geo.admin.ch/#/map?lang=en&topic=ech&layers=ch.bazl.einschraenkungen-drohnen',warning:'FOCA publishes this UAS dataset for Switzerland and Liechtenstein. Check local rules and temporary restrictions before flight.'},
 AT:{name:'Austria',source:'Austro Control Dronespace',url:'https://utm.dronespace.at/avm/',warning:'Import the current Austro Control zone JSON in Sources to display Austrian boundaries on this device. No Austrian zone file is loaded yet.'},
 IT:{name:'Italy',source:'ENAC / d-flight',url:'https://www.d-flight.it/web-app/',warning:'ENAC requires a current d-flight map check before every operation. Registered operators may download ED-269 JSON for personal use, but d-flight terms do not permit Aeris to redistribute it without prior written consent.'},
 US:{name:'United States',source:'FAA UAS Facility Maps',url:'https://www.faa.gov/uas/getting_started/b4ufly',warning:'FAA UAS Facility Map grids render live and show pre-coordinated authorization altitudes, not permission or every restriction. Check B4UFLY and current TFRs.'},
 CA:{name:'Canada',source:'Transport Canada open data + NRC Drone Site Selection Tool',url:'https://cnrc.canada.ca/en/drone-tool-2/',warning:'Aeris renders Transport Canada airport-with-air-navigation-services points, 5.6 km orientation rings and national-park boundaries. This airport dataset is not a complete certified aerodrome/heliport list, and rings do not represent all legal zones. NRC confirms its NAV CANADA-derived airspace geometry cannot be redistributed; use the official Drone Site Selection Tool for complete airspace and current restrictions.'},
 NL:{name:'Netherlands',source:'Ministry of Infrastructure and Water Management',url:'https://www.rijksoverheid.nl/vraag-en-antwoord/drone/waar-mag-ik-vliegen-met-een-drone',warning:'Official CC0 ED-269 zones render from the latest bundled government dataset. Check Aeret and current NOTAMs before flight.'},
 FI:{name:'Finland',source:'Traficom',url:'https://www.traficom.fi/fi/miehittamaton-ilmailu/uas-ilmatilavyohykkeet-koneluettavassa-muodossa',warning:'Official machine-readable Traficom zones render from a dated CC BY 4.0 snapshot. Check the official map, temporary restrictions and NOTAMs before flight.'},
 EE:{name:'Estonia',source:'Transport Administration / EANS',url:'https://transpordiamet.ee/en/aviation-and-aviation-safety/flying-drones-estonia/geographical-zones',warning:'Official EANS GeoJSON renders live. Check the EANS map and current temporary restrictions before flight.'},
 BG:{name:'Bulgaria',source:'Bulgarian Civil Aviation Administration',url:'https://www.caa.bg/bg/category/633/7062',warning:'Aeris links to the official CAA source and does not redistribute BGR_ZONES geometry while reuse permission is unconfirmed. Check B-FLIP and active or temporary restrictions before flight.'},
 PT:{name:'Portugal',source:'ANAC Portugal',url:'https://www.anac.pt/vPT/Generico/drones/zona_proibidas_condicionadas/Paginas/Zonasproibidasoucondicionadas.aspx',warning:'Official ANAC ED-269 zones load live from the newest dated file. Check ANAC, military no-fly zones and current NOTAMs before flight.'},
 BE:{name:'Belgium',source:'FPS Mobility / Droneguide',url:'https://map.droneguide.be/',warning:'Belgium publishes fixed UAS geozones and access conditions through Droneguide. Open the official map because no reusable public feed was verified.'},
 PL:{name:'Poland',source:'PANSA / DroneTower',url:'https://dronetower.pansa.pl/',warning:'Polish guidance requires a current DroneTower zone check and flight check-in. No anonymous reusable geozone feed was verified.'},
 CZ:{name:'Czechia',source:'CAA Czechia / DroneMap',url:'https://dronemap.gov.cz/index.php?lang=2',warning:'CAA Czechia designates DroneMap for exact boundaries and operating conditions. No documented reusable public endpoint was verified.'},
 SK:{name:'Slovakia',source:'Transport Authority',url:'https://letectvo.nsat.sk/bezpilotne-letectvo/zemepisne-oblasti-uas/',warning:'The Transport Authority publishes a current KML package, but Aeris does not redistribute it while reuse terms remain unstated.'},
 HU:{name:'Hungary',source:'HungaroControl MyDroneSpace',url:'https://mydronespace.hu/',warning:'MyDroneSpace is Hungary’s official pre-flight and operational service. No anonymous reusable geozone feed was verified.'},
 RO:{name:'Romania',source:'Romanian CAA',url:'https://www.caa.ro/ro/pages/drone',warning:'The Romanian CAA publishes prohibited and restricted UAS areas, contacts, and an official interactive map. No reusable feed was verified.'},
 GR:{name:'Greece',source:'HCAA / Drone Aware Greece',url:'https://dagr.hasp.gov.gr/#map_page',warning:'HCAA requires a current DAGR check. Yellow and magenta areas can require approval or prohibit flight.'},
 HR:{name:'Croatia',source:'Croatia Control AMC Map',url:'https://amc.crocontrol.hr/amc/maps/',warning:'The public AMC map displays UAG, ULG and URG drone zones and current airspace. Registration is needed for operational reservations or approvals; no reusable public geometry feed was verified. Check current AMC notices.'},
 SI:{name:'Slovenia',source:'Civil Aviation Agency',url:'https://www.caa.si/geografske-omejitve-za-uas.html',warning:'The public CAA ArcGIS map is inventoried, but its geometry is not copied because no reuse licence was stated.'},
 LV:{name:'Latvia',source:'LGS / Civil Aviation Agency',url:'https://www.airspace.lv/drones/en',warning:'The official Latvian map updates every five minutes. No stable reusable download was verified, so use it directly.'},
 LT:{name:'Lithuania',source:'Oro Navigacija / Lithuania Drone Map',url:'https://utm.ans.lt/',warning:'All approved Lithuanian geozones and temporary restrictions are published in the registered UTM platform.'},
 AU:{name:'Australia',source:'CASA Drone Safety',url:'https://www.casa.gov.au/knowyourdrone/drone-safety-apps',warning:'CASA directs pilots to verified planning apps. Aeris does not bypass the authenticated provider data service.'},
 NZ:{name:'New Zealand',source:'CAA New Zealand / AirShare',url:'https://www.airshare.co.nz/',warning:'CAA directs pilots to AirShare for current low-flying, aerodrome, control, restricted, military, and danger areas.'},
 JP:{name:'Japan',source:'MLIT DIPS 2.0',url:'https://www.mlit.go.jp/koku/koku_ua_dips.html',warning:'DIPS 2.0 is Japan’s official authenticated registration, planning, and permission platform.'},
 BR:{name:'Brazil',source:'DECEA SARPAS',url:'https://servicos.decea.gov.br/sarpas/',warning:'SARPAS requires operator and aircraft registration. Aeris does not automate or bypass the operational service.'},
 IN:{name:'India',source:'DGCA Digital Sky',url:'https://digitalsky.dgca.gov.in/',warning:'Digital Sky is the government real-time repository for red, yellow, and green zones. No anonymous reusable feed was verified.'},
 SG:{name:'Singapore',source:'CAAS / OneMap',url:'https://www.onemap.gov.sg/',warning:'CAAS identifies OneMap as the authoritative source for no-fly, permit, and temporary restricted areas.'},
 ZA:{name:'South Africa',source:'SACAA / ATNS AIP',url:'https://www.caa.co.za/industry-information/aeronautical-information-index-of-aics/',warning:'Current restrictions are published through AIP, NOTAM, and SACAA RPAS rules; no reusable national drone-geozone feed was verified.'},
 MT:{name:'Malta',source:'Transport Malta / Civil Aviation Directorate',url:'https://www.transport.gov.mt/aviation/drones/geographical-zones-5487',warning:'Transport Malta publishes the national geographical-zone overview and links its interactive map. No reusable public zone feed or redistribution permission was verified.'},
 CY:{name:'Cyprus',source:'Department of Civil Aviation Cyprus',url:'https://drones.gov.cy/gr/geo-zones-map/',warning:'The DCA publishes a versioned KMZ for pilots to download. No redistribution licence was verified; open the official map and download directly from the authority.'},
 IS:{name:'Icelandic Transport Authority / Ísland.is',source:'Icelandic Transport Authority / Ísland.is',url:'https://island.is/en/drone-map',warning:'The government service links directly to the Transport Authority’s Icelandic Drone Map. Check protected-area rules and current restrictions before flight.'},
 AE:{name:'United Arab Emirates',source:'GCAA UAE Fly Zone',url:'https://www.gcaa.gov.ae/en/Pages/NoFlyZonetest.aspx',warning:'GCAA’s official map shows no-fly and prohibited zones. Check the current My Drone Hub service and relevant emirate authority, including DCAA in Dubai, before flight.'},
 AR:{name:'Argentina',source:'ANAC Aeronautical Information Service',url:'https://ais.anac.gob.ar/aip',warning:'ANAC publishes restricted, prohibited and dangerous areas in the AIP. Check its latest amendments and current NOTAMs before flight; no reusable drone-zone layer is verified.'},
 MX:{name:'Mexico',source:'SENEAM / AFAC AIP Mexico',url:'https://aipmexico.seneam.gob.mx/AIP/',warning:'SENEAM publishes official aeronautical charts and restrictions; AFAC directs RPAS operators to AIP restrictions. Check current publications and NOTAMs before flight.'},
 CN:{name:'China',source:'CAAC UOM platform',url:'https://app.caac.gov.cn/',warning:'CAAC’s UOM is the official national unmanned-aircraft management and airspace service. Local governments publish specific controlled-airspace extents; verify the selected location in UOM and with local authorities.'},
 TR:{name:'Türkiye',source:'SHGM İHA Registration System',url:'https://iha.shgm.gov.tr/public/index',warning:'SHGM’s official İHA system shows free-flight areas and manages flight permissions. Check local flight bans, AIP and current NOTAMs before flight.'},
 TH:{name:'Thailand',source:'CAAT UAS Portal',url:'https://uasportal.caat.or.th/',warning:'CAAT’s UAS Portal is the official drone operations service. Check current restricted areas and temporary notices in the portal before flight.'},
 PH:{name:'Philippines',source:'CAAP Hazardous/Critical Airspace Point Search',url:'https://www.caap.gov.ph/hcp/',warning:'CAAP provides an official coordinate lookup for critical areas. The lookup requires its own CAPTCHA and user agreement; use the authority page directly.'},
 ID:{name:'Indonesia',source:'AirNav Indonesia AIS Center',url:'https://pia.airnavindonesia.co.id/',warning:'AirNav Indonesia publishes official AIP, charts and NOTAMs. Drone permits are managed through the Ministry of Transport SIDOPI-GO system; check both sources.'},
 MY:{name:'Malaysia',source:'CAAM UAS / Malaysia AIP',url:'https://www.caam.gov.my/public/unmanned-aircraft-system-uas/',warning:'CAAM UAS rules prohibit flight in specified controlled airspace and aerodrome zones without authorization. Consult the current Malaysia AIP, temporary restrictions and CAAM ATF workflow.'},
 CO:{name:'Colombia',source:'Aerocivil Visor Geográfico UAS',url:'https://www.aerocivil.gov.co/servicios-a-la-navegacion/sistema-%20de-aeronaves-pilotadas-a-distancia-rpas-drones/Paginas/default.aspx',warning:'Aerocivil’s public UAS viewer shows RAC 100 and AIP restrictions, including drone no-fly zones. Open the authority viewer for current boundaries and conditions.'},
 VN:{name:'Vietnam',source:'Ministry of National Defence UAV zones map',url:'https://cambay.mod.gov.vn/',warning:'Vietnam’s Ministry of National Defence publishes national prohibited and restricted UAV areas in its map portal. Check the official map and local notices before flight.'},
 SA:{name:'Saudi Arabia',source:'GACA UAS Portal',url:'https://uas.gaca.gov.sa/uas/',warning:'GACA requires pilots to obtain current UAS geographical-zone information. Use the official portal and permit workflow before flight; no reusable public zone feed was verified.'}
} as const;
type CountryCode=keyof typeof COUNTRY_SOURCES|'DE'|'ES'|'LU'|'IE'|'GF'|'GP'|'MQ'|'RE'|'YT'|'PM'|'TF'|'XX';
function countryAt(p:Location):CountryCode{
 const precise=dachCountry(p);
 if(precise)return precise as CountryCode;
 // Never assign an overlapping European rectangle to a lake or border point.
 if(inDachRegion(p)&&p.lat<49.2&&p.lng<17.2)return 'XX';
 const named=p.name.toLowerCase();
 const namedCountry:[CountryCode,string[]][]=[
  ['LU',['luxembourg']],['IE',['ireland','éire','irland']],['ES',['spain','españa','spanien']],['DK',['denmark','danmark','dänemark']],
  ['GB',['united kingdom','great britain','england','scotland','wales','northern ireland','vereinigtes königreich','großbritannien']],
  ['US',['united states','usa','vereinigte staaten']],
  ['LI',['liechtenstein']],['CH',['switzerland','schweiz','suisse','svizzera']],['AT',['austria','österreich','autriche']],['IT',['italy','italia','italien','italie']],['DE',['germany','deutschland']],['FR',['france','frankreich','french guiana','guyane','guadeloupe','martinique','réunion','reunion','mayotte','saint pierre and miquelon','saint-pierre-et-miquelon']],['SE',['sweden','sverige','schweden']],
  ['NO',['norway','norge','norwegen']],['CA',['canada','kanada']],['NL',['netherlands','nederland','niederlande']],['FI',['finland','suomi','finnland']],['EE',['estonia','eesti','estland']],['BG',['bulgaria','българия','bulgarien']],['PT',['portugal','portugalia']],
  ['BE',['belgium','belgië','belgique','belgien']],['PL',['poland','polska','polen']],['CZ',['czechia','czech republic','česko','tschechien']],['SK',['slovakia','slovensko','slowakei']],
  ['HU',['hungary','magyarország','ungarn']],['RO',['romania','românia','rumänien']],['GR',['greece','ελλάδα','griechenland']],['HR',['croatia','hrvatska','kroatien']],
  ['SI',['slovenia','slovenija','slowenien']],['LV',['latvia','latvija','lettland']],['LT',['lithuania','lietuva','litauen']],['AU',['australia','australien']],['BB',['barbados']],['BS',['bahamas']],
  ['NZ',['new zealand','aotearoa','neuseeland']],['IS',['iceland','ísland','island']],['CY',['cyprus','κύπρος']],['JP',['japan','日本']],['BR',['brazil','brasil','brasilien']],['IN',['india','indien']],
  ['SG',['singapore','singapur']],['ZA',['south africa','südafrika']],['MT',['malta']],['AF',['afghanistan']],['AG',['antigua and barbuda','antigua']],['AI',['anguilla']],['BA',['bosnia and herzegovina','bosnia','herzegovina','bosna i hercegovina']],['AL',['albania','shqipëria']],['AM',['armenia','հայաստան']],['AO',['angola']],['AQ',['antarctica','antarctic']],['AS',['american samoa']],['AW',['aruba']],['AX',['åland','aland','ahvenanmaa']],['AZ',['azerbaijan','azerbaycan','азербайджан']],['AE',['united arab emirates','uae','emirates','الإمارات']],['AR',['argentina']],['MX',['mexico','méxico']],['CN',['china','中国','prc']],['TR',['turkey','türkiye','turkiye']],['TH',['thailand','ประเทศไทย']],['PH',['philippines']],['ID',['indonesia']],['MY',['malaysia']],['CO',['colombia']],['VN',['vietnam','việt nam']],['SA',['saudi arabia','saudi','المملكة العربية السعودية']]
 ];
 for(const [code,names] of namedCountry)if(names.some(name=>named.includes(name)))return code;
 if(p.lat>=-14.6&&p.lat<=-10.8&&p.lng>=-171.1&&p.lng<=-168.1)return'AS';
  if(p.lat>=38.3&&p.lat<=41.9&&p.lng>=44.7&&p.lng<=50.8)return'AZ';
  if(p.lat>=12.4&&p.lat<=12.65&&p.lng>=-70.1&&p.lng<=-69.85)return'AW';
  if(p.lat>=12.9&&p.lat<=13.4&&p.lng>=-59.7&&p.lng<=-59.4)return'BB';
  if(p.lat>=20.9&&p.lat<=27.6&&p.lng>=-79.3&&p.lng<=-72.4)return'BS';
 if(p.lat < -60)return'AQ';
 if(p.lat>=49.35&&p.lat<=50.25&&p.lng>=5.65&&p.lng<=6.65)return'LU';
 if(p.lat>=50.7&&p.lat<=53.7&&p.lng>=3.2&&p.lng<=7.25)return'NL';
 if(p.lat>=57.3&&p.lat<=60.1&&p.lng>=21.5&&p.lng<=28.3)return'EE';
 if(p.lat>=59.3&&p.lat<=60.7&&p.lng>=19.1&&p.lng<=21.5)return'AX';
 if(p.lat>=59.5&&p.lat<=70.2&&p.lng>=19&&p.lng<=31.6)return'FI';
 if(p.lat>=41.1&&p.lat<=44.3&&p.lng>=22.2&&p.lng<=28.7)return'BG';
 if(p.lat>=30&&p.lat<=42.3&&p.lng>=-31.5&&p.lng<=-6)return'PT';
 if((p.lat>=2&&p.lat<=6.2&&p.lng>=-54.8&&p.lng<=-51.4)||(p.lat>=14&&p.lat<=19&&p.lng>=-63.7&&p.lng<=-60.7)||(p.lat>=-21.6&&p.lat<=-20.7&&p.lng>=55&&p.lng<=56)||(p.lat>=-13.1&&p.lat<=-12.5&&p.lng>=44.9&&p.lng<=45.4)||(p.lat>=46.7&&p.lat<=47.3&&p.lng>=-56.6&&p.lng<=-55.8))return'FR';
 if(p.lat>=51.2&&p.lat<=55.6&&p.lng>=-11&&p.lng<=-5)return'IE';
 if(p.lat>=49&&p.lat<=61&&p.lng>=-9&&p.lng<=2.5)return'GB';
 if(p.lat>=27&&p.lat<=44.5&&p.lng>=-18.5&&p.lng<=5)return'ES';
 if(p.lat>=54.4&&p.lat<=58&&p.lng>=7.8&&p.lng<=15.3)return'DK';
 if(p.lat>=47.05&&p.lat<=47.27&&p.lng>=9.47&&p.lng<=9.64)return'LI';
 if(p.lat>=22.6&&p.lat<=26.1&&p.lng>=51.5&&p.lng<=56.5)return'AE';
 if(p.lat>=-55.2&&p.lat<=-21.7&&p.lng>=-73.6&&p.lng<=-53.6)return'AR';
 if(p.lat>=14.4&&p.lat<=32.8&&p.lng>=-118.5&&p.lng<=-86.5)return'MX';
 if(p.lat>=17.5&&p.lat<=53.6&&p.lng>=73.5&&p.lng<=134.8)return'CN';
 if(p.lat>=45.75&&p.lat<=47.85&&p.lng>=5.75&&p.lng<=10.65)return'CH';
 if(p.lat>=46.25&&p.lat<=49.15&&p.lng>=9.45&&p.lng<=17.2)return'AT';
 if(p.lat>=35.78&&p.lat<=36.1&&p.lng>=14.18&&p.lng<=14.65)return'MT';
 if(p.lat>=35.3&&p.lat<=47.2&&p.lng>=6.5&&p.lng<=18.8)return'IT';
 if(p.lat>=34.4&&p.lat<=35.8&&p.lng>=32.2&&p.lng<=34.6)return'CY';
 if(p.lat>=47&&p.lat<=55.2&&p.lng>=5.5&&p.lng<=15.5)return'DE';
 if(p.lat>=41&&p.lat<=51.5&&p.lng>=-5.5&&p.lng<=10)return'FR';
 if(p.lat>=57.5&&p.lat<=71.5&&p.lng>=4&&p.lng<=31.5){
  const border=p.lat<60.5?11.3:p.lat<63?12.5:p.lat<66?15:p.lat<68?18:p.lat<69?23:31.5;
  if(p.lng<border)return'NO';
 }
 if(p.lat>=55&&p.lat<=69.2&&p.lng>=10.4&&p.lng<=24.5)return'SE';
 if(p.lat>=63.3&&p.lat<=66.7&&p.lng>=-24.7&&p.lng<=-13.1)return'IS';
 if(p.lat>=49&&p.lat<=83.5&&p.lng>=-141&&p.lng<=-52)return'CA';
 if((p.lat>=24&&p.lat<=49.5&&p.lng>=-125&&p.lng<=-66)||(p.lat>=51&&p.lat<=72&&p.lng>=-180&&p.lng<=-129)||(p.lat>=18&&p.lat<=23&&p.lng>=-161&&p.lng<=-154)||(p.lat>=17&&p.lat<=19&&p.lng>=-68&&p.lng<=-64)||(p.lat>=13&&p.lat<=22&&p.lng>=144&&p.lng<=147)||(p.lat>=-15&&p.lat<=-10&&p.lng>=-172&&p.lng<=-167)||(p.lat>=28&&p.lat<=29&&p.lng>=-178&&p.lng<=-176)||(p.lat>=19&&p.lat<=20&&p.lng>=166&&p.lng<=168)||(p.lat>=5&&p.lat<=6&&p.lng>=-162&&p.lng<=-161))return'US';
 return'XX';
}
const labels:Record<string,Record<string,string>>={
 en:{FLUGBESCHRAENKUNGSGEBIET:'Flight restriction area',KONTROLLZONE:'Control zone',PROHIBITED:'Prohibited zone',REQ_AUTHORIZATION:'Authorization required',CONDITIONAL:'Conditional zone',COMMON:'Geographical zone'},
 de:{FLUGBESCHRAENKUNGSGEBIET:'Flugbeschränkungsgebiet',KONTROLLZONE:'Kontrollzone',PROHIBITED:'Verbotszone',REQ_AUTHORIZATION:'Genehmigung erforderlich',CONDITIONAL:'Bedingte Zone',COMMON:'Geografisches Gebiet'},
 es:{FLUGBESCHRAENKUNGSGEBIET:'Zona de restricción de vuelo',KONTROLLZONE:'Zona de control',PROHIBITED:'Zona prohibida',REQ_AUTHORIZATION:'Autorización requerida',CONDITIONAL:'Zona condicional',COMMON:'Zona geográfica'},
 fr:{FLUGBESCHRAENKUNGSGEBIET:'Zone de restriction de vol',KONTROLLZONE:'Zone de contrôle',PROHIBITED:'Zone interdite',REQ_AUTHORIZATION:'Autorisation requise',CONDITIONAL:'Zone conditionnelle',COMMON:'Zone géographique'},
 it:{FLUGBESCHRAENKUNGSGEBIET:'Area con restrizioni di volo',KONTROLLZONE:'Zona di controllo',PROHIBITED:'Zona vietata',REQ_AUTHORIZATION:'Autorizzazione richiesta',CONDITIONAL:'Zona condizionata',COMMON:'Zona geografica'},
 pt:{FLUGBESCHRAENKUNGSGEBIET:'Área de restrição de voo',KONTROLLZONE:'Zona de controlo',PROHIBITED:'Zona proibida',REQ_AUTHORIZATION:'Autorização necessária',CONDITIONAL:'Zona condicionada',COMMON:'Zona geográfica'}
};
const translate=(value:string,requested=language())=>{
 const normalized=value==='REQ_AUTHORISATION'?'REQ_AUTHORIZATION':value;
 return labels[requested]?.[normalized]??labels.en[normalized]??normalized.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
};
const cleanHtml=(value='')=>{const doc=new DOMParser().parseFromString(value,'text/html');return (doc.body.textContent??'').replace(/\s+/g,' ').trim()};
const localizedOfficialText=(values:Record<string,string>)=>values[language()]??values.en;
const translateEnaireName=(value:string)=>{
 if(value.trim().toUpperCase()!=='POPULATION')return value;
 return localizedOfficialText({
  en:'Population / urban environment',
  de:'Bevölkerung / städtische Umgebung',
  es:'Población / entorno urbano',
  fr:'Population / environnement urbain',
  it:'Popolazione / ambiente urbano',
  pt:'População / ambiente urbano'
 });
};
const translateEnaireMessage=(value:string,attributes:Record<string,any>={})=>{
 if(!value||language()==='es')return value;
 if(/entorno urbano|Ministerio del Interior|5 días naturales/i.test(value)){
  return localizedOfficialText({
   en:'Before flying, check whether the flight area is an urban environment. ENAIRE defines this as: (a) population centres with consolidated built-up areas; (b) residential, commercial or industrial areas that have road access, paved public pedestrian access, drainage and public lighting; or (c) publicly accessible recreational areas with permanent or temporary leisure, recreation or sports structures—including beaches meeting both requirements and local-authority parks or gardens. If the flight takes place in one of these areas, UAS operators required to register must notify Spain’s Ministry of the Interior at least 5 calendar days before the planned start. In the open category, flying over buildings or reducing the minimum distance to them also requires permission from the competent authority or the owner or responsible manager.',
   de:'Prüfe vor dem Flug, ob sich das Fluggebiet in einer städtischen Umgebung befindet. ENAIRE definiert diese als: (a) Siedlungskerne mit zusammenhängend bebauten Flächen; (b) Wohn-, Gewerbe- oder Industrieflächen, die zusammen mindestens über Straßenanbindung, befestigte öffentliche Fußwege, Entwässerung und öffentliche Beleuchtung verfügen; oder (c) öffentlich zugängliche Freizeitflächen mit dauerhaften oder vorübergehenden Bauten oder Anlagen für Freizeit, Erholung oder Sport – einschließlich Stränden, die beide Voraussetzungen erfüllen, sowie Parks oder Gärten in Zuständigkeit lokaler Behörden. Findet der Flug in einer dieser Zonen statt, müssen registrierungspflichtige UAS-Betreiber ihn mindestens 5 Kalendertage vor dem geplanten Beginn dem spanischen Innenministerium melden. Für das Überfliegen von Gebäuden oder das Unterschreiten der Mindestabstände in der offenen Kategorie ist zusätzlich die Erlaubnis der zuständigen Stelle oder des Eigentümers beziehungsweise verantwortlichen Betreibers erforderlich.',
   fr:'Avant le vol, vérifiez si la zone de vol se trouve dans un environnement urbain. ENAIRE entend par là : (a) les noyaux de population aux zones bâties consolidées ; (b) les zones résidentielles, commerciales ou industrielles disposant au minimum d’un accès routier, de voies publiques piétonnes revêtues, d’un système d’évacuation des eaux et d’un éclairage public ; ou (c) les espaces de loisirs ouverts au public comportant des constructions ou installations permanentes ou temporaires destinées aux loisirs ou au sport — y compris les plages remplissant les deux conditions ainsi que les parcs ou jardins relevant des autorités locales. Si le vol a lieu dans l’une de ces zones, les exploitants de UAS soumis à l’enregistrement doivent le notifier au ministère espagnol de l’Intérieur au moins 5 jours calendaires avant le début prévu. En catégorie ouverte, le survol de bâtiments ou la réduction des distances minimales exige aussi l’autorisation de l’autorité compétente, du propriétaire ou du gestionnaire responsable.',
   it:'Prima del volo, verifica se l’area di vol si trova in ambiente urbano. ENAIRE definisce tale ambiente come: (a) centri abitati con aree edificate consolidate; (b) aree residenziali, commerciali o industriali dotate almeno di accesso stradale, percorsi pedonali pubblici pavimentati, drenaggio e illuminazione pubblica; oppure (c) aree ricreative aperte al pubblico con costruzioni o installazioni permanenti o temporanee per il tempo libero, la ricreazione o lo sport — comprese le spiagge che soddisfano entrambi i requisiti e i parchi o giardini degli enti locali. Se il volo avviene in una di queste zone, gli operatori UAS soggetti a registrazione devono comunicarlo al Ministero dell’Interno spagnolo almeno 5 giorni di calendario prima dell’inizio previsto. In categoria aperta, il sorvolo degli edifici o la riduzione delle distanze minime richiede anche l’autorizzazione dell’autorità competente, del proprietario o del gestore responsabile.',
   pt:'Antes do voo, verifique se a área de voo se encontra num ambiente urbano. A ENAIRE define-o como: (a) núcleos populacionais com áreas edificadas consolidadas; (b) áreas residenciais, comerciais ou industriais que disponham, no mínimo, de acesso rodoviário, vias públicas pedonais pavimentadas, drenagem e iluminação pública; ou (c) áreas recreativas de acesso público com construções ou instalações permanentes ou temporárias destinadas ao lazer, recreio ou desporto — incluindo praias que cumpram ambos os requisitos e parques ou jardins sob responsabilidade das autoridades locais. Se o voo ocorrer numa destas zonas, os operadores de UAS sujeitos a registo devem comunicá-lo ao Ministério do Interior espanhol com pelo menos 5 dias de calendário de antecedência. Na categoria aberta, sobrevoar edifícios ou reduzir as distâncias mínimas também exige autorização da autoridade competente, do proprietário ou do gestor responsável.'
  });
 }
 if(/vuelo fotográfico|captación de datos|CECAF/i.test(value)){
  return localizedOfficialText({
   en:'This ENAIRE area is restricted for aerial photography or data capture. Request the technical conditions for each photography or data-capture job from the Spanish Air and Space Force Cartographic and Photographic Centre (CECAF) at cecaf@ea.mde.es, and check the current ENAIRE AIC before flying.',
   de:'Dieses ENAIRE-Gebiet ist für Luftbildaufnahmen oder Datenerfassung beschränkt. Fordere für jeden Foto- oder Datenerfassungsauftrag die technischen Bedingungen beim kartografischen und fotografischen Zentrum der spanischen Luft- und Weltraumstreitkräfte (CECAF) unter cecaf@ea.mde.es an und prüfe vor dem Flug das aktuelle ENAIRE-AIC.',
   fr:'Cette zone ENAIRE est soumise à des restrictions pour la photographie aérienne ou la collecte de données. Demandez les conditions techniques applicables à chaque mission au Centre cartographique et photographique de l’armée de l’Air et de l’Espace espagnole (CECAF) à cecaf@ea.mde.es et consultez l’AIC ENAIRE en vigueur avant le vol.',
   it:'Questa zona ENAIRE è soggetta a restrizioni per la fotografia aerea o l’acquisizione di dati. Richiedi le condizioni tecniche per ogni attività al Centro cartografico e fotografico dell’Aeronautica e dello Spazio spagnola (CECAF) all’indirizzo cecaf@ea.mde.es e consulta l’AIC ENAIRE vigente prima del volo.',
   pt:'Esta zona ENAIRE está sujeita a restrições para fotografia aérea ou captação de dados. Solicite as condições técnicas de cada trabalho ao Centro Cartográfico e Fotográfico da Força Aérea e Espacial espanhola (CECAF) através de cecaf@ea.mde.es e consulte a AIC ENAIRE em vigor antes do voo.'
  });
 }
 if(/protección de las instalaciones|permiso previo y expreso del titular/i.test(value)){
  const threshold=value.match(/Por debajo de\s*([0-9.,]+\s*m)/i)?.[1]??`${attributes.upper??''} ${attributes.uom??'m'}`.trim();
  const contact=attributes.email&&attributes.email!=='Nulo'?attributes.email:'the listed official contact';
  return localizedOfficialText({
   en:`This ENAIRE infrastructure-protection zone requires the facility owner’s or responsible operator’s prior express permission for flights below ${threshold}. Follow any conditions they impose and use ${contact} for coordination.`,
   de:`In diesem ENAIRE-Schutzgebiet für Anlagen und Infrastruktur ist für Flüge unterhalb von ${threshold} die vorherige ausdrückliche Genehmigung des Eigentümers oder verantwortlichen Betreibers erforderlich. Beachte dessen Bedingungen und nutze ${contact} zur Koordination.`,
   es:value,
   fr:`Dans cette zone ENAIRE de protection des installations et infrastructures, les vols sous ${threshold} nécessitent l’autorisation préalable et expresse du propriétaire ou du gestionnaire responsable. Respectez ses conditions et utilisez ${contact} pour la coordination.`,
   it:`In questa zona ENAIRE di protezione di impianti e infrastrutture, i voli al di sotto di ${threshold} richiedono l’autorizzazione preventiva ed esplicita del proprietario o del gestore responsabile. Rispetta le relative condizioni e usa ${contact} per il coordinamento.`,
   pt:`Nesta zona ENAIRE de proteção de instalações e infraestruturas, os voos abaixo de ${threshold} exigem autorização prévia e expressa do proprietário ou gestor responsável. Cumpra as condições aplicáveis e utilize ${contact} para coordenação.`
  });
 }
 if(/punto de referencia del aeródromo|AENA coordinará|proveedor de servicios ATS/i.test(value)){
  const threshold=value.match(/Por debajo de\s*([0-9.,]+\s*m)/i)?.[1]??`${attributes.lower??''} ${attributes.uom??'m'}`.trim();
  const reference=value.match(/punto de referencia del aeródromo\s*\(([^)]+)\)/i)?.[1];
  const advance=value.match(/al menos\s*([0-9]+)\s*días hábiles/i)?.[1];
  const contact=attributes.email&&attributes.email!=='Nulo'?attributes.email:'the listed official contact';
  const place=attributes.name&&attributes.name!=='Nulo'?attributes.name:'this aerodrome area';
  return localizedOfficialText({
   en:`This is the general UAS geographical zone for operational safety around ${place}. Below ${threshold}${reference?` measured from the aerodrome reference elevation (${reference})`:''}, coordination is not required. Above that level, submit the request only through ${contact}${advance?` at least ${advance} working days before the activity`:''}; AENA will coordinate it with the tower ATS provider.`,
   de:`Dies ist das allgemeine geografische UAS-Gebiet für die Betriebssicherheit im Umfeld von ${place}. Unterhalb von ${threshold}${reference?` gemessen ab der Flugplatz-Bezugshöhe (${reference})`:''} ist keine Koordination erforderlich. Oberhalb dieser Höhe darf der Antrag nur über ${contact}${advance?` mindestens ${advance} Arbeitstage vor der Aktivität`:''} eingereicht werden; AENA koordiniert ihn mit dem ATS-Anbieter des Towers.`,
   fr:`Il s’agit de la zone géographique UAS générale établie pour la sécurité opérationnelle autour de ${place}. En dessous de ${threshold}${reference?` mesurés depuis l’altitude de référence de l’aérodrome (${reference})`:''}, aucune coordination n’est nécessaire. Au-dessus de ce niveau, envoyez la demande uniquement via ${contact}${advance?` au moins ${advance} jours ouvrables avant l’activité`:''} ; AENA la coordonnera avec le prestataire ATS de la tour.`,
   it:`Questa è la zona geografica UAS generale per la sicurezza operativa intorno a ${place}. Al di sotto di ${threshold}${reference?` misurati dalla quota di riferimento dell’aeroporto (${reference})`:''} non è richiesto alcun coordinamento. Al di sopra di tale livello, invia la richiesta esclusivamente tramite ${contact}${advance?` almeno ${advance} giorni lavorativi prima dell’attività`:''}; AENA la coordinerà con il fornitore ATS della torre.`,
   pt:`Esta é a zona geográfica UAS geral para a segurança operacional em redor de ${place}. Abaixo de ${threshold}${reference?` medidos a partir da altitude de referência do aeródromo (${reference})`:''}, não é necessária coordenação. Acima desse nível, envie o pedido apenas através de ${contact}${advance?` pelo menos ${advance} dias úteis antes da atividade`:''}; a AENA fará a coordenação com o prestador ATS da torre.`
  });
 }
 if(!/(zona geográfica|operaciones VLOS|Nivel inferior|Nivel superior)/i.test(value))return value;
 const area=value.match(/espacio aéreo controlado\s+([^.]*)\./i)?.[1]?.trim();
 const height=value.match(/altura máxima de\s*([0-9.,]+\s*m)/i)?.[1]?.trim();
 const lower=value.match(/Nivel inferior:\s*([^;]+(?:;\s*[^;]+)?)/i)?.[1]?.trim().replace(/\s*;\s*/g,' / ');
 const upper=value.match(/Nivel superior:\s*(.*?)(?=\s*Notas:|$)/i)?.[1]?.trim();
 const place=area?` ${area}`:'';
 const maximum=height??'the published maximum height';
 const summaries:Record<string,string>={
  en:`This is a general UAS geographical zone for the operational safety of controlled airspace${place}. VLOS operations are allowed up to ${maximum} outside the general aerodrome-safety zones. For any other operation, use the listed contact. AMSL heights are measured from mean sea level, not from the ground; account for terrain elevation at the flight point.`,
  de:`Dies ist ein allgemeines geografisches UAS-Gebiet für die Betriebssicherheit des kontrollierten Luftraums${place}. VLOS-Flüge sind außerhalb der allgemeinen Sicherheitszonen um Flugplätze bis ${maximum} zulässig. Für jeden anderen Betrieb ist der angegebene Kontakt zu verwenden. AMSL-Höhen beziehen sich auf den mittleren Meeresspiegel, nicht auf den Boden; die Geländehöhe am Flugort muss berücksichtigt werden.`,
  fr:`Il s’agit d’une zone géographique UAS générale établie pour la sécurité opérationnelle de l’espace aérien contrôlé${place}. Les vols VLOS sont autorisés jusqu’à ${maximum} en dehors des zones générales de sécurité autour des aérodromes. Pour toute autre opération, utilisez le contact indiqué. Les hauteurs AMSL sont mesurées depuis le niveau moyen de la mer, et non depuis le sol ; tenez compte de l’altitude du terrain.`,
  it:`Questa è una zona geografica UAS generale per la sicurezza operativa dello spazio aereo controllato${place}. Le operazioni VLOS sono consentite fino a ${maximum} al di fuori delle zone generali di sicurezza degli aeroporti. Per qualsiasi altra operazione, utilizzare il contatto indicato. Le altezze AMSL sono riferite al livello medio del mare, non al suolo; considerare l’altitudine del terreno.`,
  pt:`Esta é uma zona geográfica UAS geral para a segurança operacional do espaço aéreo controlado${place}. As operações VLOS são permitidas até ${maximum} fora das zonas gerais de segurança dos aeródromos. Para qualquer outra operação, utilize o contacto indicado. As alturas AMSL são medidas a partir do nível médio do mar, não do solo; considere a elevação do terreno.`
 };
 const limits=language()==='de'
  ?[lower&&`Untergrenze: ${lower}.`,upper&&`Obergrenze: ${upper}.`]
  :language()==='fr'
   ?[lower&&`Limite inférieure : ${lower}.`,upper&&`Limite supérieure : ${upper}.`]
   :language()==='it'
    ?[lower&&`Limite inferiore: ${lower}.`,upper&&`Limite superiore: ${upper}.`]
    :language()==='pt'
     ?[lower&&`Limite inferior: ${lower}.`,upper&&`Limite superior: ${upper}.`]
     :[lower&&`Lower limit: ${lower}.`,upper&&`Upper limit: ${upper}.`];
 return [summaries[language()]??summaries.en,...limits.filter(Boolean)].join(' ');
};
const severityFromRestriction=(value?:string):ZoneDetail['severity']=>{
 const normalized=(value??'').toUpperCase();
 if(/PROHIB/.test(normalized))return'blocked';
 if(/REQ_AUTH|AUTHORIS/.test(normalized))return'authorization';
 if(/CONDITIONAL|RESTRICT/.test(normalized))return'conditional';
 if(/WARNING|ADVISORY/.test(normalized))return'warning';
 if(/INFORMATION|NO_RESTRICTION/.test(normalized))return'information';
 return'unknown';
};
const translatePortugalMessage=(value:string)=>{
 if(!/Todas as categorias[\s\S]*autorização|All categories[\s\S]*authorisation/i.test(value))return;
 const messages:Record<string,string>={
  en:'All UAS flights in every category require authorization from Portugal’s National Aeronautical Authority (AAN).',
  de:'Alle UAS-Flüge in sämtlichen Kategorien benötigen eine Genehmigung der portugiesischen nationalen Luftfahrtbehörde AAN.',
  fr:'Tous les vols UAS, dans toutes les catégories, nécessitent l’autorisation de l’Autorité aéronautique nationale portugaise (AAN).',
  es:'Todos los vuelos UAS, en todas las categorías, requieren autorización de la Autoridad Aeronáutica Nacional portuguesa (AAN).',
  it:'Tutti i voli UAS, in ogni categoria, richiedono l’autorizzazione dell’Autorità aeronautica nazionale portoghese (AAN).',
  pt:'Todos os voos UAS, em todas as categorias, carecem de autorização da Autoridade Aeronáutica Nacional (AAN).',
  nl:'Alle UAS-vluchten in elke categorie vereisen toestemming van de Portugese nationale luchtvaartautoriteit (AAN).',
  no:'Alle UAS-flyginger i alle kategorier krever tillatelse fra Portugals nasjonale luftfartsmyndighet (AAN).',
  sv:'Alla UAS-flygningar i samtliga kategorier kräver tillstånd från Portugals nationella luftfartsmyndighet (AAN).',
  da:'Alle UAS-flyvninger i samtlige kategorier kræver tilladelse fra Portugals nationale luftfartsmyndighed (AAN).',
  fi:'Kaikki UAS-lennot kaikissa luokissa edellyttävät Portugalin kansallisen ilmailuviranomaisen (AAN) lupaa.',
  pl:'Wszystkie loty UAS we wszystkich kategoriach wymagają zezwolenia portugalskiego krajowego organu lotniczego (AAN).',
  cs:'Všechny lety UAS ve všech kategoriích vyžadují povolení portugalského národního leteckého úřadu (AAN).'
 };
 return messages[language()]??messages.en;
};
const portugalLegalReference=()=>{
 const references:Record<string,string>={
  en:'Portuguese geozones under Regulation No. 1093/2016 of 14 December',
  de:'Portugiesische Geozonen gemäß Verordnung Nr. 1093/2016 vom 14. Dezember',
  fr:'Zones géographiques portugaises conformément au règlement nº 1093/2016 du 14 décembre',
  es:'Zonas geográficas portuguesas conforme al Reglamento n.º 1093/2016 de 14 de diciembre',
  it:'Zone geografiche portoghesi ai sensi del regolamento n. 1093/2016 del 14 dicembre',
  pt:'Zonas geográficas portuguesas nos termos do Regulamento n.º 1093/2016, de 14 de dezembro',
  nl:'Portugese geografische zones volgens Verordening nr. 1093/2016 van 14 december',
  no:'Portugisiske geografiske soner i henhold til forskrift nr. 1093/2016 av 14. desember',
  sv:'Portugisiska geografiska zoner enligt förordning nr 1093/2016 av den 14 december',
  da:'Portugisiske geografiske zoner i henhold til forordning nr. 1093/2016 af 14. december',
  fi:'Portugalin maantieteelliset vyöhykkeet 14. joulukuuta annetun asetuksen nro 1093/2016 mukaisesti',
  pl:'Portugalskie strefy geograficzne zgodnie z rozporządzeniem nr 1093/2016 z 14 grudnia',
  cs:'Portugalské zeměpisné zóny podle nařízení č. 1093/2016 ze dne 14. prosince'
 };
 return references[language()]??references.en;
};
const base=(code:string,name:string,sourceName:string,sourceUrl:string):ZoneInfo=>({countryCode:code,countryName:name,sourceName,sourceUrl,status:'none',zones:[],checkedAt:new Date().toISOString(),warning:'This is planning information, not legal clearance. Check the official source before takeoff.'});
const geoJsonCache=new Map<string,Promise<any>>();
const fetchGeoJson=(url:string)=>{let pending=geoJsonCache.get(url);if(!pending){pending=fetch(url).then(response=>{if(!response.ok)throw new Error(`Zone file unavailable: ${response.status}`);return response.json()}).catch(error=>{geoJsonCache.delete(url);throw error});geoJsonCache.set(url,pending)}return pending};
const severityRank:Record<NonNullable<ZoneDetail['severity']>,number>={blocked:0,authorization:1,conditional:2,warning:3,information:4,unknown:5};
const sortZones=(zones:ZoneDetail[])=>zones.sort((a,b)=>severityRank[a.severity??'unknown']-severityRank[b.severity??'unknown']||a.name.localeCompare(b.name));

async function dipul(point:Location,requestLanguage=language()):Promise<ZoneInfo>{
 const directUrl=`https://maptool-dipul.dfs.de/geozones/@${point.lng.toFixed(7)},${point.lat.toFixed(7)}?language=${requestLanguage==='de'?'de':'en'}&zoom=11.0`,result=base('DE',requestLanguage==='de'?'Deutschland':'Germany','DIPUL',directUrl);
 // Keep the GetFeatureInfo pixel centered on the chosen coordinate at sub-metre scale.
 // A city-sized bbox made one 256px pixel cover ~30m and reported nearby features as hits.
 const d=.0005,bbox=`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d}`,layers=DIPUL_LAYERS.map(x=>`dipul:${x}`).join(',');
 const params=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',LAYERS:layers,QUERY_LAYERS:layers,STYLES:'',SRS:'EPSG:4326',BBOX:bbox,WIDTH:'256',HEIGHT:'256',X:'128',Y:'128',INFO_FORMAT:'text/plain',FEATURE_COUNT:'50'});
 const response=await fetch(`https://uas-betrieb.de/geoservices/dipul/wms?${params}`,{signal:AbortSignal.timeout(18000)});if(!response.ok)throw new Error('DIPUL query failed');
 const text=await response.text();
 if(/ServiceException|ExceptionReport/i.test(text))throw new Error('DIPUL returned a service error');
 const blocks=text.split(/Results for FeatureType/).slice(1).filter(block=>/^\s*[^=\n]+ = .+/m.test(block));
 result.zones=sortZones(blocks.map((block,index)=>{
  const attrs=Object.fromEntries(block.split('\n').map(line=>line.match(/^([^=]+) = (.*)$/)).filter(Boolean).map(match=>[match![1].trim(),match![2].trim()]));
  const attr=(key:string)=>Object.entries(attrs).find(([name])=>name.toLowerCase()===key.toLowerCase())?.[1];
  const layer=(block.match(/'[^:]+:([^']+)'/)?.[1]??'zone'),rawType=attr('type_code')??layer.toUpperCase(),type=translate(rawType,requestLanguage),localizedName=attr(`generated_name_${requestLanguage}`),englishName=attr('generated_name_en'),officialName=localizedName??englishName??attr('name');
  const severe=/FLUGBESCHRAENK|TEMPORAERE/i.test(rawType),severity:ZoneDetail['severity']=severe?'blocked':attrs.legal_ref?'authorization':'warning';
  const originalMessage=attrs.message??attrs.description;
  return{id:`DE-${index}-${attrs.external_reference??layer}`,name:officialName??`${type} · ${layer.replaceAll('_',' ')}`,originalName:attr('name')??officialName,nameLocalizedLanguage:localizedName?requestLanguage:englishName?'en':undefined,type,categoryCode:rawType,severity,explanation:zoneExplanation(layer,rawType,requestLanguage),message:originalMessage??`Official DIPUL classification: ${type}.`,originalMessage,messageLocalizedLanguage:originalMessage?undefined:'en',lower:attrs.lower_limit_altitude?`${attrs.lower_limit_altitude} ${attrs.lower_limit_unit??''} ${attrs.lower_limit_alt_ref??''}`:undefined,upper:attrs.upper_limit_altitude?`${attrs.upper_limit_altitude} ${attrs.upper_limit_unit??''} ${attrs.upper_limit_alt_ref??''}`:undefined,legalReference:attrs.legal_ref,authority:'DIPUL / DFS',officialLayerName:layer.replaceAll('_',' '),layerCode:layer,source:'DIPUL',sourceUrl:directUrl} as ZoneDetail;
 }));
 result.status=result.zones.length?'loaded':'none';return result;
}

async function enaire(point:Location):Promise<ZoneInfo>{
 const result=base('ES',language()==='es'?'España':'Spain','ENAIRE servAIS','https://drones.enaire.es/'),d=.12;
 const params=new URLSearchParams({geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',sr:'4326',tolerance:'3',mapExtent:`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d}`,imageDisplay:'800,600,96',layers:'all:0,2,3',returnGeometry:'false',f:'json'});
 const response=await fetch(`https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V1/MapServer/identify?${params}`);
 if(!response.ok)throw new Error('ENAIRE query failed');
 const data=await response.json();
 const defaultFlightAltitudeM=120;
 const visibleResults=(data.results??[]).filter((item:any)=>{
  const attributes=item.attributes??{},lower=Number(attributes.lower);
  const isRestrictedAltitudeBand=/R-Restringida/i.test(String(attributes.extendedProperties??''))||/^GCR/i.test(String(attributes.identifier??''));
  return !isRestrictedAltitudeBand||!Number.isFinite(lower)||lower<defaultFlightAltitudeM;
 });
 result.zones=sortZones(visibleResults.map((item:any,index:number)=>{
  const a=item.attributes??{},rawType=a.type||a.restriction||'COMMON',rawMessage=cleanHtml(a.message||a.description),message=translateEnaireMessage(rawMessage,a),rawName=cleanHtml(a.name&&a.name!=='Nulo'?a.name:item.value||item.layerName),translatedName=translateEnaireName(rawName);
  const authority=[a.name_authority,a.provider].find((value:unknown)=>typeof value==='string'&&value.trim()&&!/^nulo$/i.test(value.trim())) as string|undefined;
  return{id:`ES-${item.layerId}-${a.OBJECTID??index}`,name:translatedName,originalName:rawName,nameLocalizedLanguage:translatedName!==rawName?language():undefined,type:translate(rawType),categoryCode:rawType,severity:severityFromRestriction(rawType),message:message.slice(0,2400),originalMessage:rawMessage||undefined,messageLocalizedLanguage:rawMessage&&(language()==='es'||message!==rawMessage)?language():undefined,lower:a.lower!=null?`${a.lower} ${a.uom??''} ${a.lowerReference??''}`:undefined,upper:a.upper!=null?`${a.upper} ${a.uom??''} ${a.upperReference??''}`:undefined,legalReference:a.siteURL&&a.siteURL!=='Nulo'?a.siteURL:undefined,contact:[a.email,a.phone].filter((x:string)=>x&&x!=='Nulo').join(' · ')||undefined,authority:authority??'ENAIRE / AESA',officialLayerName:item.layerName,layerCode:rawType,source:'ENAIRE',sourceUrl:'https://drones.enaire.es/',updated:a.updateDateTime||undefined} as ZoneDetail;
 }));
 result.status=result.zones.length?'loaded':'none';return result;
}

async function france(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.FR,result=base('FR',source.name,source.source,source.url),d=.02;
 const params=new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:'TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf',OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',BBOX:`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d},EPSG:4326`,COUNT:'500'});
 const data=await fetchGeoJson(`https://data.geopf.fr/wfs/ows?${params}`);
 result.zones=sortZones((data.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{
  const properties=feature.properties??{},officialName=properties.limite as string|undefined,remark=properties.remarque as string|undefined,summary=(remark??'').replace(/\s+/g,' ').trim(),name=officialName??(summary?`Restriction UAS · ${summary.slice(0,72)}${summary.length>72?'…':''}`:'Restriction UAS publiée par Géoportail'),raw=`${officialName??''} ${summary}`,severity:ZoneDetail['severity']=/interdit/i.test(raw)?'blocked':/autorisation|notification|obligatoire/i.test(raw)?'authorization':'conditional';
  return{id:feature.id??`FR-${index}`,name,originalName:officialName,type:officialName??'Restriction UAS',severity,message:summary||'The official Géoportail layer identifies a UAS restriction at this point.',pilotAction:'Verify this point on Géoportail and check SIA and current NOTAMs before flying.',authority:'IGN / Géoportail',officialLayerName:'Restrictions UAS catégorie ouverte et aéromodélisme',source:source.source,sourceUrl:source.url,updated:'2025-07-01'} as ZoneDetail;
 }));
 result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}

const contains=geometryContains;
async function luxembourg(point:Location):Promise<ZoneInfo>{const result=base('LU','Luxembourg','DAC Luxembourg','https://g-o.lu/uas');const response=await fetch(`${import.meta.env.BASE_URL}data/zones/LU.geojson`);if(!response.ok)throw new Error('Offline Luxembourg pack missing');const data=await response.json();result.zones=data.features.filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties;return{id:p.id??`LU-${index}`,name:p.name??'Luxembourg UAS zone',type:translate(p.restriction??p.type??'COMMON'),message:(p.reasons??[]).join(', '),lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.unit??'M'} ${p.lowerReference??''}`:undefined,upper:p.upperLimit!=null?`${p.upperLimit} ${p.unit??'M'} ${p.upperReference??''}`:undefined,contact:p.authority,source:'DAC Luxembourg',updated:p.updated}});result.status=result.zones.length?'loaded':'none';return result}
async function ireland(point:Location):Promise<ZoneInfo>{const result=base('IE','Ireland','Irish Aviation Authority','https://www.iaa.ie/general-aviation/drones/uas-geographic-zones');const response=await fetch(`${import.meta.env.BASE_URL}data/zones/IE.geojson`);if(!response.ok)throw new Error('Ireland zone file missing');const data=await response.json();result.zones=data.features.filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties,authority=(p.zoneAuthority??[])[0]??{};return{id:p.identifier??`IE-${index}`,name:p.name??'Ireland UAS geographical zone',type:translate(p.type??'COMMON'),message:[p.restrictionConditions,p.message].filter(Boolean).join(' · '),legalReference:p.regulationExemption??undefined,contact:[authority.name,authority.service,authority.email,authority.phone].filter(Boolean).join(' · ')||undefined,source:'Irish Aviation Authority'}});result.status=result.zones.length?'loaded':'none';return result}
async function uk(point:Location):Promise<ZoneInfo>{const source=COUNTRY_SOURCES.GB,result=base('GB',source.name,source.source,source.url),data=await fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/GB.geojson`);result.zones=(data.features??[]).filter((feature:any)=>isUkDroneRelevant(feature.properties??{})&&contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:p.identifier??`GB-${index}`,name:p.name??'UK UAS restriction',type:p.category??'UAS restriction',message:p.description,lower:p.lower,upper:p.upper,source:source.source,updated:p.effective}});result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result}
async function bundledNationalGeozones(point:Location,code:'NL'|'FI'|'EE'|'AX'):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES[code],result=base(code,source.name,source.source,source.url);
 const data=await fetchGeoJson(code==='EE'?'https://utm.eans.ee/avm/utm/uas.geojson':`${import.meta.env.BASE_URL}data/zones/${code==='AX'?'FI':code}.geojson`);
 result.zones=(data.features??[]).filter((feature:any)=>feature.properties?.identifier!=='EERZout'&&contains(point,feature.geometry)).map((feature:any,index:number)=>{
  const p=feature.properties??{},authority=(p.zoneAuthority??[])[0]??{};
  const reasons=Array.isArray(p.reason)?p.reason.join(', '):p.reason;
  return{id:p.identifier??`${code}-${index}`,name:p.name??`${source.name} UAS zone`,type:translate(p.restriction??p.type??'COMMON'),message:[reasons,p.restrictionConditions,p.message].filter(Boolean).join(' · '),lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.uomDimensions??'M'} ${p.lowerVerticalReference??''}`:p.lower,upper:p.upperLimit!=null?`${p.upperLimit} ${p.uomDimensions??'M'} ${p.upperVerticalReference??''}`:p.upper,legalReference:p.regulationExemption??undefined,contact:[p.authorityName??authority.name,p.authorityService??authority.service,p.authorityEmail??authority.email,p.authorityPhone??authority.phone].filter(Boolean).join(' · ')||undefined,source:source.source,updated:data.generatedAt};
 });
 result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}
async function portugal(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.PT,result=base('PT',source.name,source.source,source.url);
 const data=normalizeEd269(await fetchGeoJson(await latestPortugalEd269Url()));
 result.zones=(data.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{
  const p=feature.properties??{},reasons=Array.isArray(p.reason)?p.reason.join(', '):p.reason,rawType=p.restriction??p.type??'COMMON',rawMessage=[reasons,p.otherReasonInfo,p.message].filter(Boolean).join(' · '),localizedMessage=translatePortugalMessage(rawMessage);
  return{id:p.identifier??`PT-${index}`,name:p.name??'Portugal UAS geographical zone',originalName:p.name,type:translate(rawType),categoryCode:rawType,severity:severityFromRestriction(rawType),message:localizedMessage??rawMessage,originalMessage:rawMessage||undefined,messageLocalizedLanguage:localizedMessage?language():undefined,lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.uomDimensions??'M'} ${p.lowerVerticalReference??''}`:undefined,upper:p.upperLimit!=null?`${p.upperLimit} ${p.uomDimensions??'M'} ${p.upperVerticalReference??''}`:undefined,legalReference:portugalLegalReference(),contact:[p.authorityName,p.authorityService,p.authorityEmail,p.authorityPhone].filter(Boolean).join(' · ')||undefined,authority:p.authorityName,source:source.source,sourceUrl:source.url};
 });
 result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}
async function unitedStates(point:Location,code:'US'|'AS'='US'):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES[code],result=base(code,source.name,source.source,source.url);
 const facilityParams=new URLSearchParams({where:'1=1',geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,CEILING,UNIT,MAP_EFF,LAST_EDIT,APT1_FAAID,APT1_ICAO,APT1_NAME,APT1_LAANC,AIRSPACE_1,REGION',returnGeometry:'false',f:'json'});
 const classParams=new URLSearchParams({where:"(CLASS IN ('B','C','D') OR CLASS = 'E') AND LOWER_DESC = 'SFC'",geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,NAME,CLASS,LOWER_DESC,LOWER_VAL,LOWER_UOM,UPPER_DESC,UPPER_VAL,UPPER_UOM',returnGeometry:'false',f:'json'});
 const specialParams=new URLSearchParams({where:"TYPE_CODE IN ('R','P')",geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,NAME,TYPE_CODE,CLASS,LOWER_DESC,LOWER_VAL,LOWER_UOM,UPPER_DESC,UPPER_VAL,UPPER_UOM',returnGeometry:'false',f:'json'});
 const [facilityResponse,classResponse,specialResponse]=await Promise.all([fetch(`${FAA_US_FACILITIES}?${facilityParams}`),fetch(`${FAA_US_CLASS_AIRSPACE}?${classParams}`),fetch(`${FAA_US_SPECIAL_USE}?${specialParams}`)]);
 if(!facilityResponse.ok||!classResponse.ok||!specialResponse.ok)throw new Error('FAA airspace query failed');
 const [facilityData,classData,specialData]=await Promise.all([facilityResponse.json(),classResponse.json(),specialResponse.json()]);
 result.zones=[
  ...(classData.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{};return{id:`US-AIRSPACE-${p.OBJECTID??index}`,name:p.NAME??`Class ${p.CLASS} airspace`,type:`Class ${p.CLASS} controlled airspace`,severity:'authorization' as const,message:'FAA chart data identifies controlled airspace beginning at the surface. Confirm the applicable authorization in B4UFLY and check current TFRs and NOTAMs.',lower:p.LOWER_VAL!=null?`${p.LOWER_VAL} ${p.LOWER_UOM??''} ${p.LOWER_DESC??''}`.trim():p.LOWER_DESC,upper:p.UPPER_VAL!=null?`${p.UPPER_VAL} ${p.UPPER_UOM??''} ${p.UPPER_DESC??''}`.trim():p.UPPER_DESC,source:'FAA AIS Class Airspace',sourceUrl:'https://www.faa.gov/uas/getting_started/b4ufly'}}),
  ...(specialData.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{},prohibited=String(p.TYPE_CODE).toUpperCase()==='P';return{id:`US-SUA-${p.OBJECTID??index}`,name:p.NAME??(prohibited?'Prohibited area':'Restricted area'),type:prohibited?'FAA prohibited area':'FAA restricted area',severity:prohibited?'blocked' as const:'authorization' as const,message:'Review this area’s vertical limits and activation schedule, then check current FAA NOTAMs before flight.',lower:p.LOWER_VAL!=null?`${p.LOWER_VAL} ${p.LOWER_UOM??''} ${p.LOWER_DESC??''}`.trim():p.LOWER_DESC,upper:p.UPPER_VAL!=null?`${p.UPPER_VAL} ${p.UPPER_UOM??''} ${p.UPPER_DESC??''}`.trim():p.UPPER_DESC,source:'FAA AIS Special Use Airspace',sourceUrl:'https://ais-faa.opendata.arcgis.com/datasets/dd0d1b726e504137ab3c41b21835d05b_0'}}),
  ...(facilityData.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{};return{id:`US-${p.OBJECTID??index}`,name:p.APT1_NAME??p.APT1_ICAO??'FAA UAS Facility Map grid',type:`${p.CEILING??0} ${p.UNIT??'Feet'} authorization ceiling`,message:p.APT1_LAANC?'LAANC-enabled facility grid. This value is not an authorization.':'Facility-map planning grid. This value is not an authorization.',upper:`${p.CEILING??0} ${p.UNIT??'Feet'} AGL`,source:'FAA UAS Facility Maps',sourceUrl:'https://www.faa.gov/uas/commercial_operators/uas_facility_maps',updated:p.MAP_EFF??p.LAST_EDIT}})
 ];
 result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}
const distanceKm=(a:Location,b:{lat:number;lng:number})=>{const radius=6371,toRad=(value:number)=>value*Math.PI/180,dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),lat1=toRad(a.lat),lat2=toRad(b.lat);const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;return radius*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h))};
async function canada(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.CA,result=base('CA',source.name,source.source,source.url),d=.12;
 const airportParams=new URLSearchParams({where:'1=1',geometry:`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d}`,geometryType:'esriGeometryEnvelope',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outSR:'4326',outFields:'OBJECTID,TC_ID,IATA,ICAO,TYPE,AIRPORT,CITY,PROVINCE,LATTITUDE,LONGITUDE',returnGeometry:'true',f:'json'});
 const parkParams=new URLSearchParams({where:'1=1',geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,adminAreaId,adminAreaNameEng,adminAreaNameFra,distributionTypeEng,jurisdictionEng,webReference',returnGeometry:'false',f:'json'});
 const [airportResponse,parkResponse]=await Promise.all([
  fetch(`https://maps-cartes.services.geo.ca/server_serveur/rest/services/TC/canadian_airports_w_air_navigation_services_en/MapServer/0/query?${airportParams}`),
  fetch(`https://proxyinternet.nrcan-rncan.gc.ca/arcgis/rest/services/CLSS-SATC/CLSS_Administrative_Boundaries/MapServer/1/query?${parkParams}`)
 ]);
 if(!airportResponse.ok||!parkResponse.ok)throw new Error('Government of Canada open-data query failed');
 const [airportData,parkData]=await Promise.all([airportResponse.json(),parkResponse.json()]);
 const airports=(airportData.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{},coordinates=feature.geometry??{},lat=Number(coordinates.y??p.LATTITUDE),lng=Number(coordinates.x??p.LONGITUDE),distance=distanceKm(point,{lat,lng});return{distance,zone:{id:`CA-AIRPORT-${p.OBJECTID??index}`,name:p.AIRPORT??p.ICAO??'Canadian airport',type:'5.6 km airport proximity indicator (not a legal zone)',severity:'information' as const,message:`${p.TYPE??'Airport'}${p.CITY?` · ${p.CITY}, ${p.PROVINCE}`:''}. Approximately ${distance.toFixed(1)} km from this airport in Transport Canada’s air-navigation-services dataset. This open dataset may omit certified airports and heliports; this radius is only an orientation aid. Check the NRC tool for the exact applicable restriction.`,source:'Transport Canada Open Government'}}}).filter((item:any)=>Number.isFinite(item.distance)&&item.distance<=5.6).map((item:any)=>item.zone);
 const parks=(parkData.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{};return{id:`CA-PARK-${p.OBJECTID??index}`,name:(language()==='fr'?p.adminAreaNameFra:p.adminAreaNameEng)||p.adminAreaNameEng||'Canadian national park',type:'National park or national park reserve',message:'Drone take-off and landing in Parks Canada places is restricted. Check the park authority and the official Drone Site Selection Tool before flight.',legalReference:p.webReference,source:'Natural Resources Canada / Parks Canada'}});
 result.zones=[...airports,...parks];
 result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}
async function denmark(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.DK,result=base('DK',source.name,source.source,source.url);
 const [zones,nature]=await Promise.all([fetchGeoJson('https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/980697acd04d4a9bb1fd34bbefab924a/data'),fetchGeoJson('https://trafikstyrelsen.maps.arcgis.com/sharing/rest/content/items/ff657943724944faaf19807380f5e24a/data')]);
 const matches=[...(zones.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:`DK-${p.OBJECTID??index}`,name:p.title??p.typeId??'Danish drone zone',type:p.Farve==='1'?'Flight-safety critical':p.Farve==='4'?'Security critical':p.Farve==='5'?'Attention area':'Drone zone',message:[p.typeId,p.Bufferzone,p.Kommentar].filter(Boolean).join(' · '),source:source.source}}),...(nature.features??[]).filter((feature:any)=>feature.properties?.Aktiv==='JA'&&contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:`DK-NATURE-${p.OBJECTID??index}`,name:p.Fuglebeskyttelsesområder_og_Hab??p.Temanavn??'Active nature zone',type:'Active nature zone',message:[p.Restriktionsperiode_,p.Årsag__].filter(Boolean).join(' · '),source:source.source}})];
 result.zones=matches;result.status=matches.length?'loaded':'none';result.warning=source.warning;return result;
}

async function resolvedCountryAt(point:Location):Promise<CountryCode>{
 const initial=countryAt(point);
 const northAmericaOverlap=initial==='US'&&point.lat>=41&&point.lat<=50&&point.lng>=-141&&point.lng<=-52;
 // A hit from an explicit territory/country boundary is stronger than reverse geocoding.
 // Use reverse lookup only for unknown points and the US/Canada overlap.
 if(initial!=='XX'&&!northAmericaOverlap)return initial;
 try{
  const response=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${point.lat}&lon=${point.lng}&zoom=3&format=json&accept-language=en`);
  if(!response.ok)return initial;
  const country=String((await response.json()).address?.country_code??'').toUpperCase();
  if(['GF','GP','MQ','RE','YT','PM','TF'].includes(country))return'FR';
  if(['PR','VI','GU','MP','UM'].includes(country))return'US';
  if(country in COUNTRY_SOURCES||['DE','ES','LU','IE'].includes(country))return country as CountryCode;
 }catch{return initial}
 return initial;
}

async function switzerland(point:Location,code:'CH'|'LI'='CH',requestLanguage=language()):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES[code];
 const query=`${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
 const url=`https://map.geo.admin.ch/#/map?lang=${encodeURIComponent(['de','fr','it','rm','en'].includes(requestLanguage)?requestLanguage:'en')}&topic=ech&layers=ch.bazl.einschraenkungen-drohnen&swisssearch=${encodeURIComponent(query)}&swisssearch_autoselect=true&z=9`;
 const result=base(code,source.name,source.source,url);
 const [raw,metadata]=await Promise.all([fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/CH.geojson`),fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/CH.meta.json`).catch(()=>({}))]);
 const data=currentZones(raw);
 result.zones=(data.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:p.identifier??`CH-${index}`,name:p.name||'Swiss UAS geographical zone',type:translate(p.restriction??p.type??'COMMON',requestLanguage),categoryCode:p.restriction,severity:severityFromRestriction(p.restriction??''),message:[p.reason,p.otherReasonInfo,p.restrictionConditions,p.message].filter(Boolean).join(' · '),explanation:zoneExplanation(p.restriction,p.reason,requestLanguage),messageLocalizedLanguage:'en',validFrom:p.startDateTime,validUntil:p.endDateTime,authority:p.authorityName,sourceUrl:p.siteURL||url,lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.uomDimensions??'M'} ${p.lowerVerticalReference??''}`:undefined,upper:p.upperLimit!=null?`${p.upperLimit} ${p.uomDimensions??'M'} ${p.upperVerticalReference??''}`:undefined,contact:[p.authorityName,p.service,p.email,p.phone].filter(Boolean).join(' · ')||undefined,source:source.source,updated:metadata.checkedAt}});result.status=result.zones.length?'loaded':'none';result.warning=`${source.warning} Snapshot checked: ${metadata.checkedAt??'unknown'}.`;return result;
}

const importedDetails=(imported:any[],requestedLanguage:string):ZoneDetail[]=>imported.map((feature:any,index:number)=>{const p=feature.properties??{},validity=zoneValidity(p),authority=p.zoneAuthority?.[0]??{},localized=p.extendedProperties?.localizedMessages?.find((m:any)=>String(m.language).split('-')[0]===requestedLanguage.split('-')[0]),english=p.extendedProperties?.localizedMessages?.find((m:any)=>m.language==='en');return{id:`local-${feature.id??p.identifier??index}-${index}`,name:((localized?.message??english?.message)?.split(':')[0]??p.name??p.zoneName??'Imported UAS zone'),originalName:p.name,nameLocalizedLanguage:localized?requestedLanguage.split('-')[0]:english?'en':undefined,type:translate(p.restriction??p.type??p.category??'COMMON'),categoryCode:p.restriction,severity:severityFromRestriction(p.restriction??''),explanation:zoneExplanation(p.restriction,p.reason,requestedLanguage),message:localized?.message??english?.message??[p.reason,p.otherReasonInfo,p.restrictionConditions,p.message??p.description].filter(Boolean).join(' · '),messageLocalizedLanguage:localized?requestedLanguage.split('-')[0]:english?'en':undefined,legalReference:p.extendedProperties?.legalBasis,validFrom:validity.startDateTime,validUntil:validity.endDateTime,activation:validity.schedule?.map((schedule:any)=>`${(schedule.day??[]).join(', ')} ${schedule.startTime??''}–${schedule.endTime??''}`).join(' · '),lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.uomDimensions??'M'} ${p.lowerVerticalReference??''}`:p.lower,upper:p.upperLimit!=null?`${p.upperLimit} ${p.uomDimensions??'M'} ${p.upperVerticalReference??''}`:p.upper,authority:p.authorityName??authority.name,contact:[p.email??authority.email,p.phone??authority.phone].filter(Boolean).join(' · '),source:`Local import · ${p._localName}`,updated:p._localImportedAt} as ZoneDetail});
export async function getImportedZoneInfo(point:Location,requestedLanguage='en'):Promise<ZoneInfo|undefined>{
 const code=dachCountry(point)??countryAt(point),packs=await localZonePacks();
 const matches=await localZonesAt(point,aroundBodensee(point)||code==='XX'?undefined:code);
 const pack=packs.find(pack=>pack.code===code)??packs.find(pack=>matches.some(f=>f.properties._localCountry===pack.code));
 if(!pack)return undefined;
 const zones=importedDetails(matches,requestedLanguage);
 return localizeZoneInfo({...base(pack.code,pack.code,`Local import · ${pack.name}`,COUNTRY_SOURCES[pack.code as keyof typeof COUNTRY_SOURCES]?.url??'#'),zones,status:zones.length?'loaded':'none',warning:`Locally imported file, saved ${pack.importedAt}. Check source validity and temporary restrictions. Other live sources are unavailable offline.`},requestedLanguage);
}

export async function getOfficialZoneInfo(point:Location,requestedLanguage=language()):Promise<ZoneInfo>{
 selectedLanguage=requestedLanguage.toLowerCase().split('-')[0]||'en';
 const code=await resolvedCountryAt(point);
 const hasAustriaPack=(await localZonePacks().catch(()=>[])).some(pack=>pack.code==='AT');
 const imported=await localZonesAt(point,aroundBodensee(point)||code==='XX'?undefined:code).catch(()=>[]);
 const localDetails=importedDetails(imported,requestedLanguage);
 try{
  let result:ZoneInfo;
  if(aroundBodensee(point)){
   const checks=await Promise.allSettled([dipul(point,requestedLanguage),switzerland(point,'CH',requestedLanguage)]);
   const successful=checks.flatMap(check=>check.status==='fulfilled'?[check.value]:[]);
   const zones=sortZones([...successful.flatMap(check=>check.zones),...localDetails]);
   const incomplete=checks.some(check=>check.status==='rejected')||((code==='AT'||code==='XX')&&!hasAustriaPack);
   const coverage=hasAustriaPack?'Germany · Switzerland · Austrian local file':'Germany · Switzerland; Austrian file not loaded';
   result={...base(code,code==='XX'?'Bodensee / Lake Constance border area':COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES]?.name??code,'Germany · Switzerland · local imports',COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES]?.url??COUNTRY_SOURCES.CH.url),zones,status:zones.length?'loaded':incomplete?'error':'none',warning:`Border check (${coverage}): zone boundaries are tested against this exact coordinate. ${incomplete?'Some source coverage is unavailable. ':''}Lake boundaries are indicative; confirm jurisdiction and temporary restrictions before flight.`};
  }
  else if(code==='AT'&&hasAustriaPack)result={...base('AT','Austria','Local Austro Control import',COUNTRY_SOURCES.AT.url),zones:localDetails,status:localDetails.length?'loaded':'none',warning:'Locally imported Austrian zone file. Check its validity and current temporary restrictions.'};
  else if(code==='DE')result=await dipul(point,requestedLanguage);
  else if(code==='ES')result=await enaire(point);
  else if(code==='FR'||['GF','GP','MQ','RE','YT','PM','TF'].includes(code))result=await france(point);
  else if(code==='LU')result=await luxembourg(point);
  else if(code==='IE')result=await ireland(point);
  else if(code==='GB')result=await uk(point);
  else if(code==='NL'||code==='FI'||code==='EE'||code==='AX')result=await bundledNationalGeozones(point,code);
  else if(code==='PT')result=await portugal(point);
  else if(code==='DK')result=await denmark(point);
  else if(code==='CH'||code==='LI')result=await switzerland(point,code,requestedLanguage);
  else if(code==='US'||code==='AS')result=await unitedStates(point,code);
  else if(code==='CA')result=await canada(point);
  else if(code in COUNTRY_SOURCES){const source=COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES];result={...base(code,source.name,source.source,source.url),status:'unsupported',warning:source.warning}}
  else result={...base(code,'Unknown','Official source directory','#'),status:'unsupported'};
  if(!aroundBodensee(point)&&code!=='AT'&&localDetails.length){if(result.status==='unsupported'){result.sourceName='Local zone import';result.countryCode=imported[0].properties._localCountry;result.countryName=result.countryCode;result.warning='Locally imported zone file. Verify current source conditions.'}result.zones=sortZones([...result.zones,...localDetails]);result.status='loaded'}
  return localizeZoneInfo(result,requestedLanguage);
 }catch{
  const source=code in COUNTRY_SOURCES?COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES]:undefined;
  if(localDetails.length)return localizeZoneInfo({...base(code,source?.name??code,'Local zone import',source?.url??'#'),zones:localDetails,status:'loaded',warning:'Live source unavailable. Showing locally imported boundaries; check file validity and temporary restrictions.'},requestedLanguage);
  return localizeZoneInfo({...base(code,source?.name??code,source?.source??'Official source directory',source?.url??'#'),status:'error',warning:source?.warning??'The official source could not be reached. Check it directly before flight.'},requestedLanguage);
 }
}
