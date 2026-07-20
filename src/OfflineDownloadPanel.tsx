import { useEffect, useMemo, useState } from 'react';
import { Check, Database, Download, Map, MapPin, Satellite, X } from 'lucide-react';
import type { Location, Weather, ZoneInfo } from './types';
import { createOfflineConfig, createOfflinePack, estimateOfflinePackage, estimateOfflinePackageFromSource, formatBytes, getOfflineStorageStatus, GERMAN_STATES, MAX_OFFLINE_TILES, maxOfflineBasemapZoom, offlineTileCount, OFFLINE_COUNTRIES, OFFLINE_LAYERS, radiusBounds, type OfflineBasemapType, type OfflineBounds, type OfflineCountryCode, type OfflineDownloadProgress, type OfflineLayerId, type OfflinePackConfig, type OfflineScope, type OfflineStorageStatus } from './offline';

const WORLD_BOUNDS:OfflineBounds=[-180,-85.0511,180,85.0511];
const clampWorldBounds=([west,south,east,north]:OfflineBounds):OfflineBounds=>[
 Math.max(WORLD_BOUNDS[0],west),Math.max(WORLD_BOUNDS[1],south),Math.min(WORLD_BOUNDS[2],east),Math.min(WORLD_BOUNDS[3],north)
];
const formatEta=(seconds:number)=>{
 const rounded=Math.max(1,Math.ceil(seconds));
 if(rounded<60)return`about ${rounded}s remaining`;
 const minutes=Math.floor(rounded/60),remaining=rounded%60;
 return remaining?`about ${minutes}m ${remaining}s remaining`:`about ${minutes}m remaining`;
};

function withoutAreaLimit(base:OfflinePackConfig,scope:OfflineScope,location:Location,radiusKm:number){
 if(scope!=='radius'&&scope!=='city')return base;
 const effectiveRadius=Math.max(1,Number.isFinite(radiusKm)?radiusKm:20),bounds=clampWorldBounds(radiusBounds(location,effectiveRadius));
 return{...base,region:scope==='city'?`${location.name} · ${effectiveRadius} km coverage`:`${effectiveRadius} km around ${location.name}`,center:location,radiusKm:effectiveRadius,bounds};
}

function splitLargeConfig(config:OfflinePackConfig){
 const queue:OfflineBounds[]=[config.bounds],parts:OfflineBounds[]=[];
 while(queue.length){
  const bounds=queue.shift()!;
  const types=config.basemapTypes?.length?config.basemapTypes:[config.basemapType??'street'];
  const tiles=types.reduce((total,type)=>total+offlineTileCount(bounds,config.basemapMaxZooms?.[type]??config.basemapMaxZoom),0);
  if(tiles<=MAX_OFFLINE_TILES){parts.push(bounds);continue}
  const[west,south,east,north]=bounds,width=east-west,height=north-south;
  if(width>=height){const middle=(west+east)/2;queue.push([west,south,middle,north],[middle,south,east,north])}
  else{const middle=(south+north)/2;queue.push([west,south,east,middle],[west,middle,east,north])}
 }
 if(parts.length===1)return[config];
 return parts.map((bounds,index)=>({...config,scope:'country' as const,region:`${config.region} · section ${index+1}/${parts.length}`,center:{lng:(bounds[0]+bounds[2])/2,lat:(bounds[1]+bounds[3])/2,name:config.region},radiusKm:undefined,bounds}));
}

