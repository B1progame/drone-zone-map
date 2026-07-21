import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bot, CloudSun, Heart, Home, Layers3, LocateFixed, Map, MapPin, Search, Settings, Share, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { Page, Location, Weather, ZoneInfo } from './types';
import { sources, sourceFor, type Source } from './data/sources';
import { searchLocation, searchLocationSuggestions, type LocationSuggestion } from './services';
import { t } from './languages';
import { zoneDisclaimer, zoneText, zoneWeatherMetrics, zoneWeatherQuality } from './zoneTranslations';

export function Logo({compact=false}:{compact?:boolean}) { return <div className="brand" aria-label="Aeris Airspace"><img src="/aeris-logo.svg" alt=""/>{!compact&&<span><b>AERIS</b><small>DRONE AIRSPACE</small></span>}</div> }

export const Disclaimer=({language='en'}:{language?:string})=> <div className="disclaimer"><ShieldAlert size={15}/><span>{zoneDisclaimer(language)}</span></div>;
const pageMeta: {id:Page; icon:typeof Home}[]=[{id:'home',icon:Home},{id:'map',icon:Map},{id:'weather',icon:CloudSun},{id:'ai',icon:Bot},{id:'saved',icon:Heart}];
export function Nav({page,setPage,language='en',showAi=false}:{page:Page;setPage:(p:Page)=>void;language?:string;showAi?:boolean}) {
  const visiblePageMeta=showAi?pageMeta:pageMeta.filter(item=>item.id!=='ai');
  const dockRef=useRef<HTMLElement>(null),sliderRef=useRef<HTMLElement>(null),buttonRefs=useRef<(HTMLButtonElement|null)[]>([]);
  const previousIndex=useRef(visiblePageMeta.findIndex(item=>item.id===page)),selectorAnimation=useRef<Animation|null>(null);
  useLayoutEffect(()=>{
    const dock=dockRef.current;
    if(!dock)return;
    const index=visiblePageMeta.findIndex(item=>item.id===page),button=buttonRefs.current[index],slider=sliderRef.current;
    const position=()=>{
      if(!button)return;
      dock.style.setProperty('--slider-x',`${button.offsetLeft}px`);
      dock.style.setProperty('--slider-width',`${button.offsetWidth}px`);
    };
    position();
    const distance=Math.abs(index-previousIndex.current);
    if(slider&&distance>0&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches){
      const direction=index>previousIndex.current?1:-1;
      const horizontalStretch=1+Math.min(distance,4)*.13;
      const duration=440+Math.min(distance,4)*75;
      dock.style.setProperty('--selector-duration',`${duration}ms`);
      dock.style.setProperty('--liquid-dir',String(direction));
      selectorAnimation.current?.cancel();
      selectorAnimation.current=slider.animate([
        {scale:'1 1',borderRadius:'19px',filter:'blur(0)',offset:0},
        {scale:`${horizontalStretch} .82`,borderRadius:direction>0?'14px 25px 25px 14px':'25px 14px 14px 25px',filter:'blur(.25px)',offset:.34},
        {scale:'.96 1.12',borderRadius:direction>0?'24px 16px 16px 24px':'16px 24px 24px 16px',filter:'blur(0)',offset:.7},
        {scale:'1 1',borderRadius:'18px',offset:1}
      ],{duration,easing:'cubic-bezier(.22,.8,.28,1)',fill:'none'});
    }
    previousIndex.current=index;
    const observer=new ResizeObserver(position);
    observer.observe(dock);
    buttonRefs.current.forEach(button=>button&&observer.observe(button));
    return()=>observer.disconnect();
  },[page,showAi]);
  return <nav ref={dockRef} className="dock" aria-label="Main navigation"><i ref={sliderRef} className="dockSlider" aria-hidden="true"/>{visiblePageMeta.map((x,index)=>{const I=x.icon,label=t(language,x.id);return <button ref={node=>{buttonRefs.current[index]=node}} className={page===x.id?'active':''} onClick={()=>setPage(x.id)} aria-label={label} aria-current={page===x.id?'page':undefined} key={x.id}><span className="navIcon"><I size={19}/></span><span className="navLabel">{label}</span></button>})}</nav>
}
export function SearchBox({onLocation,hero=false,language='en',compact=false}:{onLocation:(l:Location)=>void;hero?:boolean;language?:string;compact?:boolean}) {
  const [value,setValue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false),[open,setOpen]=useState(false),[suggestions,setSuggestions]=useState<LocationSuggestion[]>([]),[suggestionsOpen,setSuggestionsOpen]=useState(false),[activeSuggestion,setActiveSuggestion]=useState(0),[suggesting,setSuggesting]=useState(false);
  const inputRef=useRef<HTMLInputElement>(null),chosenValueRef=useRef('');
  useEffect(()=>{if(open)window.setTimeout(()=>inputRef.current?.focus(),30)},[open]);
  useEffect(()=>{
    const query=value.trim();if(query.length<2||query===chosenValueRef.current){setSuggestions([]);setSuggestionsOpen(false);setSuggesting(false);return}
    const controller=new AbortController(),timer=window.setTimeout(()=>{
      setSuggesting(true);
      void searchLocationSuggestions(query,language,controller.signal).then(results=>{setSuggestions(results);setActiveSuggestion(0);setSuggestionsOpen(results.length>0)}).catch(reason=>{if(reason?.name!=='AbortError')setSuggestions([])}).finally(()=>setSuggesting(false));
    },220);
    return()=>{window.clearTimeout(timer);controller.abort()};
  },[value,language]);
  const chooseSuggestion=(location:LocationSuggestion)=>{chosenValueRef.current=location.name;setValue(location.name);setSuggestions([]);setSuggestionsOpen(false);setError('');onLocation(location);setOpen(false)};
  const submit=async()=>{
    if(!value.trim())return inputRef.current?.focus();
    setBusy(true);setError('');
    try{
      const location=await searchLocation(value,language);
      if(location){onLocation(location);setSuggestionsOpen(false);setOpen(false)}
      else setError(t(language,'noPlace'));
    }catch{setError(t(language,'searchError'))}
    finally{setBusy(false)}
  };
  const locate=()=>navigator.geolocation?.getCurrentPosition(position=>{onLocation({lat:position.coords.latitude,lng:position.coords.longitude,name:'My location'});setOpen(false)},()=>setError('Location permission was not granted.'),{enableHighAccuracy:true,timeout:10000});
  const search=<div className={'searchWrap '+(hero?'heroSearch':'')}>
    <Search size={19}/>
    <input ref={inputRef} value={value} onChange={e=>{chosenValueRef.current='';setValue(e.target.value);setError('');setSuggestionsOpen(true)}} onFocus={()=>suggestions.length&&setSuggestionsOpen(true)} onBlur={()=>window.setTimeout(()=>setSuggestionsOpen(false),100)} onKeyDown={e=>{
      if(e.key==='ArrowDown'&&suggestionsOpen){e.preventDefault();setActiveSuggestion(index=>Math.min(suggestions.length-1,index+1))}
      else if(e.key==='ArrowUp'&&suggestionsOpen){e.preventDefault();setActiveSuggestion(index=>Math.max(0,index-1))}
      else if(e.key==='Enter'){e.preventDefault();if(suggestionsOpen&&suggestions[activeSuggestion])chooseSuggestion(suggestions[activeSuggestion]);else void submit()}
      else if(e.key==='Escape'){setSuggestionsOpen(false);if(compact)setOpen(false)}
    }} placeholder={t(language,'search')} aria-label="Place or coordinates" role="combobox" aria-autocomplete="list" aria-expanded={suggestionsOpen} aria-controls="location-suggestions" aria-activedescendant={suggestionsOpen?`location-suggestion-${activeSuggestion}`:undefined}/>
    <button className="searchSubmit" onClick={()=>void submit()} disabled={busy} aria-label={busy?t(language,'finding'):t(language,'check')}><Search className="searchSubmitIcon"/><span>{busy?t(language,'finding'):t(language,'check')}</span></button>
    <button className="searchLocate" onClick={locate} aria-label={t(language,'locate')} title={t(language,'locate')}><LocateFixed/></button>
    {compact&&<button className="compactSearchClose" onClick={()=>setOpen(false)} aria-label="Close location search"><X/></button>}
    {suggestionsOpen&&<div className="searchSuggestions" id="location-suggestions" role="listbox" aria-label="Place suggestions">{suggestions.map((suggestion,index)=><button id={`location-suggestion-${index}`} role="option" aria-selected={index===activeSuggestion} className={index===activeSuggestion?'active':''} key={`${suggestion.lat},${suggestion.lng}`} onMouseDown={event=>event.preventDefault()} onMouseEnter={()=>setActiveSuggestion(index)} onClick={()=>chooseSuggestion(suggestion)}><MapPin/><span><b>{suggestion.primary}</b><small>{suggestion.secondary}</small></span><i>{suggestion.lat.toFixed(2)}, {suggestion.lng.toFixed(2)}</i></button>)}</div>}
    {suggesting&&value.trim().length>=2&&!suggestionsOpen&&<div className="searchSuggesting" role="status">Finding places…</div>}
    {error&&<small>{error}</small>}
  </div>;
  if(!compact)return search;
  return <div className={`responsiveSearch${open?' open':''}`}>
    <button className="compactSearchTrigger liquid" onClick={()=>setOpen(value=>!value)} aria-label="Open location search" aria-expanded={open}><Search/></button>
    <div className="compactSearchPopover">{search}</div>
  </div>;
}
export function ResultCard({location,weather,zoneInfo,onSave,onClose,language='en'}:{location:Location;weather?:Weather;zoneInfo?:ZoneInfo;onSave:()=>void;onClose:()=>void;language?:string}) {
 const loaded=zoneInfo?.status==='loaded';
 const status=!zoneInfo?t(language,'checking'):loaded?zoneText(language,'intersects',{count:zoneInfo.zones.length,zones:zoneText(language,zoneInfo.zones.length===1?'zone':'zones'),source:zoneInfo.sourceName}):zoneInfo.status==='none'?zoneText(language,'none',{source:zoneInfo.sourceName}):zoneInfo.status==='unsupported'?zoneText(language,'handoff',{country:zoneInfo.countryName}):zoneText(language,'unavailable',{country:zoneInfo.countryName});
 return <aside className="resultCard liquid">
  <div className="sheetHandle"/>
  <button className="resultClose" onClick={onClose} aria-label={t(language,'close')} title={t(language,'close')}><X/></button>
  <div className="eyebrow">{t(language,'result')}</div><h2>{location.name}</h2>
  <div className={'status '+(loaded?'caution':'unknown')}><span/>{status}</div>
  {zoneInfo?.zones.length?<div className="zoneResults">{zoneInfo.zones.slice(0,12).map(zone=><details key={zone.id} open={zoneInfo.zones.length===1}><summary><div><b>{zone.name}</b><span>{zone.type}</span></div><i>+</i></summary><div className="zoneBody">{zone.message&&<p>{zone.message}</p>}{zone.pilotAction&&<p><b>{zoneText(language,'pilot')}:</b> {zone.pilotAction}</p>}<dl>{zone.originalName&&zone.originalName!==zone.name&&<><dt>{zoneText(language,'originalName')}</dt><dd>{zone.originalName}</dd></>}{zone.originalMessage&&zone.originalMessage!==zone.message&&<><dt>{zoneText(language,'originalText')}</dt><dd>{zone.originalMessage}</dd></>}{zone.officialLayerName&&<><dt>{zoneText(language,'layer')}</dt><dd>{zone.officialLayerName}</dd></>}{zone.lower&&<><dt>{zoneText(language,'lower')}</dt><dd>{zone.lower}</dd></>}{zone.upper&&<><dt>{zoneText(language,'upper')}</dt><dd>{zone.upper}</dd></>}{zone.legalReference&&<><dt>{zoneText(language,'legal')}</dt><dd>{zone.legalReference}</dd></>}{zone.authority&&<><dt>{zoneText(language,'authority')}</dt><dd>{zone.authority}</dd></>}{zone.contact&&<><dt>{zoneText(language,'contact')}</dt><dd>{zone.contact}</dd></>}{zone.updated&&<><dt>{zoneText(language,'updated')}</dt><dd>{zone.updated}</dd></>}{zone.sourceUrl&&<><dt>{zoneText(language,'source')}</dt><dd><a href={zone.sourceUrl} target="_blank" rel="noreferrer">{zone.source} ↗</a></dd></>}</dl></div></details>)}</div>:zoneInfo&&<p>{zoneInfo.status==='none'?`${zoneText(language,'none',{source:zoneInfo.sourceName})} ${zoneText(language,'caveat')}`:zoneInfo.warning}</p>}
  {zoneInfo?.zones.length?<p className="zoneCaveat">{zoneText(language,'caveat')}</p>:null}
  {weather&&<div className="weatherline"><CloudSun size={19}/><div><b>{weather.score}/100 · {zoneWeatherQuality(language,weather.score)}</b><span>{zoneWeatherMetrics(language,weather.wind,weather.rainProbability)}</span></div></div>}
  <div className="cardActions"><button onClick={onSave}><Heart size={16}/> {zoneText(language,'save')}</button>{zoneInfo?.sourceUrl&&zoneInfo.sourceUrl!=='#'&&<a href={zoneInfo.sourceUrl} target="_blank" rel="noreferrer">{t(language,'official')} ↗</a>}</div><Disclaimer language={language}/>
 </aside>;
}

