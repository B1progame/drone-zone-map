export type Source = { code:string; country:string; name:string; status:string; updated?:string; url:string; detail?:string };
export const sources: Source[] = [
 { code:'DE', country:'Germany', name:'DIPUL', status:'WMS only', updated:'Configured', url:'https://dipul.de/', detail:'Official WMS overlay configured. Online check required.' },
 { code:'ES', country:'Spain', name:'ENAIRE Drones', status:'Endpoint discovery', updated:'Pending', url:'https://drones.enaire.es/', detail:'Official source registered; no geometry is shipped until reuse is verified.' },
 { code:'FR', country:'France', name:'Géoportail', status:'Official link only', updated:'Pending', url:'https://www.geoportail.gouv.fr/', detail:'Official map link available. Vector reuse is not claimed.' },
 { code:'LU', country:'Luxembourg', name:'DAC Geoportal', status:'Endpoint discovery', updated:'Pending', url:'https://dac.gouvernement.lu/', detail:'Adapter ready for a public data endpoint.' }
];
export const sourceFor = (lat:number, lng:number) => lat > 47 && lat < 55 && lng > 5 && lng < 16 ? sources[0] : undefined;
