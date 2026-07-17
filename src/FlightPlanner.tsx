import { ArrowDownUp, Check, CircleDot, MapPinned, Minus, Route, Save, Trash2, Undo2, X } from 'lucide-react';
import type { Location } from './types';

export type FlightPoint=Location&{id:string};
const copy:Record<string,{launch:string;eyebrow:string;tap:string;waypoint:string;waypoints:string;distance:string;hint:string;add:string;undo:string;clear:string;empty:string;close:string;range:string;rangeHint:string;reverse:string;save:string;remove:string}>={
 en:{launch:'Plan a route',eyebrow:'FLIGHT PLAN + RANGE ENVELOPE',tap:'Tap the map to begin',waypoint:'waypoint',waypoints:'waypoints',distance:'planned route distance',hint:'The range ring is an orientation aid, not a promise of radio link, battery endurance, VLOS compliance or a safe return.',add:'Add selected location',undo:'Undo',clear:'Clear',empty:'Route points will appear here',close:'Close route planner',range:'Maximum flight radius',rangeHint:'Measured from waypoint 1',reverse:'Reverse',save:'Save route',remove:'Remove waypoint'},
 de:{launch:'Route planen',eyebrow:'FLUGPLAN + REICHWEITENRING',tap:'Tippe zum Starten auf die Karte',waypoint:'Wegpunkt',waypoints:'Wegpunkte',distance:'geplante Routendistanz',hint:'Der Reichweitenring ist nur eine Orientierung und keine Zusage für Funkverbindung, Akku, VLOS oder sichere Rückkehr.',add:'Gewählten Ort hinzufügen',undo:'Zurück',clear:'Leeren',empty:'Routenpunkte erscheinen hier',close:'Routenplaner schließen',range:'Maximaler Flugradius',rangeHint:'Gemessen ab Wegpunkt 1',reverse:'Umkehren',save:'Route speichern',remove:'Wegpunkt entfernen'},
 es:{launch:'Planificar ruta',eyebrow:'PLAN DE VUELO + RADIO',tap:'Toca el mapa para empezar',waypoint:'punto',waypoints:'puntos',distance:'distancia planificada',hint:'El radio es orientativo; no garantiza enlace, batería, VLOS ni regreso seguro.',add:'Añadir ubicación seleccionada',undo:'Deshacer',clear:'Borrar',empty:'Los puntos de ruta aparecerán aquí',close:'Cerrar planificador',range:'Radio máximo de vuelo',rangeHint:'Medido desde el punto 1',reverse:'Invertir',save:'Guardar ruta',remove:'Eliminar punto'},
 fr:{launch:'Planifier un trajet',eyebrow:'PLAN DE VOL + RAYON',tap:'Touchez la carte pour commencer',waypoint:'point',waypoints:'points',distance:'distance planifiée',hint:'Le rayon est indicatif et ne garantit ni liaison radio, ni autonomie, ni VLOS, ni retour sûr.',add:'Ajouter le lieu sélectionné',undo:'Annuler',clear:'Effacer',empty:'Les points du trajet apparaîtront ici',close:'Fermer le planificateur',range:'Rayon de vol maximal',rangeHint:'Mesuré depuis le point 1',reverse:'Inverser',save:'Enregistrer',remove:'Supprimer le point'},
 it:{launch:'Pianifica rotta',eyebrow:'PIANO DI VOLO + RAGGIO',tap:'Tocca la mappa per iniziare',waypoint:'punto',waypoints:'punti',distance:'distanza pianificata',hint:'Il raggio è indicativo e non garantisce collegamento, batteria, VLOS o rientro sicuro.',add:'Aggiungi posizione selezionata',undo:'Annulla',clear:'Cancella',empty:'I punti della rotta appariranno qui',close:'Chiudi pianificatore',range:'Raggio massimo di volo',rangeHint:'Misurato dal punto 1',reverse:'Inverti',save:'Salva rotta',remove:'Rimuovi punto'}
};

