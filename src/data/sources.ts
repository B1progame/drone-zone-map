export type Source = { code:string; country:string; name:string; status:string; updated?:string; url:string; detail?:string };

export const sources: Source[] = [
 { code:'DE', country:'Germany', name:'DIPUL', status:'Live official WMS', updated:'2026', url:'https://dipul.bund.de/homepage/en/information/geographical-zones/', detail:'Official DIPUL raster layers are displayed live with DFS/BKG attribution.' },
 { code:'ES', country:'Spain', name:'ENAIRE servAIS', status:'Live official renderer', updated:'2026', url:'https://aip.enaire.es/AIP/UAS-en.html', detail:'The official MapServer renders the visible layer; point identify remains available for location checks.' },
 { code:'FR', country:'France', name:'IGN / Géoportail', status:'Live official WMTS', updated:'2026', url:'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme', detail:'The official TRANSPORTS.DRONES.RESTRICTIONS tiles are displayed with IGN symbology.' },
 { code:'GB', country:'United Kingdom', name:'NATS UK AIS', status:'Official AIRAC KML', updated:'9 Jul 2026', url:'https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/', detail:'Official permanent UAS restrictions are rendered from the NATS visualization dataset; current NOTAMs remain mandatory.' },
 { code:'US', country:'United States', name:'FAA UAS Facility Maps', status:'Live official FeatureServer', updated:'2026', url:'https://www.faa.gov/uas/getting_started/b4ufly', detail:'FAA facility grids load by viewport and show authorization ceilings; they are not permission or a complete restriction map.' },
 { code:'DK', country:'Denmark', name:'Trafikstyrelsen Dronezoner', status:'Live official GeoJSON', updated:'2026', url:'https://www.droneregler.dk/dronezoner/dronezoner-data-vejledninger/data-downloads', detail:'Stable official GeoJSON URLs are loaded on demand and styled with the published red, blue, orange and green categories.' },
 { code:'LU', country:'Luxembourg', name:'DAC Geoportal', status:'Official CC0 GeoJSON', updated:'2026', url:'https://drones.geoportail.lu/', detail:'Official Luxembourg UAS volumes are available offline.' },
 { code:'IE', country:'Ireland', name:'Irish Aviation Authority', status:'Official GeoJSON', updated:'14 Jul 2026', url:'https://www.iaa.ie/general-aviation/drones/uas-geographic-zones', detail:'The IAA explicitly publishes the common digital format; reference only, not for navigation.' },
 { code:'SE', country:'Sweden', name:'LFV Dronechart', status:'Official WFS', updated:'2026', url:'https://daim.lfv.se/echarts/dronechart/API/', detail:'Raw CC BY-NC-ND geometry is preserved. Published ground-level display filters exclude oversized non-drone layers.' },
 { code:'CH', country:'Switzerland', name:'FOCA / geo.admin.ch', status:'Live official GeoJSON', updated:'14 Jul 2026', url:'https://map.geo.admin.ch/#/map?lang=en&topic=ech&layers=ch.bazl.einschraenkungen-drohnen', detail:'Complete public Swiss UAS geozones render live with the colors published by FOCA.' },
 { code:'NL', country:'Netherlands', name:'Ministry of Infrastructure and Water Management', status:'Official ED-269 JSON', updated:'2026', url:'https://www.rijksoverheid.nl/vraag-en-antwoord/drone/waar-mag-ik-vliegen-met-een-drone', detail:'The current government ED-269 download is normalized for display; the retired PDOK services are not used.' },
 { code:'FI', country:'Finland', name:'Traficom', status:'Official CC BY 4.0 zones', updated:'2026', url:'https://www.traficom.fi/fi/miehittamaton-ilmailu/uas-ilmatilavyohykkeet-koneluettavassa-muodossa', detail:'Traficom’s machine-readable zone volumes are normalized with a modification notice under CC BY 4.0.' },
 { code:'EE', country:'Estonia', name:'Transport Administration / EANS', status:'Live official GeoJSON', updated:'2026', url:'https://transpordiamet.ee/en/aviation-and-aviation-safety/flying-drones-estonia/geographical-zones', detail:'The official EANS GeoJSON loads live; its outside-Estonia mask is intentionally excluded from painting.' },
 { code:'BG', country:'Bulgaria', name:'Bulgarian CAA', status:'Official link + inspection tool', updated:'18 Jun 2026', url:'https://www.caa.bg/bg/category/633/7062', detail:'The local importer can inspect the newest BGR_ZONES ZIP, but public geometry remains disabled until CAA reuse permission is explicit.' },
 { code:'PT', country:'Portugal', name:'ANAC Portugal', status:'Live official ED-269', updated:'2026', url:'https://www.anac.pt/vPT/Generico/drones/zona_proibidas_condicionadas/Paginas/Zonasproibidasoucondicionadas.aspx', detail:'The newest dated official ED-269 file is discovered and normalized in memory, including mainland Portugal, Madeira, and the Azores.' },
 { code:'AT', country:'Austria', name:'Austro Control Dronespace', status:'Official link only', updated:'2026', url:'https://map.dronespace.at/', detail:'Austro Control’s official interactive planner is linked directly; no unverified private feed is copied.' },
 { code:'NO', country:'Norway', name:'Avinor drone map', status:'Official link only', updated:'2026', url:'https://www.avinor.no/en/practical-info/drone/dronekart/', detail:'Avinor expressly prohibits presenting its service data through another application.' },
 { code:'CA', country:'Canada', name:'Government of Canada Open Data', status:'Open airports + national parks', updated:'2026', url:'https://nrc.canada.ca/en/drone-tool-2/map.html', detail:'Aeris renders openly licensed federal airports, 5.6 km orientation rings, and national parks. NRC confirms the NAV CANADA-derived database may not be redistributed.' }
];

