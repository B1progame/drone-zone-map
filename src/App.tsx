import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ArrowRight, Bot, Camera, Check, CircleDot, Cloud, CloudRain, CloudSun, Compass, Database, Download, Eye, Heart, Layers3, Map as MapIcon, Navigation, Pencil, RefreshCw, Route, Send, ShieldCheck, Sparkles, Star, Trash2, WifiOff, Wind, X } from 'lucide-react';
import type { AppSettings, Location, Page, SavedPlace, SavedRoute, Weather, WeatherHour, ZoneInfo } from './types';
import { getWeather, quality } from './services';
import { getOfficialZoneInfo } from './zoneInfo';
import { deleteAllOfflinePacks, deleteOfflinePack, downloadGeoJson, formatBytes, getOfflineContext, getOfflinePacks, isOfflinePackStale, isOfflineTestMode, refreshOfflinePack, setOfflineTestMode, verifyOfflinePack, type OfflineDownloadProgress, type OfflinePack } from './offline';
import { OfflineDownloadPanel } from './OfflineDownloadPanel';
import { Disclaimer, Header, IosInstallPrompt, Nav, Preferences, ResultCard, SearchBox, SourcePanel } from './components';
import { MapCanvas, type GeoJsonExportProgress, type MapCanvasHandle } from './MapCanvas';
import { normalizeLanguage, SUPPORTED_LANGUAGES } from './languages';
import { FlightPlanner, flightDistance, type FlightPoint } from './FlightPlanner';
import { answerFlightQuestion } from './localAssistant';
import { askOpenRouter, OPENROUTER_MODEL, validateOpenRouterKey } from './openRouter';
import { screenCopy } from './screenCopy';

function inlineMarkdown(text:string){
 const parts:ReactNode[]=[];
 const pattern=/(\*\*[^*]+\*\*|\[[^\]]+\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<]+)/g;
 let cursor=0,index=0;
 for(const match of text.matchAll(pattern)){
  if(match.index!>cursor)parts.push(text.slice(cursor,match.index));
  const token=match[0];
  if(token.startsWith('**'))parts.push(<strong key={index++}>{token.slice(2,-2)}</strong>);
  else{
   const markdownLink=token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
   const rawUrl=markdownLink?.[2]??token;
   let url:string|undefined;
   try{const parsed=new URL(rawUrl);if(parsed.protocol==='https:'||parsed.protocol==='http:')url=parsed.toString()}catch{}
   parts.push(url?<a key={index++} href={url} target="_blank" rel="noreferrer noopener">{markdownLink?.[1]??rawUrl}</a>:token);
  }
  cursor=match.index!+token.length;
 }
 if(cursor<text.length)parts.push(text.slice(cursor));
 return parts;
}