export const distanceKm=(a:Location,b:Location)=>{
  const radius=6371,toRad=(value:number)=>value*Math.PI/180;
  const dLat=toRad(b.lat-a.lat),dLng=toRad(b.lng-a.lng),lat1=toRad(a.lat),lat2=toRad(b.lat);
  const h=Math.sin(dLat/2)**2+Math.cos(lat1)*Math.cos(lat2)*Math.sin(dLng/2)**2;
  return radius*2*Math.atan2(Math.sqrt(h),Math.sqrt(1-h));
};

export const flightDistance=(points:Location[])=>points.slice(1).reduce((sum,point,index)=>sum+distanceKm(points[index],point),0);

export function FlightPlanner({active,points,selected,radiusKm,language='en',onToggle,onUndo,onClear,onCheck,onAddSelected,onRemove,onReverse,onSave,onRadiusChange}:{active:boolean;points:FlightPoint[];selected?:Location;radiusKm:number;language?:string;onToggle:()=>void;onUndo:()=>void;onClear:()=>void;onCheck:(point:FlightPoint)=>void;onAddSelected:(point:Location)=>void;onRemove:(index:number)=>void;onReverse:()=>void;onSave:()=>void;onRadiusChange:(radius:number)=>void}){
  const distance=flightDistance(points);
  const direct=points.length>1?distanceKm(points[0],points[points.length-1]):0;
  const outside=direct>radiusKm;
  const c=copy[language]??copy.en;
  if(!active)return <button className="plannerLauncher liquid" onClick={onToggle}><Route/> {c.launch}</button>;
  return <aside className="flightPlanner liquid">
    <div className="plannerHead"><div><div className="eyebrow">{c.eyebrow}</div><b>{points.length?`${points.length} ${points.length===1?c.waypoint:c.waypoints}`:c.tap}</b></div><button onClick={onToggle} aria-label={c.close}>×</button></div>
    <div className={`plannerDistance${outside?' outside':''}`}><Route/><div><strong>{distance<10?distance.toFixed(2):distance.toFixed(1)} km</strong><span>{c.distance}{points.length>1?` · ${direct.toFixed(1)} km from launch`:''}</span></div></div>
    <div className="rangeControl">
      <div><CircleDot/><span><b>{c.range}</b><small>{c.rangeHint}</small></span><strong>{radiusKm.toFixed(radiusKm<10?1:0)} km</strong></div>
      <input type="range" min=".5" max="50" step=".5" value={radiusKm} onChange={event=>onRadiusChange(Number(event.target.value))} aria-label={c.range}/>
      <div className="rangePresets">{[2,5,10,20].map(value=><button className={radiusKm===value?'active':''} onClick={()=>onRadiusChange(value)} key={value}>{value} km</button>)}</div>
      {outside&&<p>Last waypoint is {(direct-radiusKm).toFixed(1)} km outside the selected radius.</p>}
    </div>
    <div className="plannerHint"><MapPinned/> {c.hint}</div>
    {points.length>0&&<ol>{points.map((point,index)=><li key={point.id}><i>{index+1}</i><button onClick={()=>onCheck(point)}><b>{point.name}</b><span>{index?`${distanceKm(points[index-1],point).toFixed(2)} km leg · `:''}{point.lat.toFixed(5)}, {point.lng.toFixed(5)}</span></button><button className="removeWaypoint" onClick={()=>onRemove(index)} aria-label={`${c.remove} ${index+1}`}><X/></button></li>)}</ol>}
    {selected&&<button className="plannerAddSelected" onClick={()=>onAddSelected(selected)}><MapPinned/> {c.add}</button>}
    <div className="plannerActions"><button onClick={onUndo} disabled={!points.length}><Undo2/> {c.undo}</button><button onClick={onReverse} disabled={points.length<2}><ArrowDownUp/> {c.reverse}</button><button onClick={onSave} disabled={points.length<2}><Save/> {c.save}</button><button onClick={onClear} disabled={!points.length}><Trash2/> {c.clear}</button></div>
    {!points.length&&<div className="plannerEmpty"><Minus/> {c.empty}</div>}
  </aside>
}