export function OfflineDownloadPanel({location,weather,zoneInfo,onClose,onSaved}:{location:Location;weather?:Weather;zoneInfo?:ZoneInfo;onClose:()=>void;onSaved:()=>void}){
 const detected=(zoneInfo?.countryCode&&zoneInfo.countryCode in OFFLINE_COUNTRIES?zoneInfo.countryCode:'DE') as OfflineCountryCode;
 const[scope,setScope]=useState<OfflineScope>('radius'),[country,setCountry]=useState<OfflineCountryCode>(detected),[stateName,setStateName]=useState('Berlin'),[radius,setRadius]=useState(20),[layers,setLayers]=useState<OfflineLayerId[]>(OFFLINE_COUNTRIES[detected].layers),[basemapTypes,setBasemapTypes]=useState<OfflineBasemapType[]>(['street','satellite']),[qualityOffset,setQualityOffset]=useState(0),[progress,setProgress]=useState<OfflineDownloadProgress>(),[etaSample,setEtaSample]=useState<{startedAt:number;percent:number}>(),[clock,setClock]=useState(Date.now()),[error,setError]=useState(''),[sourceEstimate,setSourceEstimate]=useState<{bytes:number;items:number;tileCount?:number;label:string}>(),[storage,setStorage]=useState<OfflineStorageStatus>();
 const availableLayers=OFFLINE_COUNTRIES[country].layers;
 const limitedBaseConfig=useMemo(()=>createOfflineConfig(scope,location,layers,stateName,radius,country),[scope,location,layers,stateName,radius,country]);
 const baseConfig=useMemo(()=>withoutAreaLimit(limitedBaseConfig,scope,location,radius),[limitedBaseConfig,scope,location,radius]);
 const streetMax=useMemo(()=>maxOfflineBasemapZoom(baseConfig.bounds,'street'),[baseConfig.bounds]),satelliteMax=useMemo(()=>maxOfflineBasemapZoom(baseConfig.bounds,'satellite'),[baseConfig.bounds]),qualityMax=basemapTypes.includes('street')?streetMax:satelliteMax,qualityMin=Math.min(5,qualityMax),streetZoom=Math.max(qualityMin,Math.min(streetMax,baseConfig.basemapMaxZoom+qualityOffset)),satelliteZoom=Math.max(qualityMin,Math.min(satelliteMax,baseConfig.basemapMaxZoom+qualityOffset));
 const qualityLabel=basemapTypes.every(type=>(type==='street'?streetZoom===streetMax:satelliteZoom===satelliteMax))?'Maximum':Math.max(...basemapTypes.map(type=>type==='street'?streetZoom:satelliteZoom))<=qualityMin?'Compact':Math.max(...basemapTypes.map(type=>type==='street'?streetZoom:satelliteZoom))<=baseConfig.basemapMaxZoom?'Balanced':'High';
 const config=useMemo(()=>({...baseConfig,basemapTypes,basemapType:basemapTypes[0],basemapMaxZoom:Math.max(...basemapTypes.map(type=>type==='street'?streetZoom:satelliteZoom)),basemapMaxZooms:{street:streetZoom,satellite:satelliteZoom}}),[baseConfig,basemapTypes,streetZoom,satelliteZoom]);
 const downloadConfigs=useMemo(()=>splitLargeConfig(config),[config]);
 const estimate=useMemo(()=>estimateOfflinePackage(config),[config]);
 const shownEstimate=sourceEstimate??estimate;
 useEffect(()=>{let active=true;setSourceEstimate(undefined);const timer=window.setTimeout(()=>void estimateOfflinePackageFromSource(config).then(value=>{if(active)setSourceEstimate(value)}).catch(()=>{}),250);return()=>{active=false;window.clearTimeout(timer)}},[config]);
 useEffect(()=>{let active=true;void getOfflineStorageStatus().then(value=>{if(active)setStorage(value)});return()=>{active=false}},[]);
 useEffect(()=>{if(!progress||!etaSample)return;const timer=window.setInterval(()=>setClock(Date.now()),1000);return()=>window.clearInterval(timer)},[progress,etaSample]);
 const toggle=(id:OfflineLayerId)=>setLayers(value=>value.includes(id)?value.filter(item=>item!==id):[...value,id]);
 const toggleBasemap=(type:OfflineBasemapType)=>setBasemapTypes(value=>value.includes(type)?(value.length===1?value:value.filter(item=>item!==type)):[...value,type]);
 const chooseCountry=(next:OfflineCountryCode)=>{setCountry(next);setLayers(OFFLINE_COUNTRIES[next].layers);if(next!=='DE'&&scope==='state')setScope('country')};
 const reportProgress=(value:OfflineDownloadProgress)=>{setProgress(value);if(value.percent>=15)setEtaSample(sample=>sample??{startedAt:Date.now(),percent:value.percent})};
 const etaSeconds=progress&&etaSample&&progress.percent>etaSample.percent&&clock-etaSample.startedAt>=1500?(clock-etaSample.startedAt)/1000*(100-progress.percent)/(progress.percent-etaSample.percent):undefined;
 const download=async()=>{
  setError('');setEtaSample(undefined);setClock(Date.now());
  try{
   setStorage(await getOfflineStorageStatus(true));
   for(let index=0;index<downloadConfigs.length;index++)await createOfflinePack(downloadConfigs[index],weather,zoneInfo,value=>reportProgress({percent:Math.round((index+value.percent/100)/downloadConfigs.length*100),stage:downloadConfigs.length>1?`Section ${index+1}/${downloadConfigs.length} · ${value.stage}`:value.stage,items:value.items}));
   onSaved();window.setTimeout(onClose,650);
  }catch(reason){setError(reason instanceof Error?reason.message:'The package could not be downloaded.');setProgress(undefined);setEtaSample(undefined)}
 };
 return <div className="modalShade offlineShade" role="dialog" aria-modal="true" aria-labelledby="offline-title">
  <section className="settings offlineBuilder liquid">
   <button className="close" onClick={onClose} aria-label="Close offline download"><X/></button>
   <div className="eyebrow">OFFLINE FLIGHT PACKAGE · {OFFLINE_COUNTRIES[country].name.toUpperCase()}</div>
   <h2 id="offline-title">Download this area</h2>
   <p>There is no app-imposed total download limit. Very large selections are split into as many connected offline sections as needed and continue until the browser storage or network itself stops the download.</p>
   <label>Country<select value={country} onChange={event=>chooseCountry(event.target.value as OfflineCountryCode)} disabled={Boolean(progress)}>{(Object.keys(OFFLINE_COUNTRIES) as OfflineCountryCode[]).map(code=><option value={code} key={code}>{OFFLINE_COUNTRIES[code].name}</option>)}</select></label>
   <label>Area<select value={scope} onChange={event=>setScope(event.target.value as OfflineScope)} disabled={Boolean(progress)}>
    <option value="radius">Custom radius around selected location</option><option value="city">Place / regional coverage</option>{country==='DE'&&<option value="state">Federal state</option>}<option value="country">{OFFLINE_COUNTRIES[country].scopeLabel??`All ${OFFLINE_COUNTRIES[country].name}`}</option>
   </select></label>
   {scope==='state'&&<label>Federal state<select value={stateName} onChange={event=>setStateName(event.target.value)}>{GERMAN_STATES.map(state=><option key={state.name}>{state.name}</option>)}</select></label>}
   {(scope==='radius'||scope==='city')&&<div className="offlinePresets" aria-label="Offline area presets">{[{label:'Local',km:10},{label:'Regional',km:100},{label:'Large',km:500},{label:'Continental',km:2000}].map(preset=><button key={preset.km} className={radius===preset.km?'active':''} disabled={Boolean(progress)} onClick={()=>setRadius(preset.km)}><b>{preset.label}</b><span>{preset.km.toLocaleString()} km</span></button>)}</div>}
   {(scope==='radius'||scope==='city')&&<label className="offlineRadius"><span>Coverage radius <b>{radius.toLocaleString()} km</b></span><input type="range" min={1} max={20000} step={1} value={radius} onChange={event=>setRadius(Number(event.target.value))}/><input aria-label="Offline coverage radius in kilometres" type="number" min={1} max={20000} step={1} value={radius} disabled={Boolean(progress)} onChange={event=>setRadius(Math.max(1,Math.min(20000,Number(event.target.value)||1)))}/><small>Up to the whole usable Web Mercator world. Large areas are divided automatically.</small></label>}
   <div className="offlineCenter"><MapPin/><span><b>{config.region}</b>{config.bounds.map(value=>value.toFixed(2)).join(' · ')}</span></div>
   {availableLayers.length?<fieldset className="offlineLayerList" disabled={Boolean(progress)}><legend>Official layers</legend>{availableLayers.map(id=><label key={id}><input type="checkbox" checked={layers.includes(id)} onChange={()=>toggle(id)}/><span><Check/><b>{OFFLINE_LAYERS[id].label}</b></span></label>)}</fieldset>:<div className="offlineError">{OFFLINE_COUNTRIES[country].offlineNote}</div>}
   <fieldset className="offlineMapChoice" disabled={Boolean(progress)}>
    <legend>Offline maps to download</legend>
    <button type="button" className={basemapTypes.includes('street')?'active':''} aria-pressed={basemapTypes.includes('street')} disabled={basemapTypes.length===1&&basemapTypes.includes('street')} onClick={()=>toggleBasemap('street')}><Map/><span><b>Street</b><small>Roads and places</small></span></button>
    <button type="button" className={basemapTypes.includes('satellite')?'active':''} aria-pressed={basemapTypes.includes('satellite')} disabled={basemapTypes.length===1&&basemapTypes.includes('satellite')} onClick={()=>toggleBasemap('satellite')}><Satellite/><span><b>Satellite</b><small>Cloudless imagery</small></span></button>
    </fieldset>
   <label className="offlineQuality"><span>Map quality <b>{qualityLabel} · street {streetZoom} / satellite {satelliteZoom}</b></span><input aria-label="Offline map quality" type="range" min={qualityMin} max={qualityMax} value={streetZoom} disabled={Boolean(progress)} onChange={event=>setQualityOffset(Number(event.target.value)-baseConfig.basemapMaxZoom)}/><small><i>Smaller download</i><i>Satellite native detail ends at zoom 13</i></small></label>
   <div className="offlineCenter"><Satellite/><span><b>{basemapTypes.length===2?'Street and satellite package':`${basemapTypes[0]==='street'?'Street':'Satellite'} package`}</b>Whole-world overview at zoom 0–2 · selected area through {basemapTypes.map(type=>`${type} ${type==='street'?streetZoom:satelliteZoom}`).join(' and ')} · {shownEstimate.tileCount?.toLocaleString()??'…'} tiles</span></div>
   <div className="offlineEstimate"><Database/><span><small>{sourceEstimate?'SOURCE-CHECKED ESTIMATE':'ESTIMATING PACKAGE'}</small><b>{shownEstimate.label}</b><i>about {shownEstimate.items.toLocaleString()} items · final size depends on feature geometry</i></span></div>
   {storage?.supported&&<div className="offlineStorage"><span><b>{storage.persistent?'Protected storage':'Browser-managed storage'}</b>{formatBytes(storage.usageBytes)} used of {formatBytes(storage.quotaBytes)} · {formatBytes(storage.freeBytes)} currently available</span><i><b style={{width:`${storage.quotaBytes?Math.min(100,storage.usageBytes/storage.quotaBytes*100):0}%`}}/></i><small>The app does not impose a total cap; the browser and device still control physical storage.</small></div>}
   {progress&&<div className="offlineBuildProgress" role="status" aria-live="polite"><span><b>{progress.percent}%</b>{progress.stage}</span><i><b style={{width:`${progress.percent}%`}}/></i><small>{progress.items.toLocaleString()} items received · {etaSeconds==null?'Estimating time remaining…':formatEta(etaSeconds)}</small></div>}
   {downloadConfigs.length>1&&<div className="offlineCenter"><Database/><span><b>Automatic unlimited splitting</b>This selection will be stored as {downloadConfigs.length.toLocaleString()} connected offline sections. There is no total section-count limit.</span></div>}
   {error&&<div className="offlineError">{error}</div>}
   <button className="primary offlineDownload" disabled={Boolean(progress)} onClick={()=>void download()}><Download/>{progress?'Downloading package…':`Download about ${shownEstimate.label}`}</button>
   <small>Official context: {OFFLINE_COUNTRIES[country].source}. Street: OpenFreeMap / OpenMapTiles with © OpenStreetMap contributors. Satellite: Sentinel-2 cloudless by EOX IT Services GmbH (modified Copernicus Sentinel data 2016/2017), CC BY 4.0. Offline data is planning support, not legal clearance. Temporary restrictions can change after download.</small>
  </section>
 </div>;
}
