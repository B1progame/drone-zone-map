import boundaries from './data/dachBoundaries.json';
export type Coordinate = {lat:number;lng:number};
function ringContains(p:Coordinate,ring:number[][]):boolean {
 let inside=false;
 for(let i=0,j=ring.length-1;i<ring.length;j=i++){
  const [x,y]=ring[i],[a,b]=ring[j];
  const cross=(p.lng-a)*(y-b)-(p.lat-b)*(x-a);
  if(Math.abs(cross)<1e-10&&p.lng>=Math.min(a,x)&&p.lng<=Math.max(a,x)&&p.lat>=Math.min(b,y)&&p.lat<=Math.max(b,y))return true;
  if((y>p.lat)!==(b>p.lat)&&p.lng<(a-x)*(p.lat-y)/(b-y)+x)inside=!inside;
 }
 return inside;
}
export function geometryContains(p:Coordinate,g:any):boolean {
 if(!g)return false;
 const polygon=(rings:number[][][])=>rings.length>0&&ringContains(p,rings[0])&&!rings.slice(1).some(r=>ringContains(p,r));
 if(g.type==='Polygon')return polygon(g.coordinates);
 if(g.type==='MultiPolygon')return g.coordinates.some(polygon);
 if(g.type==='GeometryCollection')return g.geometries.some((child:any)=>geometryContains(p,child));
 return false;
}
export function dachCountry(p:Coordinate):string|undefined {
 return boundaries.features.find(f=>geometryContains(p,f.geometry))?.properties['ISO3166-1-Alpha-2'];
}
export const inDachRegion=(p:Coordinate)=>p.lat>=45.7&&p.lat<=55.2&&p.lng>=5.5&&p.lng<=17.2;
export const aroundBodensee=(p:Coordinate)=>p.lat>=47.35&&p.lat<=47.9&&p.lng>=8.75&&p.lng<=10.15;
function dateWindowCurrent(properties:Record<string,any>,now:number):boolean {
 const start=Date.parse(properties.startDateTime??''),end=Date.parse(properties.endDateTime??'');
 return (!Number.isFinite(start)||start<=now)&&(!Number.isFinite(end)||end>=now);
}
export function zoneValidity(properties:Record<string,any>,now=Date.now()):Record<string,any> {
 const windows=Array.isArray(properties.applicability)?properties.applicability:[];
 return windows.find((window:any)=>dateWindowCurrent(window,now))??properties;
}
export function isZoneCurrent(properties:Record<string,any>,now=Date.now()):boolean {
 const windows=Array.isArray(properties.applicability)?properties.applicability:[];
 return dateWindowCurrent(properties,now)&&(!windows.length||windows.some((window:any)=>dateWindowCurrent(window,now)));
}
export const currentZones=(data:any)=>({...data,features:(data.features??[]).filter((f:any)=>isZoneCurrent(f.properties??{}))});