export function SourcePanel(){const [registry,setRegistry]=useState<Source[]>(sources),[query,setQuery]=useState(''),[expanded,setExpanded]=useState(false);useEffect(()=>{fetch(`${import.meta.env.BASE_URL}data/sources/countries.json`).then(r=>r.ok?r.json():[]).then((rows:unknown[])=>setRegistry(rows.map((row:any)=>({code:row.countryCode,country:row.countryName,name:row.sourceName,status:String(row.status).replaceAll('_',' '),url:row.officialMapUrl,detail:row.warnings?.[0]})))).catch(()=>{})},[]);const shown=useMemo(()=>registry.filter(s=>(s.country+s.name).toLowerCase().includes(query.toLowerCase())),[registry,query]);const visible=expanded?shown:shown.slice(0,6);return <section className="sources liquid"><div className="sourceHead"><div><div className="eyebrow">OFFICIAL DIRECTORY · {registry.length} COUNTRIES</div><h2>Know what is actually loaded.</h2></div><Layers3/></div><div className="sourceSearch"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a country or authority"/></div><div className="sourceGrid">{visible.map(s=><article key={s.code}><div className="countryCode">{s.code}</div><div><b>{s.country}</b><span className="sourceStatus">{s.status}</span><p>{s.name}</p><a href={s.url} target="_blank" rel="noreferrer">Open official source ↗</a></div></article>)}</div>{shown.length>6&&<button className="wideButton" onClick={()=>setExpanded(!expanded)}>{expanded?'Show fewer sources':`Explore all ${shown.length} sources`}</button>}</section>}
export function Preferences({close}:{close:()=>void}){const [open,setOpen]=useState(true);useEffect(()=>{if(localStorage.getItem('dzm-consent'))setOpen(false)},[]); if(!open)return null;const dismiss=()=>{localStorage.setItem('dzm-consent','yes');setOpen(false);close()};return <div className="consent liquid"><button className="icon" onClick={dismiss} aria-label="Close privacy notice"><X size={16}/></button><Sparkles size={20}/><b>Private by default.</b><p>Preferences and saved places stay on this device. No tracking cookies.</p><button onClick={dismiss}>Continue</button></div>}
export function IosInstallPrompt(){
 const [open,setOpen]=useState(false);
 useEffect(()=>{
  const nav=navigator as Navigator&{standalone?:boolean};
  const ios=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
  const standalone=Boolean(nav.standalone)||window.matchMedia('(display-mode: standalone)').matches;
  setOpen(ios&&!standalone&&!localStorage.getItem('aeris-ios-install-dismissed'));
 },[]);
 if(!open)return null;
 const dismiss=()=>{localStorage.setItem('aeris-ios-install-dismissed','1');setOpen(false)};
 return <aside className="iosInstall liquid" role="status" aria-label="Add Aeris to your Home Screen"><button className="icon" onClick={dismiss} aria-label="Close Add to Home Screen instructions"><X size={16}/></button><Share size={20}/><div><b>Add Aeris to Home Screen</b><p>In Safari, tap <strong>Share</strong>, then <strong>Add to Home Screen</strong>. Aeris will use its own icon and open like an app.</p></div></aside>
}
export function Header({setSettings}:{setSettings:()=>void}) {return <header><Logo/><button className="icon liquid" onClick={setSettings} aria-label="Settings"><Settings size={19}/></button></header>}