export const sourceFor = (lat:number, lng:number) =>
 sources.find(source =>
 source.code==='LU'?lat>=49.35&&lat<=50.25&&lng>=5.65&&lng<=6.65:
  source.code==='GB'?lat>=49&&lat<=61&&lng>=-9&&lng<=2.5:
 source.code==='IE'?lat>=51.2&&lat<=55.6&&lng>=-11&&lng<=-5:
  source.code==='NL'?lat>=50.7&&lat<=53.7&&lng>=3.2&&lng<=7.25:
  source.code==='EE'?lat>=57.3&&lat<=60.1&&lng>=21.5&&lng<=28.3:
  source.code==='FI'?lat>=59.5&&lat<=70.2&&lng>=19&&lng<=31.6:
  source.code==='BG'?lat>=41.1&&lat<=44.3&&lng>=22.2&&lng<=28.7:
  source.code==='PT'?lat>=30&&lat<=42.3&&lng>=-31.5&&lng<=-6:
  source.code==='ES'?lat>=27&&lat<=44.5&&lng>=-18.5&&lng<=5:
  source.code==='DK'?lat>=54.4&&lat<=58&&lng>=7.8&&lng<=15.3:
  source.code==='CH'?lat>=45.75&&lat<=47.85&&lng>=5.75&&lng<=10.65:
  source.code==='AT'?lat>=46.25&&lat<=49.15&&lng>=9.45&&lng<=17.2:
  source.code==='DE'?lat>=47&&lat<=55.2&&lng>=5.5&&lng<=15.5:
  source.code==='FR'?lat>=41&&lat<=51.5&&lng>=-5.5&&lng<=10:
  source.code==='SE'?lat>=55&&lat<=69.2&&lng>=10.4&&lng<=24.5&&lng>=(lat<60.5?11.3:lat<63?12.5:lat<66?15:lat<68?18:lat<69?23:31.5):
  source.code==='NO'?lat>=57.5&&lat<=71.5&&lng>=4&&lng<(lat<60.5?11.3:lat<63?12.5:lat<66?15:lat<68?18:lat<69?23:31.5):
  source.code==='CA'?lat>=49&&lat<=83.5&&lng>=-141&&lng<=-52:
  source.code==='US'?lat>=24&&lat<=49.5&&lng>=-125&&lng<=-66:false
 );
