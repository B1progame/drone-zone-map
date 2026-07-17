const PORTUGAL_INDEX='https://dnt.anac.pt/json/?';
let portugalUrl:Promise<string>|undefined;

function portugalVersionScore(href:string){
 const match=decodeURIComponent(href).match(/UASZoneVersion\D*(\d{2})(\d{2})(\d{4})(\d{2})(\d{2})(\d{2})/i);
 if(!match)return 0;
 const [,day,month,year,hour,minute,second]=match;
 return Number(`${year}${month}${day}${hour}${minute}${second}`);
}

export function latestPortugalEd269Url(){
 if(!portugalUrl)portugalUrl=fetch(PORTUGAL_INDEX).then(async response=>{
  if(!response.ok)throw new Error(`Portugal ED-269 directory failed (${response.status})`);
  const html=await response.text(),document=new DOMParser().parseFromString(html,'text/html');
  const links=[...document.querySelectorAll('a[href]')]
   .map(link=>link.getAttribute('href')??'')
   .filter(href=>/UASZoneVersion.*\.json$/i.test(decodeURIComponent(href)))
   .sort((left,right)=>portugalVersionScore(left)-portugalVersionScore(right));
  const href=links.at(-1);
  if(!href)throw new Error('Portugal ED-269 directory contained no zone file');
  return new URL(href,PORTUGAL_INDEX).href;
 }).catch(error=>{portugalUrl=undefined;throw error});
 return portugalUrl;
}

function circleGeometry(center:number[],radiusMetres:number,segments=96){
 const earthRadius=6371008.8,longitude=center[0]*Math.PI/180,latitude=center[1]*Math.PI/180;
 const angularDistance=radiusMetres/earthRadius,ring:number[][]=[];
 for(let index=0;index<segments;index++){
  const bearing=2*Math.PI*index/segments;
  const targetLatitude=Math.asin(Math.sin(latitude)*Math.cos(angularDistance)+Math.cos(latitude)*Math.sin(angularDistance)*Math.cos(bearing));
  const targetLongitude=longitude+Math.atan2(Math.sin(bearing)*Math.sin(angularDistance)*Math.cos(latitude),Math.cos(angularDistance)-Math.sin(latitude)*Math.sin(targetLatitude));
  ring.push([((targetLongitude*180/Math.PI+540)%360)-180,targetLatitude*180/Math.PI]);
 }
 ring.push(ring[0]);
 return{type:'Polygon',coordinates:[ring]};
}

export function normalizeEd269(payload:any){
 const features:any[]=[];
 for(const [zoneIndex,zone] of (payload.features??[]).entries()){
  const volumes=Array.isArray(zone.geometry)?zone.geometry:[zone.geometry];
  for(const [volumeIndex,volume] of volumes.entries()){
   const projection=volume?.horizontalProjection;
   if(!projection)continue;
   const geometry=projection.type==='Circle'
    ?circleGeometry(projection.center,Number(projection.radius))
    :projection.type==='Polygon'||projection.type==='MultiPolygon'?projection:undefined;
   if(!geometry)continue;
   const authority=(zone.zoneAuthority??[])[0]??{};
   const {geometry:_zoneGeometry,...zoneProperties}=zone;
   const {horizontalProjection:_projection,...volumeProperties}=volume;
   features.push({
    type:'Feature',
    id:`${zone.identifier??`zone-${zoneIndex}`}-${volumeIndex}`,
    properties:{...zoneProperties,...volumeProperties,sourceGeometryType:projection.type,circleCenter:projection.center,circleRadiusMetres:projection.radius,authorityName:authority.name,authorityService:authority.service,authorityEmail:authority.email,authorityPhone:authority.phone},
    geometry
   });
  }
 }
 return{type:'FeatureCollection' as const,features,title:payload.title,description:payload.description};
}
