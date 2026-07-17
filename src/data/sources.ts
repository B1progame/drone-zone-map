export type Source = { code:string; country:string; name:string; status:string; updated?:string; url:string; detail?:string };

export const sources: Source[] = [
 { code:'DE', country:'Germany', name:'DIPUL', status:'Live official WMS', updated:'2026', url:'https://dipul.bund.de/homepage/en/information/geographical-zones/web-map-service-wms/', detail:'Official DIPUL raster layers are displayed live with DFS/BKG attribution.' },
 { code:'ES', country:'Spain', name:'ENAIRE servAIS', status:'Live official renderer', updated:'2026', url:'https://aip.enaire.es/AIP/UAS-en.html', detail:'The official MapServer renders the visible layer; point identify remains available for location checks.' },
 { code:'FR', country:'France', name:'IGN / Géoportail', status:'Live official WMTS', updated:'2026', url:'https://www.geoportail.gouv.fr/donnees/restrictions-uas-categorie-ouverte-et-aeromodelisme', detail:'The official TRANSPORTS.DRONES.RESTRICTIONS tiles are displayed with IGN symbology.' },
 { code:'GB', country:'United Kingdom', name:'NATS UK AIS', status:'Official AIRAC KML', updated:'9 Jul 2026', url:'https://nats-uk.ead-it.com/cms-nats/opencms/en/uas-restriction-zones/', detail:'Official permanent UAS restrictions are rendered from the NATS visualization dataset; current NOTAMs remain mandatory.' },
 { code:'US', country:'United States', name:'FAA UAS Facility Maps', status:'Live official FeatureServer', updated:'2026', url:'https://www.faa.gov/uas/getting_started/b4ufly', detail:'FAA facility grids load by viewport and show authorization ceilings; they are not permission or a complete restriction map.' },
 { code:'DK', country:'Denmark', name:'Trafikstyrelsen Dronezoner', status:'Live official GeoJSON', updated:'2026', url:'https://www.droneregler.dk/dronezoner/dronezoner-data-vejledninger/data-downloads', detail:'Stable official GeoJSON URLs are loaded on demand and styled with the published red, blue, orange and green categories.' },
 { code:'LU', country:'Luxembourg', name:'DAC Geoportal', status:'Official CC0 GeoJSON', updated:'2026', url:'https://drones.geoportail.lu/', detail:'Official Luxembourg UAS volumes are available offline.' },
 { code:'IE', country:'Ireland', name:'Irish Aviation Authority', status:'Official GeoJSON', updated:'14 Jul 2026', url:'https://www.iaa.ie/general-aviation/drones/uas-geographic-zones', detail:'The IAA explicitly publishes the common digital format; reference only, not for navigation.' },
 { code:'SE', country:'Sweden', name:'LFV Dronechart', status:'Official WFS', updated:'2026', url:'https://daim.lfv.se/echarts/dronechart/API/', detail:'Raw CC BY-NC-ND geometry is preserved. Published ground-level display filters exclude oversized non-drone layers.' },
 { code:'NO', country:'Norway', name:'Avinor drone map', status:'Official link only', updated:'2026', url:'https://www.avinor.no/en/practical-info/drone/dronekart/', detail:'Avinor expressly prohibits presenting its service data through another application.' },
 { code:'IT', country:'Italy', name:'D-Flight / ENAC', status:'Authenticated source only', updated:'2026', url:'https://www.d-flight.it/web-app/', detail:'The ED-269 download is available only to authenticated D-Flight operators with an active subscription.' },
 { code:'CA', country:'Canada', name:'NRC / Transport Canada', status:'Live official embedded map', updated:'6 Nov 2025', url:'https://www.nrc.canada.ca/en/drone-tool-2/', detail:'Aeris embeds the official NRC tool so Canada renders without redistributing NAV CANADA’s restricted database.' }
];

export const sourceFor = (lat:number, lng:number) =>
 sources.find(source =>
 source.code==='LU'?lat>=49.35&&lat<=50.25&&lng>=5.65&&lng<=6.65:
  source.code==='GB'?lat>=49&&lat<=61&&lng>=-9&&lng<=2.5:
  source.code==='IE'?lat>=51.2&&lat<=55.6&&lng>=-11&&lng<=-5:
  source.code==='ES'?lat>=27&&lat<=44.5&&lng>=-18.5&&lng<=5:
  source.code==='DK'?lat>=54.4&&lat<=58&&lng>=7.8&&lng<=15.3:
  source.code==='DE'?lat>=47&&lat<=55.2&&lng>=5.5&&lng<=15.5:
  source.code==='FR'?lat>=41&&lat<=51.5&&lng>=-5.5&&lng<=10:
  source.code==='IT'?lat>=35.3&&lat<=47.2&&lng>=6.5&&lng<=18.8:
  source.code==='SE'?lat>=55&&lat<=69.2&&lng>=10.4&&lng<=24.5&&lng>=(lat<60.5?11.3:lat<63?12.5:lat<66?15:lat<68?18:lat<69?23:31.5):
  source.code==='NO'?lat>=57.5&&lat<=71.5&&lng>=4&&lng<(lat<60.5?11.3:lat<63?12.5:lat<66?15:lat<68?18:lat<69?23:31.5):
  source.code==='CA'?lat>=49&&lat<=83.5&&lng>=-141&&lng<=-52:
  source.code==='US'?lat>=24&&lat<=49.5&&lng>=-125&&lng<=-66:false
 );
