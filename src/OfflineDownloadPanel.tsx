import { useEffect, useMemo, useState } from 'react';
import { Check, Database, Download, Map, MapPin, Satellite, X } from 'lucide-react';
import type { Location, Weather, ZoneInfo } from './types';
import { createOfflineConfig, createOfflinePack, estimateOfflinePackage, estimateOfflinePackageFromSource, formatBytes, getOfflineStorageStatus, GERMAN_STATES, MAX_OFFLINE_TILES, maxOfflineBasemapZoom, OFFLINE_COUNTRIES, OFFLINE_LAYERS, type OfflineBasemapType, type OfflineCountryCode, type OfflineDownloadProgress, type OfflineLayerId, type OfflineScope, type OfflineStorageStatus } from './offline';

export function OfflineDownloadPanel({location,weather,zoneInfo,onClose,onSaved}:{location:Location;weather?:Weather;zoneInfo?:ZoneInfo;onClose:()=>void;onSaved:()=>void}){
 const detected=(zoneInfo?.countryCode&&zoneInfo.countryCode in OFFLINE_COUNTRIES?zoneInfo.countryCode:'DE') as OfflineCountryCode;
 const[scope,setScope]=useState<OfflineScope>('radius'),[country,setCountry]=useState<OfflineCountryCode>(detected),[stateName,setStateName]=useState('Berlin'),[radius,setRadius]=useState(20),[layers,setLayers]=useState<OfflineLayerId[]>(OFFLINE_COUNTRIES[detected].layers),[basemapType,setBasemapType]=useState<OfflineBasemapType>('street'),[qualityOffset,setQualityOffset]=useState(0),[progress,setProgress]=useState<OfflineDownloadProgress>(),[error,setError]=useState(''),[sourceEstimate,setSourceEstimate]=useState<{bytes:number;items:number;tileCount?:number;label:string}>(),[storage,setStorage]=useState<OfflineStorageStatus>();
 const availableLayers=OFFLINE_COUNTRIES[country].layers;
 const baseConfig=useMemo(()=>createOfflineConfig(scope,location,layers,stateName,radius,country),[scope,location,layers,stateName,radius,country]);
 const qualityMax=useMemo(()=>maxOfflineBasemapZoom(baseConfig.bounds,basemapType),[baseConfig.bounds,basemapType]),qualityMin=Math.min(5,qualityMax),qualityZoom=Math.max(qualityMin,Math.min(qualityMax,baseConfig.basemapMaxZoom+qualityOffset));
 const qualityLabel=qualityZoom===qualityMax?'Maximum':qualityZoom<=qualityMin?'Compact':qualityZoom<=baseConfig.basemapMaxZoom?'Balanced':'High';
 const config=useMemo(()=>({...baseConfig,basemapType,basemapMaxZoom:qualityZoom}),[baseConfig,basemapType,qualityZoom]);
 const estimate=useMemo(()=>estimateOfflinePackage(config),[config]);
 const shownEstimate=sourceEstimate??estimate;
 const tooLarge=(shownEstimate.tileCount??0)>MAX_OFFLINE_TILES;
 useEffect(()=>{let active=true;setSourceEstimate(undefined);const timer=window.setTimeout(()=>void estimateOfflinePackageFromSource(config).then(value=>{if(active)setSourceEstimate(value)}).catch(()=>{}),250);return()=>{active=false;window.clearTimeout(timer)}},[config]);
 useEffect(()=>{let active=true;void getOfflineStorageStatus().then(value=>{if(active)setStorage(value)});return()=>{active=false}},[]);
 const toggle=(id:OfflineLayerId)=>setLayers(value=>value.includes(id)?value.filter(item=>item!==id):[...value,id]);
 const chooseCountry=(next:OfflineCountryCode)=>{setCountry(next);setLayers(OFFLINE_COUNTRIES[next].layers);if(next!=='DE'&&scope==='state')setScope('country')};
 const download=async()=>{
  setError('');
  try{setStorage(await getOfflineStorageStatus(true));await createOfflinePack(config,weather,zoneInfo,setProgress);onSaved();window.setTimeout(onClose,650)}
  catch(reason){setError(reason instanceof Error?reason.message:'The package could not be downloaded.');setProgress(undefined)}
 };
 return <div className="modalShade offlineShade" role="dialog" aria-modal="true" aria-labelledby="offline-title">
  <section className="settings offlineBuilder liquid">
   <button className="close" onClick={onClose} aria-label="Close offline download"><X/></button>
   <div className="eyebrow">OFFLINE FLIGHT PACKAGE · {OFFLINE_COUNTRIES[country].name.toUpperCase()}</div>
   <h2 id="offline-title">Download this area</h2>
   <p>Every package includes a low-detail world map. Your selected area and official layers are stored at the quality you choose, and the app automatically uses the smallest matching package when there is no connection.</p>
   <label>Country<select value={country} onChange={event=>chooseCountry(event.target.value as OfflineCountryCode)} disabled={Boolean(progress)}>{(Object.keys(OFFLINE_COUNTRIES) as OfflineCountryCode[]).map(code=><option value={code} key={code}>{OFFLINE_COUNTRIES[code].name}</option>)}</select></label>
   <label>Area<select value={scope} onChange={event=>setScope(event.target.value as OfflineScope)} disabled={Boolean(progress)}>
    <option value="radius">Custom radius around selected location</option><option value="city">City / place</option>{country==='DE'&&<option value="state">Federal state</option>}<option value="country">{OFFLINE_COUNTRIES[country].scopeLabel??`All ${OFFLINE_COUNTRIES[country].name}`}</option>
   </select></label>
   {scope==='state'&&<label>Federal state<select value={stateName} onChange={event=>setStateName(event.target.value)}>{GERMAN_STATES.map(state=><option key={state.name}>{state.name}</option>)}</select></label>}
   {(scope==='radius'||scope==='city')&&<div className="offlinePresets" aria-label="Offline area presets">{[{label:'Quick',km:10},{label:'Recommended',km:25},{label:'Extended',km:50}].map(preset=><button key={preset.km} className={radius===preset.km?'active':''} disabled={Boolean(progress)||(scope==='city'&&preset.km>25)} onClick={()=>setRadius(preset.km)}><b>{preset.label}</b><span>{preset.km} km</span></button>)}</div>}
   {(scope==='radius'||scope==='city')&&<label className="offlineRadius"><span>{scope==='city'?'City coverage':'Radius'} <b>{scope==='city'?Math.min(25,Math.max(5,radius)):radius} km</b></span><input type="range" min={scope==='city'?5:1} max={scope==='city'?25:100} value={radius} onChange={event=>setRadius(Number(event.target.value))}/></label>}
   <div className="offlineCenter"><MapPin/><span><b>{config.region}</b>{config.bounds.map(value=>value.toFixed(2)).join(' · ')}</span></div>
   {availableLayers.length?<fieldset className="offlineLayerList" disabled={Boolean(progress)}><legend>Official layers</legend>{availableLayers.map(id=><label key={id}><input type="checkbox" checked={layers.includes(id)} onChange={()=>toggle(id)}/><span><Check/><b>{OFFLINE_LAYERS[id].label}</b></span></label>)}</fieldset>:<div className="offlineError">{OFFLINE_COUNTRIES[country].offlineNote}</div>}
   <fieldset className="offlineMapChoice" disabled={Boolean(progress)}>
    <legend>Offline map</legend>
    <button type="button" className={basemapType==='street'?'active':''} aria-pressed={basemapType==='street'} onClick={()=>setBasemapType('street')}><Map/><span><b>Street</b><small>Roads and places</small></span></button>
    <button type="button" className={basemapType==='satellite'?'active':''} aria-pressed={basemapType==='satellite'} onClick={()=>setBasemapType('satellite')}><Satellite/><span><b>Satellite</b><small>Cloudless imagery</small></span></button>
   </fieldset>
   <label className="offlineQuality"><span>Map quality <b>{qualityLabel} · zoom {qualityZoom}</b></span><input aria-label="Offline map quality" type="range" min={qualityMin} max={qualityMax} value={qualityZoom} disabled={Boolean(progress)} onChange={event=>setQualityOffset(Number(event.target.value)-baseConfig.basemapMaxZoom)}/><small><i>Smaller download</i><i>{basemapType==='satellite'?'Native detail ends at zoom 13':'More detail'}</i></small></label>
   <div className="offlineCenter">{basemapType==='satellite'?<Satellite/>:<Map/>}<span><b>Offline {basemapType} map included</b>Whole-world overview at zoom 0–2 · selected area through zoom {qualityZoom} · {shownEstimate.tileCount?.toLocaleString()??'…'} tiles</span></div>
   <div className="offlineEstimate"><Database/><span><small>{sourceEstimate?'SOURCE-CHECKED ESTIMATE':'ESTIMATING PACKAGE'}</small><b>{shownEstimate.label}</b><i>about {shownEstimate.items.toLocaleString()} items · final size depends on feature geometry</i></span></div>
   {storage?.supported&&<div className="offlineStorage"><span><b>{storage.persistent?'Protected storage':'Browser-managed storage'}</b>{formatBytes(storage.usageBytes)} used of {formatBytes(storage.quotaBytes)} · {formatBytes(storage.freeBytes)} available</span><i><b style={{width:`${storage.quotaBytes?Math.min(100,storage.usageBytes/storage.quotaBytes*100):0}%`}}/></i><small>{storage.persistent?'This browser has granted persistent storage.':'A persistence request is made when you download.'}</small></div>}
   {progress&&<div className="offlineBuildProgress" role="status" aria-live="polite"><span><b>{progress.percent}%</b>{progress.stage}</span><i><b style={{width:`${progress.percent}%`}}/></i><small>{progress.items.toLocaleString()} items received</small></div>}
   {tooLarge&&<div className="offlineError">This full-quality country would need {shownEstimate.tileCount?.toLocaleString()} tiles. Lower the selected-area quality until it is below {MAX_OFFLINE_TILES.toLocaleString()} tiles.</div>}
   {error&&<div className="offlineError">{error}</div>}
   <button className="primary offlineDownload" disabled={Boolean(progress)||tooLarge} onClick={()=>void download()}><Download/>{progress?'Downloading package…':tooLarge?'Reduce selected-area quality':`Download about ${shownEstimate.label}`}</button>
   <small>Official context: {OFFLINE_COUNTRIES[country].source}. {basemapType==='satellite'?'Satellite: Sentinel-2 cloudless by EOX IT Services GmbH (modified Copernicus Sentinel data 2016/2017), CC BY 4.0.':'Basemap: OpenFreeMap / OpenMapTiles with © OpenStreetMap contributors.'} Offline data is planning support, not legal clearance. Temporary restrictions can change after download.</small>
  </section>
 </div>;
}
