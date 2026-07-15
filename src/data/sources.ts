export type Source = { code:string; country:string; name:string; status:string; updated?:string; url:string; detail?:string };
export const sources: Source[] = [
 { code:'DE', country:'Germany', name:'DIPUL', status:'Live official WMS', updated:'2026', url:'https://dipul.bund.de/homepage/en/information/geographical-zones/web-map-service-wms/', detail:'Official DIPUL raster layers are displayed live with DFS/BKG attribution.' },
 { code:'ES', country:'Spain', name:'ENAIRE Drones', status:'Endpoint discovery', updated:'Pending', url:'https://drones.enaire.es/', detail:'Official source registered; no geometry is shipped until reuse is verified.' },
 { code:'FR', country:'France', name:'Géoportail', status:'Official link only', updated:'Pending', url:'https://www.geoportail.gouv.fr/', detail:'Official map link available. Vector reuse is not claimed.' },
 { code:'LU', country:'Luxembourg', name:'DAC Geoportal', status:'Endpoint discovery', updated:'Pending', url:'https://dac.gouvernement.lu/', detail:'Adapter ready for a public data endpoint.' }
];
export const sourceFor = (lat:number, lng:number) => lat > 47 && lat < 55 && lng > 5 && lng < 16 ? sources[0] : undefined;
