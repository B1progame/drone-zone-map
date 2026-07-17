import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Bot, CloudSun, Heart, Home, Layers3, LocateFixed, Map, Search, Settings, ShieldAlert, Sparkles, X } from 'lucide-react';
import type { Page, Location, Weather, ZoneInfo } from './types';
import { sources, sourceFor, type Source } from './data/sources';
import { searchLocation, quality } from './services';
import { t } from './languages';

export function Logo({compact=false}:{compact?:boolean}) { return <div className="brand" aria-label="Aeris Airspace"><svg viewBox="0 0 44 44" role="img"><defs><linearGradient id="logoGlow" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#e9ffd9"/><stop offset="1" stopColor="#74f296"/></linearGradient></defs><path d="M22 4 38 13v18L22 40 6 31V13Z" fill="none" stroke="url(#logoGlow)" strokeWidth="2"/><path d="M13 25c5-1 7-4 9-11 2 7 4 10 9 11-5 1-7 3-9 7-2-4-4-6-9-7Z" fill="url(#logoGlow)"/><circle cx="22" cy="22" r="3" fill="#07120f"/></svg>{!compact&&<span><b>AERIS</b><small>DRONE AIRSPACE</small></span>}</div> }

export const Disclaimer=()=> <div className="disclaimer"><ShieldAlert size={15}/><span>This is not legal clearance. Check the official national aviation source before takeoff.</span></div>;
const pageMeta: {id:Page; icon:typeof Home}[]=[{id:'home',icon:Home},{id:'map',icon:Map},{id:'weather',icon:CloudSun},{id:'ai',icon:Bot},{id:'saved',icon:Heart}];
export function Nav({page,setPage,language='en'}:{page:Page;setPage:(p:Page)=>void;language?:string}) {
  const dockRef=useRef<HTMLElement>(null),sliderRef=useRef<HTMLElement>(null),buttonRefs=useRef<(HTMLButtonElement|null)[]>([]);
  const previousIndex=useRef(pageMeta.findIndex(item=>item.id===page)),selectorAnimation=useRef<Animation|null>(null);
  useLayoutEffect(()=>{
    const dock=dockRef.current;
    if(!dock)return;
    const index=pageMeta.findIndex(item=>item.id===page),button=buttonRefs.current[index],slider=sliderRef.current;
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
  },[page]);
  return <nav ref={dockRef} className="dock" aria-label="Main navigation"><i ref={sliderRef} className="dockSlider" aria-hidden="true"/>{pageMeta.map((x,index)=>{const I=x.icon,label=t(language,x.id);return <button ref={node=>{buttonRefs.current[index]=node}} className={page===x.id?'active':''} onClick={()=>setPage(x.id)} aria-label={label} aria-current={page===x.id?'page':undefined} key={x.id}><span className="navIcon"><I size={19}/></span><span className="navLabel">{label}</span></button>})}</nav>
}
export function SearchBox({onLocation,hero=false,language='en'}:{onLocation:(l:Location)=>void;hero?:boolean;language?:string}) {const [value,setValue]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);const submit=async()=>{setBusy(true);setError('');try{const location=await searchLocation(value,language);if(location)onLocation(location);else setError(t(language,'noPlace'))}catch{setError(t(language,'searchError'))}finally{setBusy(false)}};const locate=()=>navigator.geolocation?.getCurrentPosition(position=>onLocation({lat:position.coords.latitude,lng:position.coords.longitude,name:'My location'}),()=>setError('Location permission was not granted.'),{enableHighAccuracy:true,timeout:10000});return <div className={'searchWrap '+(hero?'heroSearch':'')}><Search size={19}/><input value={value} onChange={e=>setValue(e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()} placeholder={t(language,'search')} aria-label="Place or coordinates"/><button onClick={submit} disabled={busy}>{busy?t(language,'finding'):t(language,'check')}</button><button className="searchLocate" onClick={locate} aria-label={t(language,'locate')} title={t(language,'locate')}><LocateFixed/></button>{error&&<small>{error}</small>}</div>}
export function ResultCard({location,weather,zoneInfo,onSave,onClose,language='en'}:{location:Location;weather?:Weather;zoneInfo?:ZoneInfo;onSave:()=>void;onClose:()=>void;language?:string}) {const loaded=zoneInfo?.status==='loaded';return <aside className="resultCard liquid"><div className="sheetHandle"/><button className="resultClose" onClick={onClose} aria-label={t(language,'close')} title={t(language,'close')}><X/></button><div className="eyebrow">{t(language,'result')}</div><h2>{location.name}</h2><div className={'status '+(loaded?'caution':'unknown')}><span/>{!zoneInfo?t(language,'checking'):loaded?`${zoneInfo.zones.length} overlapping ${zoneInfo.zones.length===1?'zone':'zones'} · ${zoneInfo.sourceName}`:zoneInfo.status==='none'?`No zone returned by ${zoneInfo.sourceName}`:zoneInfo.status==='unsupported'?`${zoneInfo.countryName} · official map handoff`:`${zoneInfo.countryName} · official source unavailable`}</div>{zoneInfo?.zones.length?<div className="zoneResults">{zoneInfo.zones.slice(0,8).map(zone=><details key={zone.id} open={zoneInfo.zones.length===1}><summary><div><b>{zone.name}</b><span>{zone.type}</span></div><i>+</i></summary><div className="zoneBody">{zone.message&&<p>{zone.message}</p>}<dl>{zone.lower&&<><dt>Lower limit</dt><dd>{zone.lower}</dd></>}{zone.upper&&<><dt>Upper limit</dt><dd>{zone.upper}</dd></>}{zone.legalReference&&<><dt>Legal reference</dt><dd>{zone.legalReference}</dd></>}{zone.contact&&<><dt>Contact</dt><dd>{zone.contact}</dd></>}</dl></div></details>)}</div>:zoneInfo&&<p>{zoneInfo.status==='none'?'The official point query returned no overlapping zone. Normal rules and unrepresented restrictions still apply.':zoneInfo.warning}</p>}{weather&&<div className="weatherline"><CloudSun size={19}/><div><b>{weather.score}/100 · {quality(weather.score)}</b><span>{weather.wind} km/h wind · {weather.rainProbability}% rain</span></div></div>}<div className="cardActions"><button onClick={onSave}><Heart size={16}/> Save location</button>{zoneInfo?.sourceUrl&&zoneInfo.sourceUrl!=='#'&&<a href={zoneInfo.sourceUrl} target="_blank" rel="noreferrer">{t(language,'official')} ↗</a>}</div><Disclaimer/></aside>}

export function SourcePanel(){const [registry,setRegistry]=useState<Source[]>(sources),[query,setQuery]=useState(''),[expanded,setExpanded]=useState(false);useEffect(()=>{fetch(`${import.meta.env.BASE_URL}data/sources/countries.json`).then(r=>r.ok?r.json():[]).then((rows:unknown[])=>setRegistry(rows.map((row:any)=>({code:row.countryCode,country:row.countryName,name:row.sourceName,status:String(row.status).replaceAll('_',' '),url:row.officialMapUrl,detail:row.warnings?.[0]})))).catch(()=>{})},[]);const shown=useMemo(()=>registry.filter(s=>(s.country+s.name).toLowerCase().includes(query.toLowerCase())),[registry,query]);const visible=expanded?shown:shown.slice(0,6);return <section className="sources liquid"><div className="sourceHead"><div><div className="eyebrow">OFFICIAL DIRECTORY · {registry.length} COUNTRIES</div><h2>Know what is actually loaded.</h2></div><Layers3/></div><div className="sourceSearch"><Search size={16}/><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="Find a country or authority"/></div><div className="sourceGrid">{visible.map(s=><article key={s.code}><div className="countryCode">{s.code}</div><div><b>{s.country}</b><span className="sourceStatus">{s.status}</span><p>{s.name}</p><a href={s.url} target="_blank" rel="noreferrer">Open official source ↗</a></div></article>)}</div>{shown.length>6&&<button className="wideButton" onClick={()=>setExpanded(!expanded)}>{expanded?'Show fewer sources':`Explore all ${shown.length} sources`}</button>}</section>}
export function Preferences({close}:{close:()=>void}){const [open,setOpen]=useState(true);useEffect(()=>{if(localStorage.getItem('dzm-consent'))setOpen(false)},[]); if(!open)return null;const dismiss=()=>{localStorage.setItem('dzm-consent','yes');setOpen(false);close()};return <div className="consent liquid"><button className="icon" onClick={dismiss} aria-label="Close privacy notice"><X size={16}/></button><Sparkles size={20}/><b>Private by default.</b><p>Preferences and saved places stay on this device. No tracking cookies.</p><button onClick={dismiss}>Continue</button></div>}
export function Header({setSettings}:{setSettings:()=>void}) {return <header><Logo/><button className="icon liquid" onClick={setSettings} aria-label="Settings"><Settings size={19}/></button></header>}
