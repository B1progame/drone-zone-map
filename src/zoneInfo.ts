import type { Location, ZoneDetail, ZoneInfo } from './types';
import { latestPortugalEd269Url, normalizeEd269 } from './data/ed269';

const DIPUL_LAYERS=['bahnanlagen','behoerden','binnenwasserstrassen','bundesautobahnen','bundesstrassen','diplomatische_vertretungen','ffh-gebiete','flugbeschraenkungsgebiete','flughaefen','flugplaetze','freibaeder','haengegleiter','industrieanlagen','internationale_organisationen','justizvollzugsanstalten','kontrollzonen','kraftwerke','krankenhaeuser','labore','militaerische_anlagen','modellflugplaetze','nationalparks','naturschutzgebiete','polizei','schifffahrtsanlagen','seewasserstrassen','sicherheitsbehoerden','stromleitungen','temporaere_betriebseinschraenkungen','umspannwerke','vogelschutzgebiete','windkraftanlagen','wohngrundstuecke'];
let selectedLanguage=(navigator.language||'en').toLowerCase().split('-')[0];
const language=()=>selectedLanguage;
const COUNTRY_SOURCES={
 GB:{name:'United Kingdom',source:'NATS UK AIS',url:'https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/',warning:'Official permanent NATS UAS restrictions render from the current AIRAC visualization dataset. Check the UK AIP and current NOTAMs before flight.'},
 FR:{name:'France',source:'IGN / Géoportail',url:'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme',warning:'The official IGN restrictions render and are queried from the published WFS for metropolitan and covered overseas territories. The dataset does not include temporary restrictions; check SIA before flight.'},
 SE:{name:'Sweden',source:'LFV Dronechart',url:'https://dronechart.lfv.se/',warning:'Official LFV vectors render on the map with the published ground-level filters. Check LFV and current NOTAMs before flight.'},
 DK:{name:'Denmark',source:'Trafikstyrelsen Dronezoner',url:'https://www.droneregler.dk/dronezoner',warning:'Official static drone-zone data is loaded from Trafikstyrelsen. Check Dronezoner for temporary changes before flight.'},
 NO:{name:'Norway',source:'Avinor drone map',url:'https://www.avinor.no/en/practical-info/drone/dronekart/',warning:'Avinor prohibits presenting its service data in another application, so Aeris links to the official map instead of copying its zones.'},
 CH:{name:'Switzerland',source:'FOCA / geo.admin.ch',url:'https://map.geo.admin.ch/#/map?lang=en&topic=ech&layers=ch.bazl.einschraenkungen-drohnen',warning:'Complete public FOCA geographical UAS zones render live. Cantonal rules and temporary restrictions can still apply.'},
 AT:{name:'Austria',source:'Austro Control Dronespace',url:'https://map.dronespace.at/',warning:'Austro Control does not expose a verified reusable zone feed here. Open the official Dronespace map for the selected area.'},
 US:{name:'United States',source:'FAA UAS Facility Maps',url:'https://www.faa.gov/uas/getting_started/b4ufly',warning:'FAA UAS Facility Map grids render live and show pre-coordinated authorization altitudes, not permission or every restriction. Check B4UFLY and current TFRs.'},
 CA:{name:'Canada',source:'Government of Canada Open Data',url:'https://nrc.canada.ca/en/drone-tool-2/map.html',warning:'Aeris renders reusable federal airport and national-park data. The NRC confirms its NAV CANADA-derived database cannot be redistributed; use the official Drone Site Selection Tool for the complete check.'},
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
 HR:{name:'Croatia',source:'Croatia Control AMC Portal',url:'https://amc.crocontrol.hr/',warning:'Croatian UAS zones and current airspace use are managed through the registered AMC Portal workflow.'},
 SI:{name:'Slovenia',source:'Civil Aviation Agency',url:'https://www.caa.si/geografske-omejitve-za-uas.html',warning:'The public CAA ArcGIS map is inventoried, but its geometry is not copied because no reuse licence was stated.'},
 LV:{name:'Latvia',source:'LGS / Civil Aviation Agency',url:'https://www.airspace.lv/drones/en',warning:'The official Latvian map updates every five minutes. No stable reusable download was verified, so use it directly.'},
 LT:{name:'Lithuania',source:'Oro Navigacija / Lithuania Drone Map',url:'https://utm.ans.lt/',warning:'All approved Lithuanian geozones and temporary restrictions are published in the registered UTM platform.'},
 AU:{name:'Australia',source:'CASA Drone Safety',url:'https://www.casa.gov.au/knowyourdrone/drone-safety-apps',warning:'CASA directs pilots to verified planning apps. Aeris does not bypass the authenticated provider data service.'},
 NZ:{name:'New Zealand',source:'CAA New Zealand / AirShare',url:'https://www.airshare.co.nz/',warning:'CAA directs pilots to AirShare for current low-flying, aerodrome, control, restricted, military, and danger areas.'},
 JP:{name:'Japan',source:'MLIT DIPS 2.0',url:'https://www.mlit.go.jp/koku/koku_ua_dips.html',warning:'DIPS 2.0 is Japan’s official authenticated registration, planning, and permission platform.'},
 BR:{name:'Brazil',source:'DECEA SARPAS',url:'https://servicos.decea.gov.br/sarpas/',warning:'SARPAS requires operator and aircraft registration. Aeris does not automate or bypass the operational service.'},
 IN:{name:'India',source:'DGCA Digital Sky',url:'https://digitalsky.dgca.gov.in/',warning:'Digital Sky is the government real-time repository for red, yellow, and green zones. No anonymous reusable feed was verified.'},
 SG:{name:'Singapore',source:'CAAS / OneMap',url:'https://www.onemap.gov.sg/',warning:'CAAS identifies OneMap as the authoritative source for no-fly, permit, and temporary restricted areas.'},
 ZA:{name:'South Africa',source:'SACAA / ATNS AIP',url:'https://www.caa.co.za/industry-information/aeronautical-information-index-of-aics/',warning:'Current restrictions are published through AIP, NOTAM, and SACAA RPAS rules; no reusable national drone-geozone feed was verified.'}
} as const;
type CountryCode=keyof typeof COUNTRY_SOURCES|'DE'|'ES'|'LU'|'IE'|'GF'|'GP'|'MQ'|'RE'|'YT'|'PM'|'TF'|'XX';
function countryAt(p:Location):CountryCode{
 const named=p.name.toLowerCase();
 const namedCountry:[CountryCode,string[]][]=[
  ['LU',['luxembourg']],['IE',['ireland','éire','irland']],['ES',['spain','españa','spanien']],['DK',['denmark','danmark','dänemark']],
  ['GB',['united kingdom','great britain','england','scotland','wales','northern ireland','vereinigtes königreich','großbritannien']],
  ['US',['united states','usa','vereinigte staaten']],
  ['CH',['switzerland','schweiz','suisse','svizzera']],['AT',['austria','österreich','autriche']],['DE',['germany','deutschland']],['FR',['france','frankreich','french guiana','guyane','guadeloupe','martinique','réunion','reunion','mayotte','saint pierre and miquelon','saint-pierre-et-miquelon']],['SE',['sweden','sverige','schweden']],
  ['NO',['norway','norge','norwegen']],['CA',['canada','kanada']],['NL',['netherlands','nederland','niederlande']],['FI',['finland','suomi','finnland']],['EE',['estonia','eesti','estland']],['BG',['bulgaria','българия','bulgarien']],['PT',['portugal','portugalia']],
  ['BE',['belgium','belgië','belgique','belgien']],['PL',['poland','polska','polen']],['CZ',['czechia','czech republic','česko','tschechien']],['SK',['slovakia','slovensko','slowakei']],
  ['HU',['hungary','magyarország','ungarn']],['RO',['romania','românia','rumänien']],['GR',['greece','ελλάδα','griechenland']],['HR',['croatia','hrvatska','kroatien']],
  ['SI',['slovenia','slovenija','slowenien']],['LV',['latvia','latvija','lettland']],['LT',['lithuania','lietuva','litauen']],['AU',['australia','australien']],
  ['NZ',['new zealand','aotearoa','neuseeland']],['JP',['japan','日本']],['BR',['brazil','brasil','brasilien']],['IN',['india','indien']],
  ['SG',['singapore','singapur']],['ZA',['south africa','südafrika']]
 ];
 for(const [code,names] of namedCountry)if(names.some(name=>named.includes(name)))return code;
 if(p.lat>=49.35&&p.lat<=50.25&&p.lng>=5.65&&p.lng<=6.65)return'LU';
 if(p.lat>=50.7&&p.lat<=53.7&&p.lng>=3.2&&p.lng<=7.25)return'NL';
 if(p.lat>=57.3&&p.lat<=60.1&&p.lng>=21.5&&p.lng<=28.3)return'EE';
 if(p.lat>=59.5&&p.lat<=70.2&&p.lng>=19&&p.lng<=31.6)return'FI';
 if(p.lat>=41.1&&p.lat<=44.3&&p.lng>=22.2&&p.lng<=28.7)return'BG';
 if(p.lat>=30&&p.lat<=42.3&&p.lng>=-31.5&&p.lng<=-6)return'PT';
 if((p.lat>=2&&p.lat<=6.2&&p.lng>=-54.8&&p.lng<=-51.4)||(p.lat>=14&&p.lat<=19&&p.lng>=-63.7&&p.lng<=-60.7)||(p.lat>=-21.6&&p.lat<=-20.7&&p.lng>=55&&p.lng<=56)||(p.lat>=-13.1&&p.lat<=-12.5&&p.lng>=44.9&&p.lng<=45.4)||(p.lat>=46.7&&p.lat<=47.3&&p.lng>=-56.6&&p.lng<=-55.8))return'FR';
 if(p.lat>=51.2&&p.lat<=55.6&&p.lng>=-11&&p.lng<=-5)return'IE';
 if(p.lat>=49&&p.lat<=61&&p.lng>=-9&&p.lng<=2.5)return'GB';
 if(p.lat>=27&&p.lat<=44.5&&p.lng>=-18.5&&p.lng<=5)return'ES';
 if(p.lat>=54.4&&p.lat<=58&&p.lng>=7.8&&p.lng<=15.3)return'DK';
 if(p.lat>=45.75&&p.lat<=47.85&&p.lng>=5.75&&p.lng<=10.65)return'CH';
 if(p.lat>=46.25&&p.lat<=49.15&&p.lng>=9.45&&p.lng<=17.2)return'AT';
 if(p.lat>=47&&p.lat<=55.2&&p.lng>=5.5&&p.lng<=15.5)return'DE';
 if(p.lat>=41&&p.lat<=51.5&&p.lng>=-5.5&&p.lng<=10)return'FR';
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
 fr:{FLUGBESCHRAENKUNGSGEBIET:'Zone de restriction de vol',KONTROLLZONE:'Zone de contrôle',PROHIBITED:'Zone interdite',REQ_AUTHORIZATION:'Autorisation requise',CONDITIONAL:'Zone conditionnelle',COMMON:'Zone géographique'},
 it:{FLUGBESCHRAENKUNGSGEBIET:'Area con restrizioni di volo',KONTROLLZONE:'Zona di controllo',PROHIBITED:'Zona vietata',REQ_AUTHORIZATION:'Autorizzazione richiesta',CONDITIONAL:'Zona condizionata',COMMON:'Zona geografica'},
 pt:{FLUGBESCHRAENKUNGSGEBIET:'Área de restrição de voo',KONTROLLZONE:'Zona de controlo',PROHIBITED:'Zona proibida',REQ_AUTHORIZATION:'Autorização necessária',CONDITIONAL:'Zona condicionada',COMMON:'Zona geográfica'}
};
const translate=(value:string)=>{
 const normalized=value==='REQ_AUTHORISATION'?'REQ_AUTHORIZATION':value;
 return labels[language()]?.[normalized]??labels.en[normalized]??normalized.replaceAll('_',' ').toLowerCase().replace(/^./,c=>c.toUpperCase());
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
 if(/Por debajo de\s*[0-9.,]+\s*m|al menos\s*[0-9]+\s*días hábiles/i.test(value)){
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
const base=(code:string,name:string,sourceName:string,sourceUrl:string):ZoneInfo=>({countryCode:code,countryName:name,sourceName,sourceUrl,status:'none',zones:[],checkedAt:new Date().toISOString(),warning:'This is planning information, not legal clearance. Check the official source before takeoff.'});
const geoJsonCache=new Map<string,Promise<any>>();
const fetchGeoJson=(url:string)=>{let pending=geoJsonCache.get(url);if(!pending){pending=fetch(url).then(response=>{if(!response.ok)throw new Error(`Zone file unavailable: ${response.status}`);return response.json()});geoJsonCache.set(url,pending)}return pending};

async function dipul(point:Location):Promise<ZoneInfo>{const directUrl=`https://maptool-dipul.dfs.de/geozones/@${point.lng.toFixed(7)},${point.lat.toFixed(7)}?language=${language()==='de'?'de':'en'}&zoom=11.0`,result=base('DE',language()==='de'?'Deutschland':'Germany','DIPUL',directUrl);const d=.035,bbox=`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d}`,layers=DIPUL_LAYERS.map(x=>`dipul:${x}`).join(',');const params=new URLSearchParams({SERVICE:'WMS',VERSION:'1.1.1',REQUEST:'GetFeatureInfo',LAYERS:layers,QUERY_LAYERS:layers,STYLES:'',SRS:'EPSG:4326',BBOX:bbox,WIDTH:'256',HEIGHT:'256',X:'128',Y:'128',INFO_FORMAT:'text/plain',FEATURE_COUNT:'50'});const response=await fetch(`https://uas-betrieb.de/geoservices/dipul/wms?${params}`);if(!response.ok)throw new Error('DIPUL query failed');const text=await response.text(),blocks=text.split(/Results for FeatureType/).slice(1);result.zones=blocks.map((block,index)=>{const attrs=Object.fromEntries(block.split('\n').map(line=>line.match(/^([^=]+) = (.*)$/)).filter(Boolean).map(match=>[match![1].trim(),match![2].trim()]));const layer=(block.match(/'[^:]+:([^']+)'/)?.[1]??'zone');return{id:`DE-${index}-${attrs.external_reference??layer}`,name:attrs[`generated_name_${language().toUpperCase()}`]??attrs.generated_name_EN??attrs.name??translate(layer.toUpperCase()),type:translate(attrs.type_code??layer.toUpperCase()),lower:attrs.lower_limit_altitude?`${attrs.lower_limit_altitude} ${attrs.lower_limit_unit??''} ${attrs.lower_limit_alt_ref??''}`:undefined,upper:attrs.upper_limit_altitude?`${attrs.upper_limit_altitude} ${attrs.upper_limit_unit??''} ${attrs.upper_limit_alt_ref??''}`:undefined,legalReference:attrs.legal_ref,source:'DIPUL'} as ZoneDetail});result.status=result.zones.length?'loaded':'none';return result}

async function enaire(point:Location):Promise<ZoneInfo>{const result=base('ES',language()==='es'?'España':'Spain','ENAIRE servAIS','https://drones.enaire.es/'),d=.12;const params=new URLSearchParams({geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',sr:'4326',tolerance:'3',mapExtent:`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d}`,imageDisplay:'800,600,96',layers:'all:0,2,3',returnGeometry:'false',f:'json'});const response=await fetch(`https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V1/MapServer/identify?${params}`);if(!response.ok)throw new Error('ENAIRE query failed');const data=await response.json();result.zones=(data.results??[]).map((item:any,index:number)=>{const a=item.attributes??{},message=translateEnaireMessage(cleanHtml(a.message||a.description),a),rawName=a.name&&a.name!=='Nulo'?a.name:item.value||item.layerName;return{id:`ES-${item.layerId}-${a.OBJECTID??index}`,name:translateEnaireName(rawName),type:translate(a.type||a.restriction||'COMMON'),message:message.slice(0,2400),lower:a.lower!=null?`${a.lower} ${a.uom??''} ${a.lowerReference??''}`:undefined,upper:a.upper!=null?`${a.upper} ${a.uom??''} ${a.upperReference??''}`:undefined,legalReference:a.siteURL&&a.siteURL!=='Nulo'?a.siteURL:undefined,contact:[a.email,a.phone].filter((x:string)=>x&&x!=='Nulo').join(' · ')||undefined,source:'ENAIRE',updated:a.updateDateTime||undefined}});result.status=result.zones.length?'loaded':'none';return result}

async function france(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.FR,result=base('FR',source.name,source.source,source.url),d=.02;
 const params=new URLSearchParams({SERVICE:'WFS',VERSION:'2.0.0',REQUEST:'GetFeature',TYPENAMES:'TRANSPORTS.DRONES.RESTRICTIONS:carte_restriction_drones_lf',OUTPUTFORMAT:'application/json',SRSNAME:'EPSG:4326',BBOX:`${point.lng-d},${point.lat-d},${point.lng+d},${point.lat+d},EPSG:4326`,COUNT:'500'});
 const data=await fetchGeoJson(`https://data.geopf.fr/wfs/ows?${params}`);
 result.zones=(data.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const properties=feature.properties??{};return{id:feature.id??`FR-${index}`,name:properties.limite??'French UAS restriction',type:properties.limite??'UAS restriction',message:properties.remarque,source:source.source,updated:'2025-07-01'}});
 result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}

const insideRing=(point:Location,ring:number[][])=>{let inside=false;for(let i=0,j=ring.length-1;i<ring.length;j=i++){const [xi,yi]=ring[i],[xj,yj]=ring[j];if(((yi>point.lat)!==(yj>point.lat))&&(point.lng<(xj-xi)*(point.lat-yi)/(yj-yi)+xi))inside=!inside}return inside};
const insidePolygon=(point:Location,polygon:number[][][])=>insideRing(point,polygon[0])&&!polygon.slice(1).some(ring=>insideRing(point,ring));
const contains=(point:Location,geometry:any)=>geometry.type==='Polygon'?insidePolygon(point,geometry.coordinates):geometry.type==='MultiPolygon'?geometry.coordinates.some((polygon:number[][][])=>insidePolygon(point,polygon)):false;
async function luxembourg(point:Location):Promise<ZoneInfo>{const result=base('LU','Luxembourg','DAC Luxembourg','https://g-o.lu/uas');const response=await fetch(`${import.meta.env.BASE_URL}data/zones/LU.geojson`);if(!response.ok)throw new Error('Offline Luxembourg pack missing');const data=await response.json();result.zones=data.features.filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties;return{id:p.id??`LU-${index}`,name:p.name??'Luxembourg UAS zone',type:translate(p.restriction??p.type??'COMMON'),message:(p.reasons??[]).join(', '),lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.unit??'M'} ${p.lowerReference??''}`:undefined,upper:p.upperLimit!=null?`${p.upperLimit} ${p.unit??'M'} ${p.upperReference??''}`:undefined,contact:p.authority,source:'DAC Luxembourg',updated:p.updated}});result.status=result.zones.length?'loaded':'none';return result}
async function ireland(point:Location):Promise<ZoneInfo>{const result=base('IE','Ireland','Irish Aviation Authority','https://www.iaa.ie/general-aviation/drones/uas-geographic-zones');const response=await fetch(`${import.meta.env.BASE_URL}data/zones/IE.geojson`);if(!response.ok)throw new Error('Ireland zone file missing');const data=await response.json();result.zones=data.features.filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties,authority=(p.zoneAuthority??[])[0]??{};return{id:p.identifier??`IE-${index}`,name:p.name??'Ireland UAS geographical zone',type:translate(p.type??'COMMON'),message:[p.restrictionConditions,p.message].filter(Boolean).join(' · '),legalReference:p.regulationExemption??undefined,contact:[authority.name,authority.service,authority.email,authority.phone].filter(Boolean).join(' · ')||undefined,source:'Irish Aviation Authority'}});result.status=result.zones.length?'loaded':'none';return result}
async function uk(point:Location):Promise<ZoneInfo>{const source=COUNTRY_SOURCES.GB,result=base('GB',source.name,source.source,source.url),data=await fetchGeoJson(`${import.meta.env.BASE_URL}data/zones/GB.geojson`);result.zones=(data.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:p.identifier??`GB-${index}`,name:p.name??'UK UAS restriction',type:p.category??'UAS restriction',message:p.description,lower:p.lower,upper:p.upper,source:source.source,updated:p.effective}});result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result}
async function bundledNationalGeozones(point:Location,code:'NL'|'FI'|'EE'):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES[code],result=base(code,source.name,source.source,source.url);
 const data=await fetchGeoJson(code==='EE'?'https://utm.eans.ee/avm/utm/uas.geojson':`${import.meta.env.BASE_URL}data/zones/${code}.geojson`);
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
  const p=feature.properties??{},reasons=Array.isArray(p.reason)?p.reason.join(', '):p.reason;
  return{id:p.identifier??`PT-${index}`,name:p.name??'Portugal UAS geographical zone',type:translate(p.restriction??p.type??'COMMON'),message:[reasons,p.otherReasonInfo,p.message].filter(Boolean).join(' · '),lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.uomDimensions??'M'} ${p.lowerVerticalReference??''}`:undefined,upper:p.upperLimit!=null?`${p.upperLimit} ${p.uomDimensions??'M'} ${p.upperVerticalReference??''}`:undefined,contact:[p.authorityName,p.authorityService,p.authorityEmail,p.authorityPhone].filter(Boolean).join(' · ')||undefined,source:source.source,updated:data.title};
 });
 result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}
async function unitedStates(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.US,result=base('US',source.name,source.source,source.url);
 const params=new URLSearchParams({where:'1=1',geometry:`${point.lng},${point.lat}`,geometryType:'esriGeometryPoint',inSR:'4326',spatialRel:'esriSpatialRelIntersects',outFields:'OBJECTID,CEILING,UNIT,MAP_EFF,LAST_EDIT,APT1_FAAID,APT1_ICAO,APT1_NAME,APT1_LAANC,AIRSPACE_1,REGION',returnGeometry:'false',f:'json'});
 const response=await fetch(`https://services6.arcgis.com/ssFJjBXIUyZDrSYZ/arcgis/rest/services/FAA_UAS_FacilityMap_Data_V5/FeatureServer/0/query?${params}`);
 if(!response.ok)throw new Error('FAA query failed');
 const data=await response.json();
 result.zones=(data.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{};return{id:`US-${p.OBJECTID??index}`,name:p.APT1_NAME??p.APT1_ICAO??'FAA UAS Facility Map grid',type:`${p.CEILING??0} ${p.UNIT??'Feet'} authorization ceiling`,message:p.APT1_LAANC?'LAANC-enabled facility grid. This value is not an authorization.':'Facility-map planning grid. This value is not an authorization.',upper:`${p.CEILING??0} ${p.UNIT??'Feet'} AGL`,source:source.source,updated:p.MAP_EFF??p.LAST_EDIT}});result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
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
 const airports=(airportData.features??[]).map((feature:any,index:number)=>{const p=feature.attributes??{},coordinates=feature.geometry??{},lat=Number(coordinates.y??p.LATTITUDE),lng=Number(coordinates.x??p.LONGITUDE),distance=distanceKm(point,{lat,lng});return{distance,zone:{id:`CA-AIRPORT-${p.OBJECTID??index}`,name:p.AIRPORT??p.ICAO??'Canadian airport',type:'5.6 km airport advisory area',message:`${p.TYPE??'Airport'}${p.CITY?` · ${p.CITY}, ${p.PROVINCE}`:''}. Approximately ${distance.toFixed(1)} km from the selected point. This orientation ring is not a complete legal airspace check.`,source:'Transport Canada Open Government'}}}).filter((item:any)=>item.distance<=5.6).map((item:any)=>item.zone);
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
 const coordinateOrDevicePoint=/^-?\d/.test(point.name)||point.name==='My location';
 if(initial!=='XX'&&!northAmericaOverlap&&!coordinateOrDevicePoint)return initial;
 try{
  const response=await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${point.lat}&lon=${point.lng}&zoom=3&format=json&accept-language=en`);
  if(!response.ok)return initial;
  const country=String((await response.json()).address?.country_code??'').toUpperCase();
  if(['GF','GP','MQ','RE','YT','PM','TF'].includes(country))return'FR';
  if(country in COUNTRY_SOURCES||['DE','ES','LU','IE'].includes(country))return country as CountryCode;
 }catch{return initial}
 return initial;
}

async function switzerland(point:Location):Promise<ZoneInfo>{
 const source=COUNTRY_SOURCES.CH;
 const query=`${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
 const url=`https://map.geo.admin.ch/#/map?lang=${encodeURIComponent(['de','fr','it','rm','en'].includes(language())?language():'en')}&topic=ech&layers=ch.bazl.einschraenkungen-drohnen&swisssearch=${encodeURIComponent(query)}&swisssearch_autoselect=true&z=9`;
 const result=base('CH',source.name,source.source,url);
 const data=await fetchGeoJson('https://data.geo.admin.ch/ch.bazl.einschraenkungen-drohnen/einschraenkungen-drohnen/einschraenkungen-drohnen_4326.geojson');
 result.zones=(data.features??[]).filter((feature:any)=>contains(point,feature.geometry)).map((feature:any,index:number)=>{const p=feature.properties??{};return{id:p.identifier??`CH-${index}`,name:p.name||'Swiss UAS geographical zone',type:translate(p.restriction??p.type??'COMMON'),message:[p.restrictionConditions,p.message].filter(Boolean).join(' · '),lower:p.lowerLimit!=null?`${p.lowerLimit} ${p.uomDimensions??'M'} ${p.lowerVerticalReference??''}`:undefined,upper:p.upperLimit!=null?`${p.upperLimit} ${p.uomDimensions??'M'} ${p.upperVerticalReference??''}`:undefined,contact:[p.authorityName,p.service,p.email,p.phone].filter(Boolean).join(' · ')||undefined,source:source.source,updated:p.startDateTime}});result.status=result.zones.length?'loaded':'none';result.warning=source.warning;return result;
}

export async function getOfficialZoneInfo(point:Location,requestedLanguage=language()):Promise<ZoneInfo>{
 selectedLanguage=requestedLanguage.toLowerCase().split('-')[0]||'en';
 const code=await resolvedCountryAt(point);
 try{
  if(code==='DE')return await dipul(point);
  if(code==='ES')return await enaire(point);
  if(code==='FR'||['GF','GP','MQ','RE','YT','PM','TF'].includes(code))return await france(point);
  if(code==='LU')return await luxembourg(point);
  if(code==='IE')return await ireland(point);
  if(code==='GB')return await uk(point);
  if(code==='NL'||code==='FI'||code==='EE')return await bundledNationalGeozones(point,code);
  if(code==='PT')return await portugal(point);
  if(code==='DK')return await denmark(point);
  if(code==='CH')return await switzerland(point);
  if(code==='US')return await unitedStates(point);
  if(code==='CA')return await canada(point);
  if(code in COUNTRY_SOURCES){const source=COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES];return{...base(code,source.name,source.source,source.url),status:'unsupported',warning:source.warning}}
  return{...base(code,'Unknown','Official source directory','#'),status:'unsupported'};
 }catch{
  const source=code in COUNTRY_SOURCES?COUNTRY_SOURCES[code as keyof typeof COUNTRY_SOURCES]:undefined;
  return{...base(code,source?.name??code,source?.source??'Official source directory',source?.url??'#'),status:'error',warning:source?.warning??'The official source could not be reached. Check it directly before flight.'};
 }
}
