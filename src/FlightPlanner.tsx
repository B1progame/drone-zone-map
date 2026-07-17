import { Check, MapPinned, Minus, Route, Trash2, Undo2 } from 'lucide-react';
import type { Location } from './types';

export type FlightPoint=Location&{id:string};
const copy:Record<string,{launch:string;eyebrow:string;tap:string;waypoint:string;waypoints:string;distance:string;hint:string;add:string;undo:string;clear:string;empty:string;close:string}>={
 en:{launch:'Plan a route',eyebrow:'MULTI-POINT FLIGHT PLAN',tap:'Tap the map to begin',waypoint:'waypoint',waypoints:'waypoints',distance:'straight-line route distance',hint:'Every map tap adds a waypoint. Pan and pinch still work normally.',add:'Add selected location',undo:'Undo',clear:'Clear',empty:'Route points will appear here',close:'Close route planner'},
 de:{launch:'Route planen',eyebrow:'FLUGPLAN MIT WEGPUNKTEN',tap:'Tippe zum Starten auf die Karte',waypoint:'Wegpunkt',waypoints:'Wegpunkte',distance:'direkte Routendistanz',hint:'Jeder Kartentipp fügt einen Wegpunkt hinzu. Verschieben und Zoomen funktionieren weiter.',add:'Gewählten Ort hinzufügen',undo:'Zurück',clear:'Leeren',empty:'Routenpunkte erscheinen hier',close:'Routenplaner schließen'},
 es:{launch:'Planificar ruta',eyebrow:'PLAN DE VUELO MULTIPUNTO',tap:'Toca el mapa para empezar',waypoint:'punto',waypoints:'puntos',distance:'distancia directa de la ruta',hint:'Cada toque añade un punto. Puedes seguir moviendo y ampliando el mapa.',add:'Añadir ubicación seleccionada',undo:'Deshacer',clear:'Borrar',empty:'Los puntos de ruta aparecerán aquí',close:'Cerrar planificador'},
 fr:{launch:'Planifier un trajet',eyebrow:'PLAN DE VOL MULTIPOINT',tap:'Touchez la carte pour commencer',waypoint:'point',waypoints:'points',distance:'distance directe du trajet',hint:'Chaque toucher ajoute un point. Le déplacement et le zoom restent disponibles.',add:'Ajouter le lieu sélectionné',undo:'Annuler',clear:'Effacer',empty:'Les points du trajet apparaîtront ici',close:'Fermer le planificateur'},
 it:{launch:'Pianifica rotta',eyebrow:'PIANO DI VOLO MULTIPUNTO',tap:'Tocca la mappa per iniziare',waypoint:'punto',waypoints:'punti',distance:'distanza diretta della rotta',hint:'Ogni tocco aggiunge un punto. Spostamento e zoom restano disponibili.',add:'Aggiungi posizione selezionata',undo:'Annulla',clear:'Cancella',empty:'I punti della rotta appariranno qui',close:'Chiudi pianificatore'}
};

const distanceKm=(a:Location,b:Location)=>{
  const radius=6371,toRad=(value:number)=>value*Math.PI/180;
  const dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),lat1=toRad(a.lat),lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return radius*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};

export const flightDistance=(points:Location[])=>points.slice(1).reduce((sum,point,index)=>sum+distanceKm(points[index],point),0);

export function FlightPlanner({active,points,selected,language='en',onToggle,onUndo,onClear,onCheck,onAddSelected}:{active:boolean;points:FlightPoint[];selected?:Location;language?:string;onToggle:()=>void;onUndo:()=>void;onClear:()=>void;onCheck:(point:FlightPoint)=>void;onAddSelected:(point:Location)=>void}){
  const distance=flightDistance(points);
  const c=copy[language]??copy.en;
  if(!active)return <button className="plannerLauncher liquid" onClick={onToggle}><Route/> {c.launch}</button>;
  return <aside className="flightPlanner liquid">
    <div className="plannerHead"><div><div className="eyebrow">{c.eyebrow}</div><b>{points.length?`${points.length} ${points.length===1?c.waypoint:c.waypoints}`:c.tap}</b></div><button onClick={onToggle} aria-label={c.close}>×</button></div>
    <div className="plannerDistance"><Route/><div><strong>{distance<10?distance.toFixed(2):distance.toFixed(1)} km</strong><span>{c.distance}</span></div></div>
    <div className="plannerHint"><MapPinned/> {c.hint}</div>
    {points.length>0&&<ol>{points.map((point,index)=><li key={point.id}><i>{index+1}</i><button onClick={()=>onCheck(point)}><b>{point.name}</b><span>{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span></button>{index===points.length-1&&<Check/>}</li>)}</ol>}
    {selected&&<button className="plannerAddSelected" onClick={()=>onAddSelected(selected)}><MapPinned/> {c.add}</button>}
    <div className="plannerActions"><button onClick={onUndo} disabled={!points.length}><Undo2/> {c.undo}</button><button onClick={onClear} disabled={!points.length}><Trash2/> {c.clear}</button></div>
    {!points.length&&<div className="plannerEmpty"><Minus/> {c.empty}</div>}
  </aside>
}