function MarkdownAnswer({text}:{text:string}){
 const nodes:ReactNode[]=[];
 let paragraph:string[]=[],items:string[]=[];
 const flushParagraph=()=>{if(paragraph.length){const value=paragraph.join(' ');nodes.push(<p key={`p-${nodes.length}`}>{inlineMarkdown(value)}</p>);paragraph=[]}};
 const flushItems=()=>{if(items.length){nodes.push(<ul key={`l-${nodes.length}`}>{items.map((item,index)=><li key={index}>{inlineMarkdown(item)}</li>)}</ul>);items=[]}};
 for(const raw of text.replace(/\r/g,'').split('\n')){
  const line=raw.trim();
  if(!line){flushParagraph();flushItems();continue}
  const heading=line.match(/^#{1,4}\s+(.+)$/);
  const bullet=line.match(/^[-*]\s+(.+)$/);
  if(heading){flushParagraph();flushItems();nodes.push(<h4 key={`h-${nodes.length}`}>{inlineMarkdown(heading[1])}</h4>)}
  else if(bullet){flushParagraph();items.push(bullet[1])}
  else{flushItems();paragraph.push(line)}
 }
 flushParagraph();flushItems();
 return <div className="markdownAnswer">{nodes}</div>;
}

export default function App(){
 const [page,setPage]=useState<Page>('home'),[location,setLocation]=useState<Location>(),[weather,setWeather]=useState<Weather>(),[zoneInfo,setZoneInfo]=useState<ZoneInfo>(),[weatherError,setWeatherError]=useState(''),[saved,setSaved]=useState<SavedPlace[]>(()=>JSON.parse(localStorage.getItem('dzm-saved')||'[]')),[settingsOpen,setSettingsOpen]=useState(false);
 const [savedRoutes,setSavedRoutes]=useState<SavedRoute[]>(()=>{try{return JSON.parse(localStorage.getItem('aeris-saved-routes')||'[]')}catch{return[]}});
 const [appSettings,setAppSettings]=useState<AppSettings>(()=>{try{const stored=JSON.parse(localStorage.getItem('aeris-settings')||'{}');return{renderDetail:'balanced',glassOpacity:.72,reducedMotion:false,terrain3d:false,...stored,language:stored.defaultLanguageVersion===2?normalizeLanguage(stored.language):'en'}}catch{return{renderDetail:'balanced',glassOpacity:.72,reducedMotion:false,terrain3d:false,language:'en'}}});
 const chooseRequest=useRef(0);
 const choose=(l:Location,navigate=true)=>{
 const request=++chooseRequest.current;setLocation(l);if(navigate)setPage('map');setWeather(undefined);setZoneInfo(undefined);setWeatherError('');
  if(!navigator.onLine||isOfflineTestMode()){void getOfflineContext(l,appSettings.language).then(context=>{if(request!==chooseRequest.current)return;if(context){setWeather(context.weather);setZoneInfo(context.zoneInfo);setWeatherError(context.weather?'':'Weather was not downloaded for this exact point.')}else setWeatherError('This location is outside every downloaded offline package.')});return}
  void getWeather(l).then(result=>{if(request===chooseRequest.current)setWeather(result)}).catch(async()=>{if(request!==chooseRequest.current)return;const context=await getOfflineContext(l,appSettings.language);if(context?.weather)setWeather(context.weather);else setWeatherError(navigator.onLine?'Live weather is temporarily unavailable.':'This location is outside downloaded weather context.')});
  void getOfficialZoneInfo(l,appSettings.language).then(result=>{if(request===chooseRequest.current)setZoneInfo(result)}).catch(async()=>{if(request!==chooseRequest.current)return;const context=await getOfflineContext(l,appSettings.language);if(context?.zoneInfo)setZoneInfo(context.zoneInfo)});
 };
 const persistSaved=(next:SavedPlace[])=>{setSaved(next);localStorage.setItem('dzm-saved',JSON.stringify(next))};
 const save=()=>{if(!location)return;const existing=saved.find(x=>Math.abs(x.lat-location.lat)<=.00001&&Math.abs(x.lng-location.lng)<=.00001);const place:SavedPlace={...existing,...location,id:existing?.id??crypto.randomUUID(),savedAt:new Date().toISOString(),score:weather?.score,weather:weather?{score:weather.score,temperature:weather.temperature,wind:weather.wind,gusts:weather.gusts,rainProbability:weather.rainProbability}:existing?.weather,airspace:zoneInfo?{countryCode:zoneInfo.countryCode,countryName:zoneInfo.countryName,sourceName:zoneInfo.sourceName,status:zoneInfo.status,zoneCount:zoneInfo.zones.length,zoneTypes:[...new Set(zoneInfo.zones.map(zone=>zone.type))].slice(0,6),sourceUrl:zoneInfo.sourceUrl}:existing?.airspace};persistSaved([place,...saved.filter(x=>x.id!==existing?.id)].slice(0,50))};
 const remove=(id:string)=>{const next=saved.filter(x=>x.id!==id);setSaved(next);localStorage.setItem('dzm-saved',JSON.stringify(next))};
 const updateSaved=(id:string,changes:Partial<SavedPlace>)=>persistSaved(saved.map(place=>place.id===id?{...place,...changes}:place));
 const saveRoute=(route:SavedRoute)=>{const next=[route,...savedRoutes.filter(item=>item.id!==route.id)].slice(0,30);setSavedRoutes(next);localStorage.setItem('aeris-saved-routes',JSON.stringify(next))};
 const removeRoute=(id:string)=>{const next=savedRoutes.filter(route=>route.id!==id);setSavedRoutes(next);localStorage.setItem('aeris-saved-routes',JSON.stringify(next))};
 const openRoute=(route:SavedRoute)=>{localStorage.setItem('aeris-flight-plan',JSON.stringify(route.points));localStorage.setItem('aeris-flight-radius',String(route.radiusKm));choose(route.points[0])};
 const geo=()=>navigator.geolocation?.getCurrentPosition(p=>choose({lat:p.coords.latitude,lng:p.coords.longitude,name:'My location'}));
 const updateSettings=(next:AppSettings)=>{setAppSettings(next);localStorage.setItem('aeris-settings',JSON.stringify({...next,defaultLanguageVersion:2}))};
 useEffect(()=>{document.documentElement.lang=appSettings.language},[appSettings.language]);
 useEffect(()=>{
  if(!location)return;
  const request=++chooseRequest.current;
  const update=async()=>{
   if(!navigator.onLine||isOfflineTestMode()){const context=await getOfflineContext(location,appSettings.language);if(request===chooseRequest.current&&context)setZoneInfo(context.zoneInfo);return}
   const result=await getOfficialZoneInfo(location,appSettings.language);
   if(request===chooseRequest.current)setZoneInfo(result);
  };
  void update();
 },[appSettings.language]);
 useEffect(()=>{
  if(!location)return;
  const refresh=()=>choose(location,false);
  window.addEventListener('online',refresh);window.addEventListener('offline',refresh);window.addEventListener('aeris-offline-test-changed',refresh);
  return()=>{window.removeEventListener('online',refresh);window.removeEventListener('offline',refresh);window.removeEventListener('aeris-offline-test-changed',refresh)};
 },[location,appSettings.language]);
 useEffect(()=>{window.scrollTo(0,0)},[page]);
 return <div className={`app page-${page} ${appSettings.reducedMotion?'reducedMotion':''}`} style={{'--glass-opacity':appSettings.glassOpacity} as React.CSSProperties}><div className="ambient a"/><div className="ambient b"/><Header setSettings={()=>setSettingsOpen(true)}/><div className="pageTransition" key={page}>{page==='home'&&<Home onChoose={choose} geo={geo} openMap={()=>setPage('map')} openWeather={()=>setPage('weather')} openAi={()=>setPage('ai')} language={appSettings.language}/>} {page==='map'&&<MapPage location={location} weather={weather} weatherError={weatherError} zoneInfo={zoneInfo} choose={choose} save={save} saveRoute={saveRoute} settings={appSettings}/>} {page==='weather'&&<WeatherPage location={location} weather={weather} error={weatherError} choose={choose} language={appSettings.language}/>} {page==='ai'&&<AiPage location={location} weather={weather} zoneInfo={zoneInfo} saved={saved.length}/>} {page==='saved'&&<SavedPage saved={saved} routes={savedRoutes} choose={choose} openRoute={openRoute} remove={remove} removeRoute={removeRoute} update={updateSaved}/>}</div>{settingsOpen&&<Settings settings={appSettings} update={updateSettings} close={()=>setSettingsOpen(false)}/>}<Nav page={page} setPage={setPage} language={appSettings.language}/><IosInstallPrompt/><Preferences close={()=>{}}/></div>
}

function DroneWireframe(){return <div className="droneWireScene" aria-hidden="true"><div className="wireGrid"/><svg viewBox="0 0 820 520"><defs><filter id="wire-glow"><feGaussianBlur stdDeviation="4" result="blur"/><feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge></filter><linearGradient id="wire-fade" x1="0" y1="0" x2="1" y2="1"><stop stopColor="#d8ffc8"/><stop offset=".45" stopColor="#72ff34"/><stop offset="1" stopColor="#1b611d"/></linearGradient></defs><g className="terrainWire">{Array.from({length:11},(_,index)=><path key={`h${index}`} d={`M20 ${250+index*23} Q 210 ${190+index*16} 405 ${245+index*18} T 800 ${230+index*24}`}/>)}{Array.from({length:15},(_,index)=><path key={`v${index}`} d={`M${40+index*52} 220 Q ${80+index*48} 340 ${25+index*55} 510`}/>)}</g><g className="droneWire" filter="url(#wire-glow)"><ellipse cx="410" cy="270" rx="118" ry="50"/><path d="M292 270 150 185 90 198M528 270l142-85 60 13M310 300 162 374 98 360M510 300l148 74 64-14"/><path d="M342 238 381 175h58l39 63M350 309l28 62h64l28-62M373 222h74l32 54-37 56h-64l-37-56Z"/><circle cx="90" cy="198" r="64"/><circle cx="730" cy="198" r="64"/><circle cx="98" cy="360" r="64"/><circle cx="722" cy="360" r="64"/><circle cx="90" cy="198" r="9"/><circle cx="730" cy="198" r="9"/><circle cx="98" cy="360" r="9"/><circle cx="722" cy="360" r="9"/><path d="M377 332v48l-28 40M443 332v48l28 40M349 420h122"/></g></svg><span className="wireLabel one">LIVE SOURCES</span><span className="wireLabel two">36H WEATHER</span><span className="wireLabel three">ROUTE RANGE</span></div>}

function Home({onChoose,geo,openMap,openWeather,openAi,language}:{onChoose:(l:Location)=>void;geo:()=>void;openMap:()=>void;openWeather:()=>void;openAi:()=>void;language:string}){const c=screenCopy(language);return <main className="home homeCinematic">
  <section className="cinematicHero">
    <div className="heroPhoto" aria-hidden="true"/>
    <DroneWireframe/>
    <div className="heroShade" aria-hidden="true"/>
    <div className="coastLabel"><i/><span>{c.coverage}</span><b>{c.sources}</b></div>
    <div className="hero">
      <div className="pill"><Sparkles size={14}/> {c.pill}</div>
      <h1>{c.hero1}<br/><i>{c.hero2}</i></h1><div className="heroTelemetry"><span>LAT / LON</span><b>OFFICIAL CONTEXT</b><i>01</i></div>
      <p>{c.heroBody}</p>
      <SearchBox onLocation={onChoose} hero language={language}/>
      <div className="heroButtons"><button className="primary" onClick={geo}><Navigation size={17}/> {c.useLocation}</button><button className="exploreButton" onClick={openMap}><MapIcon size={17}/> {c.openMap} <ArrowRight size={16}/></button></div>
      <div className="trustRow"><span><ShieldCheck/>{c.officialContext}</span><span><CloudSun/>{c.forecast36}</span><span><Database/>{c.private}</span></div>
    </div>
    <div className="flightReadout liquid"><div><span className="liveDot"/> {c.ready}</div><b>{c.safer}</b><p>{c.flightBody}</p><button onClick={openMap} aria-label={c.openMap}><ArrowRight/></button></div>
    <div className="scrollCue"><span>{c.discover}</span><i/></div>
  </section>
  <section className="homeBelow">
    <div className="sectionIntro"><div className="eyebrow">{c.contextEyebrow}</div><h2>{c.decision1}<br/>{c.decision2}</h2><p>{c.contextBody}</p></div>
    <section className="decisionStory" aria-label="How Aeris supports a flight decision">
      <div className="storyRail"><span>01</span><i/><span>02</span><i/><span>03</span></div>
      <div className="storyCopy">
        <article><small>PLACE</small><h3>Start with a pin, not a pile of tabs.</h3><p>Search a town, paste coordinates, or use your live position. Aeris brings the relevant map, forecast and official-source context to the same point.</p></article>
        <article><small>CONDITIONS</small><h3>Read the next 36 hours like a flight window.</h3><p>Compare wind, gusts, rain, cloud and visibility hour by hour, with a score that helps you spot calmer conditions quickly.</p></article>
        <article><small>VERIFY</small><h3>Keep the official authority one click away.</h3><p>See what source is loaded, understand the visible zones, and hand off to the responsible national aviation map before takeoff.</p></article>
      </div>
      <aside className="storyReadout liquid"><div><span className="liveDot"/> LIVE FLIGHT CONTEXT</div><b>One place.<br/>Three clear answers.</b><dl><dt>AIRSPACE</dt><dd>Official sources</dd><dt>WEATHER</dt><dd>36-hour outlook</dd><dt>PRIVACY</dt><dd>Local by default</dd></dl></aside>
    </section>
    <section className="missionGallery">
      <div className="missionLead">
        <div className="eyebrow">BUILT AROUND THE MOMENT BEFORE TAKEOFF</div>
        <h2>Less dashboard.<br/><i>More awareness.</i></h2>
        <p>Flight planning should feel calm even when the data is complex. Aeris uses progressive detail: a clear first answer, then the evidence when you need it.</p>
        <button className="primary" onClick={openMap}><MapIcon/> Explore the live map <ArrowRight/></button>
      </div>
      <figure className="missionPhoto missionWide"><img src={`${import.meta.env.BASE_URL}media/drone-field-sunset.jpg`} alt="Drone flying above a field at sunset" loading="lazy"/><figcaption><small>01 · AIRSPACE</small><b>Know what surrounds the launch point.</b><span>Live map layers · route radius · official-source handoff</span></figcaption></figure>
      <figure className="missionPhoto missionTall"><img src={`${import.meta.env.BASE_URL}media/drone-coast-sunset.jpg`} alt="Drone flying in warm evening light" loading="lazy"/><figcaption><small>02 · CONDITIONS</small><b>Find the quieter hour.</b><span>Wind · rain · visibility · daylight</span></figcaption></figure>
      <div className="missionQuote liquid"><Sparkles/><p>“The best flight tool is the one that makes the next responsible action obvious.”</p><span>AERIS DESIGN PRINCIPLE</span></div>
    </section>
    <section className="featureGrid">{[[MapIcon,c.airspace,c.airspaceBody,openMap],[CloudSun,c.weatherWindows,c.weatherBody,openWeather],[Bot,c.copilot,c.copilotBody,openAi]].map(([I,title,description,action],index)=>{const Icon=I as typeof MapIcon;return <article style={{'--delay':`${index*90}ms`} as React.CSSProperties} key={String(title)}><small>0{index+1}</small><span><Icon/></span><b>{title as string}</b><p>{description as string}</p><button onClick={action as ()=>void} aria-label={`${c.discover} ${String(title)}`}><ArrowRight/></button></article>})}</section>
    <section className="flightPromise">
      <div><div className="eyebrow">THE AERIS PROMISE</div><h2>Useful context.<br/>Honest limits.</h2></div>
      <div className="promiseGrid"><article><ShieldCheck/><b>Source-aware</b><p>Official aviation links remain visible wherever an answer depends on them.</p></article><article><Eye/><b>Readable by design</b><p>Critical wind, rain and zone information is never buried behind decoration.</p></article><article><Database/><b>Private by default</b><p>Saved places and preferences stay on this device unless you export them.</p></article></div>
    </section>
    <div className="homeNote"><Compass/><div><b>{c.orientation}</b><p>{c.orientationBody}</p></div></div>
    <section className="homeFinalCta">
      <div className="finalCtaPhoto" aria-hidden="true"/>
      <div><span><i className="liveDot"/> READY FOR YOUR NEXT LOCATION</span><h2>Meet the sky<br/>with context.</h2><p>Drop a pin and turn airspace, weather and official sources into one calm pre-flight view.</p><button className="primary" onClick={openMap}>Plan a flight <ArrowRight/></button></div>
    </section>
    <section className="homeAbout" aria-labelledby="about-aeris-title">
      <div><div className="eyebrow">ABOUT AERIS</div><h2 id="about-aeris-title">Built for calmer decisions before takeoff.</h2></div>
      <div className="homeAboutCopy"><p>Aeris is a privacy-first public project by <a href="https://github.com/B1progame" target="_blank" rel="noreferrer">B1progame</a>. I built it because official drone tools can feel slow, fragmented, and difficult to use on the move. Aeris brings official airspace context, weather, route planning, and offline maps into one readable place—without pretending that a planning tool is an aviation authority.</p><p>It is free to use, transparent about source limits, and designed to stay useful when connectivity is unreliable.</p><div className="homeAboutLinks"><a href="https://github.com/B1progame/drone-zone-map" target="_blank" rel="noreferrer">Source on GitHub ↗</a><a href="https://github.com/B1progame/drone-zone-map/blob/main/LICENSE" target="_blank" rel="noreferrer">Usage license ↗</a></div></div>
    </section>
    <div className="photoCredits">Photography: <a href="https://www.pexels.com/photo/drone-flying-near-green-trees-in-forest-3823555/" target="_blank" rel="noreferrer">Pok Rie</a>, <a href="https://www.pexels.com/photo/black-quadcopter-drone-on-green-grass-field-442589/" target="_blank" rel="noreferrer">JESHOOTS.com</a>, and <a href="https://www.pexels.com/photo/drone-in-air-during-sunset-12446360/" target="_blank" rel="noreferrer">Matheus Bertelli</a> via Pexels.</div>
    <Disclaimer/>
  </section>
</main>}

function MapPage({location,weather,weatherError,zoneInfo,choose,save,saveRoute,settings}:{location?:Location;weather?:Weather;weatherError:string;zoneInfo?:ZoneInfo;choose:(l:Location)=>void;save:()=>void;saveRoute:(route:SavedRoute)=>void;settings:AppSettings}){
 const[offline,setOffline]=useState(false),[offlineBuilder,setOfflineBuilder]=useState(false),[resultOpen,setResultOpen]=useState(true),[plannerMode,setPlannerMode]=useState(false),[exportStatus,setExportStatus]=useState(''),[directoryOpen,setDirectoryOpen]=useState(false);
 const[geoJsonProgress,setGeoJsonProgress]=useState<GeoJsonExportProgress>();
 const[planPoints,setPlanPoints]=useState<FlightPoint[]>(()=>{try{return JSON.parse(localStorage.getItem('aeris-flight-plan')||'[]')}catch{return[]}});
 const[radiusKm,setRadiusKm]=useState(()=>{const stored=Number(localStorage.getItem('aeris-flight-radius'));return stored>=.5&&stored<=50?stored:20});
 const mapCanvasRef=useRef<MapCanvasHandle>(null);
 useEffect(()=>{if(location)setResultOpen(true)},[location?.lat,location?.lng]);
 const updatePlan=(points:FlightPoint[])=>{setPlanPoints(points);localStorage.setItem('aeris-flight-plan',JSON.stringify(points))};
 const updateRadius=(radius:number)=>{setRadiusKm(radius);localStorage.setItem('aeris-flight-radius',String(radius))};
 const addPlanPoint=(point:Location)=>updatePlan([...planPoints,{...point,id:crypto.randomUUID()}].slice(-40));
 const saveCurrentRoute=()=>{if(planPoints.length<2)return;const route:SavedRoute={id:crypto.randomUUID(),name:`${planPoints[0].name} → ${planPoints[planPoints.length-1].name}`,savedAt:new Date().toISOString(),points:planPoints,radiusKm,distanceKm:flightDistance(planPoints)};saveRoute(route);setExportStatus('Route saved to your flight library.');window.setTimeout(()=>setExportStatus(''),3200)};
 const runMapExport=async(kind:'geojson'|'snapshot')=>{
  setExportStatus(kind==='geojson'?'Preparing visible vectors…':'Rendering clean snapshot…');
  if(kind==='geojson')setGeoJsonProgress({percent:1,stage:'Starting official viewport export',features:0});
  try{
   if(kind==='geojson')await mapCanvasRef.current?.downloadVisibleGeoJson(location?.name,progress=>setGeoJsonProgress(progress));
   else await mapCanvasRef.current?.downloadCleanSnapshot(location?.name);
   setExportStatus(kind==='geojson'?'Compact GeoJSON downloaded — ready for geojson.io.':'Clean map PNG downloaded.');
   if(kind==='geojson')window.setTimeout(()=>setGeoJsonProgress(undefined),3000);
  }catch(reason){
   setExportStatus(reason instanceof Error?reason.message:'Export failed.');
   setGeoJsonProgress(undefined);
  }
  window.setTimeout(()=>setExportStatus(''),4200);
 };
 const exporting=Boolean(geoJsonProgress&&geoJsonProgress.percent<100);
 return <main className="mapPage">
  <MapCanvas ref={mapCanvasRef} location={location} weather={weather} weatherError={weatherError} onPick={choose} settings={settings} plannerMode={plannerMode} planPoints={planPoints} flightRadiusKm={radiusKm} onPlanPoint={addPlanPoint}/>
  <div className="mapSearch"><SearchBox compact onLocation={choose} language={settings.language}/></div>
  <button className="mapDirectoryTrigger liquid" onClick={()=>setDirectoryOpen(value=>!value)} aria-label="Open airspace sources and downloads" aria-expanded={directoryOpen}><Layers3/><span>Sources</span></button>
  <div className={`mapPanel airspaceDirectory liquid${directoryOpen?' compactOpen':''}`}>
   <button className="compactPanelClose" onClick={()=>setDirectoryOpen(false)} aria-label="Close airspace directory"><X/></button>
   <div className="eyebrow">VERIFIED AIRSPACE DIRECTORY</div>
   <div className="directoryStats"><span><b>15</b> live maps</span><span><b>21</b> handoffs</span><i><span className="liveDot"/> ACTIVE</i></div>
   <p>Official layers load only inside their national coverage. Spain includes the Canary Islands; Portugal includes Madeira and the Azores. The UK layer is permanent AIRAC data, not temporary NOTAMs.</p>
   <div className="directoryLinks"><a href="https://www.avinor.no/en/practical-info/drone/dronekart/" target="_blank" rel="noreferrer">Norway official map ↗</a><a href="https://map.dronespace.at/" target="_blank" rel="noreferrer">Austria Dronespace ↗</a></div>
   <div className="directoryActions">
    <button onClick={()=>setOfflineBuilder(true)} disabled={!location}>{offline?<><Check/>Offline package saved</>:<><Download/>Download offline area</>}</button>
    <button onClick={()=>void runMapExport('geojson')} disabled={exporting}><Download/>{exporting?'Exporting…':'Download visible GeoJSON'}</button>
    <button onClick={()=>void runMapExport('snapshot')}><Camera/>Clean map PNG</button>
   </div>
   {exportStatus&&<small className="exportStatus">{exportStatus}</small>}
   <small className="directoryNotice">Germany exports exact flight-critical official geometry only, keeping files practical; high-volume conservation and visual-detail layers remain on the map. Canada uses Open Government data and excludes protected NAV CANADA-derived shapes.</small>
  </div>
  {geoJsonProgress&&<div className="exportDownloadProgress liquid" role="status" aria-live="polite">
   <div className="exportProgressRing" style={{'--export-progress':`${geoJsonProgress.percent*3.6}deg`} as React.CSSProperties}><span>{geoJsonProgress.percent}%</span></div>
   <div className="exportProgressCopy"><small>VISIBLE GEOJSON</small><b>{geoJsonProgress.stage}</b><span>{geoJsonProgress.features.toLocaleString()} features</span><i><b style={{width:`${Math.max(3,geoJsonProgress.percent)}%`}}/></i></div>
  </div>}
  <FlightPlanner active={plannerMode} points={planPoints} selected={location} radiusKm={radiusKm} language={settings.language} onToggle={()=>setPlannerMode(value=>!value)} onUndo={()=>updatePlan(planPoints.slice(0,-1))} onClear={()=>updatePlan([])} onCheck={choose} onAddSelected={addPlanPoint} onRemove={index=>updatePlan(planPoints.filter((_,pointIndex)=>pointIndex!==index))} onReverse={()=>updatePlan([...planPoints].reverse())} onSave={saveCurrentRoute} onRadiusChange={updateRadius}/>
  {offlineBuilder&&location&&<OfflineDownloadPanel location={location} weather={weather} zoneInfo={zoneInfo} onClose={()=>setOfflineBuilder(false)} onSaved={()=>{setOffline(true);setExportStatus('Offline area saved. It will be selected automatically without a connection.')}}/>}
  {!plannerMode&&(location&&resultOpen?<ResultCard location={location} weather={weather} zoneInfo={zoneInfo} onSave={save} onClose={()=>setResultOpen(false)} language={settings.language}/>:location?<button className="reopenResult liquid" onClick={()=>setResultOpen(true)}>Show location check</button>:<div className="emptyCheck liquid"><Compass/><b>Tap map to choose</b><span>Weather and official source details will meet you there.</span></div>)}
 </main>
}

const WeatherIcon=({hour}:{hour:WeatherHour})=>hour.rainProbability>55?<CloudRain/>:hour.cloud>75?<Cloud/>:<CloudSun/>;
function WeatherPage({location,weather,error,choose,language}:{location?:Location;weather?:Weather;error:string;choose:(l:Location)=>void;language:string}){
 const [selected,setSelected]=useState(0),c=screenCopy(language);
 const hour=weather?.hourly[selected];
 const best=useMemo(()=>weather?.hourly.slice(0,24).map((x,i)=>({...x,index:i})).sort((a,b)=>b.score-a.score).slice(0,3)??[],[weather]);
 const selectedLabel=hour?new Date(hour.time).toLocaleString(language,{weekday:'long',hour:'2-digit',minute:'2-digit'}):'';
 return <main className="page weatherPage">
  <div className="weatherTopline"><span><i className="liveDot"/> LIVE 36H MODEL</span><span>UPDATED FOR THE SELECTED POINT</span><span>{weather?.timezone??'LOCAL TIME'}</span></div>
  <div className="weatherHero"><div><div className="eyebrow">{c.weatherEyebrow}</div><h1>{c.calm}</h1><p>{c.tapHour}</p></div><div className="weatherOrb"><CloudSun/><span>{hour?.temperature??weather?.temperature??'—'}°</span><small>{hour?.isDay?'DAYLIGHT':'AFTER DARK'}</small></div></div>
  {location?<>
   <div className="weatherLocationRow"><div className="locationChip"><Navigation size={15}/>{location.name}<small>{weather?.timezone}</small></div>{hour&&<div className="selectedForecast"><span>SELECTED WINDOW</span><b>{selectedLabel}</b></div>}</div>
   {weather&&hour?<>
    <section className="weatherDashboard liquid">
     <div className="weatherVerdict"><div className="scoreRing" style={{'--score':hour.score} as React.CSSProperties}><div><strong>{hour.score}</strong><span>{c.flightScore}</span></div></div><div className="weatherSummary"><small>{selectedLabel}</small><h2>{quality(hour.score)}</h2><p>{hour.wind<20?c.manageable:c.windCare} {hour.rainProbability<25?c.lowRain:c.rainElevated}</p><div className="conditionTags"><span className={hour.wind<20?'good':'care'}><Wind/> {hour.wind<20?'Wind manageable':'Watch the wind'}</span><span className={hour.rainProbability<25?'good':'care'}><CloudRain/> {hour.rainProbability<25?'Low rain risk':'Rain risk elevated'}</span></div></div></div>
     <div className="metrics"><Metric icon={<Wind/>} label={c.wind} value={`${hour.wind} km/h`} hint={`Gusts ${hour.gusts} km/h`} level={Math.min(100,hour.wind/45*100)}/><Metric icon={<CloudRain/>} label={c.rain} value={`${hour.rainProbability}%`} hint={`${hour.rain} mm`} level={hour.rainProbability}/><Metric icon={<Cloud/>} label={c.cloud} value={`${hour.cloud}%`} hint={hour.isDay?c.daylight:c.afterDark} level={hour.cloud}/><Metric icon={<Eye/>} label={c.visibility} value={`${Math.round(hour.visibility/1000)} km`} hint={`${hour.temperature}°C`} level={Math.min(100,hour.visibility/30000*100)}/></div>
    </section>
    <div className="bestWindows"><div><div className="eyebrow">{c.best}</div><b>{c.topToday}</b><span>Ranked by wind, rain and visibility</span></div>{best.map((item,rank)=><button className={item.index===selected?'active':''} key={item.time} onClick={()=>setSelected(item.index)}><small>0{rank+1}</small><span>{new Date(item.time).toLocaleTimeString(language,{hour:'2-digit',minute:'2-digit'})}</span><b>{item.score}</b></button>)}</div>
    <section className="forecastTimeline"><div className="timelineHeading"><div><div className="eyebrow">24-HOUR FLIGHT STRIP</div><b>Move through the day</b></div><span><i/> SCORE <i/> WIND</span></div><div className="timeline rich">{weather.hourly.slice(0,24).map((item,index)=><button className={index===selected?'selected':''} onClick={()=>setSelected(index)} key={item.time}><small>{index===0?c.now:new Date(item.time).toLocaleTimeString(language,{hour:'2-digit'})}</small><WeatherIcon hour={item}/><b>{item.score}</b><span>{item.wind} km/h</span><i style={{height:`${Math.max(8,item.score)}%`}}/></button>)}</div></section>
    <Disclaimer/>
   </>:error?<div className="weatherUnavailable liquid"><CloudRain/><div><b>Forecast temporarily unavailable</b><p>{error} Try this location again in a moment.</p></div></div>:<div className="loadingCard">{c.reading}</div>}
  </>:<section className="emptyPage weatherEmpty liquid"><div className="emptyWeatherVisual"><CloudSun/><i/></div><div><div className="eyebrow">START WITH A LOCATION</div><h2>{c.chooseFlight}</h2><p>{c.chooseFlightBody}</p><SearchBox onLocation={choose} language={language}/></div></section>}
 </main>
}
function Metric({icon,label,value,hint,level}:{icon:React.ReactNode;label:string;value:string;hint:string;level:number}){return <div className="metric">{icon}<span>{label}</span><b>{value}</b><small>{hint}</small><i><span style={{width:`${Math.max(4,level)}%`}}/></i></div>}

function AiPage({location,weather,zoneInfo,saved}:{location?:Location;weather?:Weather;zoneInfo?:ZoneInfo;saved:number}){
 type Message={question:string;answer?:string;error?:string;provider?:string;sourceUrl?:string;sourceName?:string};
 const [question,setQuestion]=useState(''),[messages,setMessages]=useState<Message[]>([]);
 const [apiKey,setApiKey]=useState(()=>sessionStorage.getItem('aeris-openrouter-key')??''),[keyStatus,setKeyStatus]=useState<'idle'|'testing'|'connected'|'error'>('idle'),[keyMessage,setKeyMessage]=useState(''),[busy,setBusy]=useState(false);
 const quickQuestions=['Can I fly here?','Explain the visible zones','What is the weather risk?','Best time in 24 hours?'];
 const testKey=async()=>{setKeyStatus('testing');setKeyMessage('Checking this key…');try{await validateOpenRouterKey(apiKey);sessionStorage.setItem('aeris-openrouter-key',apiKey.trim());setKeyStatus('connected');setKeyMessage('Connected to the free Hunyuan model.')}catch(error){setKeyStatus('error');setKeyMessage(error instanceof Error?error.message:'The key could not be validated.')}};
 const disconnect=()=>{sessionStorage.removeItem('aeris-openrouter-key');setApiKey('');setKeyStatus('idle');setKeyMessage('')};
 const ask=async(text=question)=>{const clean=text.trim();if(!clean||busy)return;setQuestion('');setBusy(true);const index=messages.length,sourceUrl=zoneInfo?.sourceUrl,sourceName=zoneInfo?.sourceName;setMessages(value=>[...value,{question:clean,sourceUrl,sourceName}]);try{if(apiKey.trim()){const response=await askOpenRouter({question:clean,location,weather,zoneInfo},apiKey);setMessages(value=>value.map((message,i)=>i===index?{...message,answer:response.answer,provider:response.model}:message))}else{setMessages(value=>value.map((message,i)=>i===index?{...message,answer:answerFlightQuestion({question:clean,location,weather,zoneInfo}),provider:'On-device flight rules'}:message))}}catch(error){setMessages(value=>value.map((message,i)=>i===index?{...message,error:error instanceof Error?error.message:'The AI request failed.'}:message))}finally{setBusy(false)}};
 return <main className="page aiPage">
  <div className="aiHeader"><div><div className="eyebrow">AERIS COPILOT · GROUNDED FLIGHT CONTEXT</div><h1>Ask the flight,<br/><i>not the dashboard.</i></h1><p>Turn the location, forecast and official-zone context already in Aeris into a clear next step. The assistant explains evidence; it never invents permission.</p></div><div className="aiPulse"><Bot/><i/><span>CONTEXT<br/>ONLINE</span></div></div>
  <section className="aiTrustLedger"><article><Database/><span><small>WHAT IT CAN SEE</small><b>Loaded flight context</b></span></article><article><Sparkles/><span><small>HOW IT ANSWERS</small><b>On-device or OpenRouter</b></span></article><article><ShieldCheck/><span><small>WHAT STAYS OFF-LIMITS</small><b>Legal clearance claims</b></span></article></section>
  <section className="copilotGrid">
   <div className="chatPanel liquid">
    <div className="chatTop"><div className="aiAvatar"><Sparkles/></div><div><b>Aeris Copilot</b><span><i/> {apiKey.trim()?'OpenRouter enabled':'Ready on this device'}</span></div><small>{location?'CONTEXT LOADED':'WAITING FOR MAP POINT'}</small></div>
    <div className="chatBody">{messages.length===0?<div className="assistantWelcome"><div className="assistantMessage"><b>{location?`I’m ready for ${location.name}.`:'Ready when you are.'}</b><p>{location?`I can compare ${weather?'the live forecast, ':''}${zoneInfo?'visible zone context and the official source':'the data loaded for this point'}. Ask for a plain-language flight read.`:'Select a location on the map, then come back for a grounded explanation.'}</p></div><div className="starterPrompts"><small>START WITH A FLIGHT QUESTION</small>{quickQuestions.map(text=><button key={text} onClick={()=>ask(text)}>{text}<ArrowRight/></button>)}</div></div>:messages.map((message,index)=><div key={index} className="conversation"><div className="userMessage">{message.question}</div><div className={`assistantMessage${message.error?' error':''}`}><b>{message.error?'Could not answer':'Aeris Copilot'}</b><MarkdownAnswer text={message.error??message.answer??'Thinking…'}/>{message.sourceUrl&&<a className="answerSource" href={message.sourceUrl} target="_blank" rel="noreferrer noopener"><ShieldCheck/> Open {message.sourceName??'official aviation source'} <ArrowRight/></a>}{message.provider&&<small>{message.provider}</small>}</div></div>)}</div>
    <div className="chatInput"><input value={question} disabled={busy} onChange={event=>setQuestion(event.target.value)} onKeyDown={event=>event.key==='Enter'&&ask()} placeholder={busy?'Aeris is checking the context…':'Ask about this flight context…'}/><span>ENTER TO SEND</span><button disabled={busy} onClick={()=>ask()} aria-label="Send"><Send/></button></div>
   </div>
   <aside className="contextRail">
    <div className="contextCard liquid"><small>ACTIVE CONTEXT</small><b>{location?.name??'No location selected'}</b><span><Navigation/> {location?`${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`:'Choose a point on the map'}</span><span><CloudSun/> {weather?`${weather.score}/100 weather · ${weather.wind} km/h wind`:'Weather waiting'}</span><span><Layers3/> {zoneInfo?`${zoneInfo.zones.length} zones · ${zoneInfo.sourceName}`:'Official source waiting'}</span><span><Heart/> {saved} saved {saved===1?'place':'places'}</span></div>
    <div className="localAssistantCard liquid"><small>ON-DEVICE · NO KEY</small><b>Private fallback, always ready</b><p>Uses the weather and airspace data already loaded in this tab. No provider setup or account is required.</p></div>
    <div className={`openRouterCard liquid ${keyStatus}`}><small>OPENROUTER · OPTIONAL</small><b>Bring a free AI model</b><p>The key stays only in this browser tab and is sent solely to OpenRouter when you ask a question.</p><div className="keyRow"><input type="password" autoComplete="off" value={apiKey} onChange={event=>{setApiKey(event.target.value);setKeyStatus('idle');setKeyMessage('')}} placeholder="sk-or-v1-…"/><button onClick={testKey} disabled={keyStatus==='testing'}>{keyStatus==='testing'?'Testing…':'Test key'}</button></div>{keyMessage&&<span className="keyStatus">{keyMessage}</span>}<small className="modelName">{OPENROUTER_MODEL}</small>{apiKey&&<button className="disconnectKey" onClick={disconnect}>Remove from this tab</button>}</div>
    <div className="aiSafety"><ShieldCheck/><p>No legal permission claims. Always verify the responsible official aviation source.</p></div>
   </aside>
  </section>
 </main>
}

function SavedPage({saved,routes,choose,openRoute,remove,removeRoute,update}:{saved:SavedPlace[];routes:SavedRoute[];choose:(l:Location)=>void;openRoute:(route:SavedRoute)=>void;remove:(id:string)=>void;removeRoute:(id:string)=>void;update:(id:string,changes:Partial<SavedPlace>)=>void}){
 const [tab,setTab]=useState<'places'|'routes'|'sources'|'storage'>('places'),[editing,setEditing]=useState(''),[offline,setOffline]=useState<OfflinePack[]>([]),[offlineAction,setOfflineAction]=useState(''),[offlineProgress,setOfflineProgress]=useState<OfflineDownloadProgress>();
 const loadOffline=()=>void getOfflinePacks().then(setOffline).catch(()=>setOffline([]));
 useEffect(()=>{loadOffline();window.addEventListener('aeris-offline-packages-changed',loadOffline);return()=>window.removeEventListener('aeris-offline-packages-changed',loadOffline)},[]);
 const updatePack=async(pack:OfflinePack)=>{setOfflineAction(pack.id);setOfflineProgress(undefined);try{await refreshOfflinePack(pack.id,setOfflineProgress);loadOffline()}finally{setOfflineAction('');setOfflineProgress(undefined)}};
 const testPack=async(pack:OfflinePack)=>{setOfflineAction(pack.id);try{const result=await verifyOfflinePack(pack);if(!result.ok)throw new Error('This package is incomplete. Update it before testing.');setOfflineTestMode(true);choose(pack.location)}finally{setOfflineAction('')}};
 const removePack=async(id:string)=>{await deleteOfflinePack(id);loadOffline()};
 return <main className="page savedPage"><div className="savedHeader"><div><div className="eyebrow">PRIVATE FLIGHT LIBRARY · ON THIS DEVICE</div><h1>Your places.<br/><i>Your flight memory.</i></h1><p>Keep weather snapshots, official-source context, notes and planned routes together.</p></div><div className="savedHeroMark"><Heart/><span>{saved.length+routes.length}</span></div></div><div className="librarySummary"><span><b>{saved.length}</b> saved places</span><span><b>{routes.length}</b> flight routes</span><span><b>{offline.length}</b> offline checks</span></div><div className="segmented libraryTabs"><button className={tab==='places'?'active':''} onClick={()=>setTab('places')}><Heart/> Places <span>{saved.length}</span></button><button className={tab==='routes'?'active':''} onClick={()=>setTab('routes')}><Route/> Routes <span>{routes.length}</span></button><button className={tab==='sources'?'active':''} onClick={()=>setTab('sources')}><Layers3/> Sources</button><button className={tab==='storage'?'active':''} onClick={()=>setTab('storage')}><Database/> Offline <span>{offline.length}</span></button></div>
 {tab==='places'&&(saved.length?<section className="savedGrid enhanced">{saved.map((place,index)=><article className={`savedCard liquid${place.favorite?' favorite':''}`} key={place.id}><div className={`savedMapThumb thumb${index%3}`}><div className="thumbGrid"/><Navigation/><span>{place.lat.toFixed(4)}, {place.lng.toFixed(4)}</span><button className="favoriteButton" onClick={()=>update(place.id,{favorite:!place.favorite})} aria-label={place.favorite?'Remove favorite':'Mark favorite'}><Star fill={place.favorite?'currentColor':'none'}/></button></div><div className="savedContent"><small>SAVED {new Date(place.savedAt).toLocaleDateString()} {place.airspace?.countryCode&&`· ${place.airspace.countryCode}`}</small><h3>{place.name}</h3><div className="savedSnapshot"><div><CloudSun/><span><b>{place.weather?.score??place.score??'—'}</b> weather</span></div><div><Wind/><span><b>{place.weather?.wind??'—'}</b> km/h</span></div><div><Layers3/><span><b>{place.airspace?.zoneCount??'—'}</b> zones</span></div></div>{place.airspace&&<div className="savedSource"><ShieldCheck/><span><b>{place.airspace.sourceName}</b>{place.airspace.status==='loaded'?'Official overlap snapshot':'Official source context'}</span></div>}{editing===place.id?<div className="noteEditor"><textarea autoFocus defaultValue={place.note??''} placeholder="Add launch notes, access details or reminders…" onBlur={event=>update(place.id,{note:event.target.value.trim()})}/><button onClick={()=>setEditing('')}><Check/> Done</button></div>:place.note?<button className="savedNote" onClick={()=>setEditing(place.id)}><Pencil/>{place.note}</button>:<button className="addNote" onClick={()=>setEditing(place.id)}><Pencil/> Add a private note</button>}<div className="savedActions"><button onClick={()=>choose(place)}>Open map <ArrowRight/></button><button onClick={()=>setEditing(place.id)} aria-label={`Edit ${place.name}`}><Pencil/></button><button className="delete" onClick={()=>remove(place.id)} aria-label={`Remove ${place.name}`}><Trash2/></button></div></div></article>)}</section>:<section className="emptyPage libraryEmpty liquid"><div className="emptyOrbit"><Heart/><i/></div><h2>Your first flight spot starts on the map.</h2><p>Tap a location, inspect the official source and weather, then save the full snapshot here.</p><button onClick={()=>choose({lat:52.52,lng:13.405,name:'Berlin, Germany'})}>Explore Berlin <ArrowRight/></button></section>)}
 {tab==='routes'&&(routes.length?<section className="routeLibrary">{routes.map((route,index)=><article className="routeCard liquid" key={route.id}><div className="routeVisual"><div className="routeTrace"><i/><i/><i/></div><span>ROUTE {String(index+1).padStart(2,'0')}</span><Route/></div><div className="routeContent"><small>{new Date(route.savedAt).toLocaleDateString()} · {route.points.length} WAYPOINTS</small><h3>{route.name}</h3><div className="routeStats"><span><Route/><b>{route.distanceKm.toFixed(route.distanceKm<10?2:1)} km</b> path</span><span><CircleDot/><b>{route.radiusKm} km</b> radius</span></div><ol>{route.points.slice(0,4).map((point,pointIndex)=><li key={point.id}><i>{pointIndex+1}</i><span>{point.name}</span></li>)}</ol>{route.points.length>4&&<small>+ {route.points.length-4} more waypoints</small>}<div className="savedActions"><button onClick={()=>openRoute(route)}>Load on map <ArrowRight/></button><button className="delete" onClick={()=>removeRoute(route.id)} aria-label={`Remove ${route.name}`}><Trash2/></button></div></div></article>)}</section>:<section className="emptyPage libraryEmpty liquid"><Route/><h2>No routes saved yet.</h2><p>Open the map, plan two or more waypoints, choose a radius, and save the route.</p></section>)}
 {tab==='sources'&&<SourcePanel/>}
 {tab==='storage'&&<section className="offlineLibrary">{offline.length?offline.map(pack=><article className="offlineCard liquid" key={pack.id}><WifiOff/><div><small>OFFLINE PACKAGE · {pack.metadata.country.toUpperCase()} · {new Date(pack.metadata.updatedAt).toLocaleDateString()}</small><h3>{pack.name}</h3><p>{formatBytes(pack.metadata.sizeBytes)} · {pack.metadata.itemCount.toLocaleString()} items · {pack.config.basemapType??pack.metadata.basemapType??'street'} map · zoom {pack.config.basemapMaxZoom??pack.metadata.basemapMaxZoom??'—'}{pack.metadata.layers.length?` + ${pack.metadata.layers.map(layer=>layer==='basic'?'infrastructure':layer).join(', ')}`:''}</p><span>{pack.config.scope}{pack.metadata.radiusKm?` · ${pack.metadata.radiusKm} km radius`:''} · v{pack.metadata.version}{isOfflinePackStale(pack)?' · Update available':' · Verified'}</span>{offlineAction===pack.id&&offlineProgress&&<div className="offlineInlineProgress"><i><b style={{width:`${offlineProgress.percent}%`}}/></i><small>{offlineProgress.stage} · {offlineProgress.items.toLocaleString()} items</small></div>}<em>{pack.notice}</em></div><div className="offlineActions"><button onClick={()=>choose(pack.location)}>Open <ArrowRight/></button><button onClick={()=>void testPack(pack)} disabled={offlineAction===pack.id}><WifiOff/> Test offline</button><button onClick={()=>void updatePack(pack)} disabled={offlineAction===pack.id}><RefreshCw/> {offlineAction===pack.id?'Working…':'Update'}</button><button onClick={()=>downloadGeoJson(pack)}><Download/> GeoJSON</button><button className="delete" onClick={()=>void removePack(pack.id)}><Trash2/> Delete</button></div></article>):<div className="storagePanel liquid"><WifiOff/><div><h2>No offline packages yet</h2><p>Choose a point on the map and use “Download offline area”. All 18 Aeris countries support country, city and custom-radius packages with selectable street or satellite maps; Germany also supports federal states. Official layers are included wherever redistribution is allowed.</p></div></div>}{offline.length>0&&<button className="danger" onClick={()=>void deleteAllOfflinePacks().then(loadOffline)}>Delete all offline packages</button>}</section>}
 <Disclaimer/></main>
}

function Settings({settings,update,close}:{settings:AppSettings;update:(settings:AppSettings)=>void;close:()=>void}){const selected=SUPPORTED_LANGUAGES.find(([code])=>code===settings.language),[languageQuery,setLanguageQuery]=useState(selected?.[1]??settings.language),c=screenCopy(settings.language);return <div className="modalShade"><section className="settings liquid"><button className="close" onClick={close}>×</button><div className="eyebrow">{c.preferences}</div><h2>{c.preferencesTitle}</h2><label>{c.language}<input className="languageSearch" list="aeris-language-list" value={languageQuery} onChange={event=>{const typed=event.target.value;setLanguageQuery(typed);const value=typed.toLowerCase();const match=SUPPORTED_LANGUAGES.find(([code,name])=>code===value||name.toLowerCase()===value);if(match)update({...settings,language:match[0]})}} onBlur={()=>setLanguageQuery(SUPPORTED_LANGUAGES.find(([code])=>code===settings.language)?.[1]??settings.language)} placeholder={c.searchLanguages}/><datalist id="aeris-language-list">{SUPPORTED_LANGUAGES.map(([code,name])=><option value={name} key={code}>{code.toUpperCase()}</option>)}</datalist><small>{c.languageHelp}</small></label><label>{c.overlayDetail}<select value={settings.renderDetail} onChange={event=>update({...settings,renderDetail:event.target.value as AppSettings['renderDetail']})}><option value="efficient">Efficient · nearby essentials</option><option value="balanced">Balanced · recommended</option><option value="maximum">Maximum · farther and denser</option></select><small>{c.detailHelp}</small></label><label className="toggleSetting"><span>3D terrain<small>Show mountains and elevation with a tilted map. Uses extra data and battery.</small></span><input type="checkbox" checked={settings.terrain3d} onChange={event=>update({...settings,terrain3d:event.target.checked})}/></label><label className="glassSlider"><span>{c.glass} <b>{Math.round(settings.glassOpacity*100)}%</b></span><input type="range" min=".38" max=".92" step=".01" value={settings.glassOpacity} onChange={event=>update({...settings,glassOpacity:Number(event.target.value)})}/><i style={{width:`${settings.glassOpacity*100}%`}}/></label><label className="toggleSetting"><span>{c.reduce}<small>{c.reduceHelp}</small></span><input type="checkbox" checked={settings.reducedMotion} onChange={event=>update({...settings,reducedMotion:event.target.checked})}/></label><button className="primary" onClick={close}><Check/> {c.savePreferences}</button></section></div>}
