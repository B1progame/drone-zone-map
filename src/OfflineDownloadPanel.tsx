import { useMemo, useState } from 'react';
import { Check, Database, Download, MapPin, X } from 'lucide-react';
import type { Location, Weather, ZoneInfo } from './types';
import { createOfflineConfig, createOfflinePack, estimateOfflinePackage, GERMAN_STATES, OFFLINE_LAYERS, type OfflineDownloadProgress, type OfflineLayerId, type OfflineScope } from './offline';

const layerIds=Object.keys(OFFLINE_LAYERS) as OfflineLayerId[];

export function OfflineDownloadPanel({location,weather,zoneInfo,onClose,onSaved}:{location:Location;weather?:Weather;zoneInfo?:ZoneInfo;onClose:()=>void;onSaved:()=>void}){
 const[scope,setScope]=useState<OfflineScope>('radius'),[stateName,setStateName]=useState('Berlin'),[radius,setRadius]=useState(20),[layers,setLayers]=useState<OfflineLayerId[]>(layerIds),[progress,setProgress]=useState<OfflineDownloadProgress>(),[error,setError]=useState('');
 const config=useMemo(()=>createOfflineConfig(scope,location,layers,stateName,radius),[scope,location,layers,stateName,radius]);
 const estimate=useMemo(()=>estimateOfflinePackage(config),[config]);
 const toggle=(id:OfflineLayerId)=>setLayers(value=>value.includes(id)?value.filter(item=>item!==id):[...value,id]);
 const download=async()=>{
  setError('');
  try{await createOfflinePack(config,weather,zoneInfo,setProgress);onSaved();window.setTimeout(onClose,450)}
  catch(reason){setError(reason instanceof Error?reason.message:'The package could not be downloaded.');setProgress(undefined)}
 };
 return <div className="modalShade offlineShade" role="dialog" aria-modal="true" aria-labelledby="offline-title">
  <section className="settings offlineBuilder liquid">
   <button className="close" onClick={onClose} aria-label="Close offline download"><X/></button>
   <div className="eyebrow">OFFLINE FLIGHT PACKAGE · GERMANY</div>
   <h2 id="offline-title">Download this area</h2>
   <p>Only the selected area and official layers are stored on this device. The app automatically uses the smallest matching package when there is no connection.</p>
   <label>Area<select value={scope} onChange={event=>setScope(event.target.value as OfflineScope)} disabled={Boolean(progress)}>
    <option value="radius">Custom radius around selected location</option><option value="city">City / place</option><option value="state">Federal state</option><option value="country">All Germany</option>
   </select></label>
   {scope==='state'&&<label>Federal state<select value={stateName} onChange={event=>setStateName(event.target.value)}>{GERMAN_STATES.map(state=><option key={state.name}>{state.name}</option>)}</select></label>}
   {(scope==='radius'||scope==='city')&&<label className="offlineRadius"><span>{scope==='city'?'City coverage':'Radius'} <b>{scope==='city'?Math.min(25,Math.max(5,radius)):radius} km</b></span><input type="range" min={scope==='city'?5:1} max={scope==='city'?25:100} value={radius} onChange={event=>setRadius(Number(event.target.value))}/></label>}
   <div className="offlineCenter"><MapPin/><span><b>{config.region}</b>{config.bounds.map(value=>value.toFixed(2)).join(' · ')}</span></div>
   <fieldset className="offlineLayerList" disabled={Boolean(progress)}><legend>Layers</legend>{layerIds.map(id=><label key={id}><input type="checkbox" checked={layers.includes(id)} onChange={()=>toggle(id)}/><span><Check/><b>{OFFLINE_LAYERS[id].label}</b></span></label>)}</fieldset>
   <div className="offlineEstimate"><Database/><span><small>ESTIMATED PACKAGE</small><b>{estimate.label}</b><i>about {estimate.items.toLocaleString()} items · final size depends on source density</i></span></div>
   {progress&&<div className="offlineBuildProgress" role="status" aria-live="polite"><span><b>{progress.percent}%</b>{progress.stage}</span><i><b style={{width:`${progress.percent}%`}}/></i><small>{progress.items.toLocaleString()} items received</small></div>}
   {error&&<div className="offlineError">{error}</div>}
   <button className="primary offlineDownload" disabled={Boolean(progress)||!layers.length} onClick={()=>void download()}><Download/>{progress?'Downloading package…':`Download about ${estimate.label}`}</button>
   <small>Official source: DIPUL WFS. Offline data is planning support, not legal clearance. Temporary restrictions can change after download.</small>
  </section>
 </div>;
}
