import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import './map.css';
import './redesign.css';
import './flight-tools.css';
import './hud.css';
import './public.css';
import './aeris-glass.css';
import './frontend-liquid-glass.css';
import './visual-redesign.css';
import './mobile-experience.css';
import App from './App';
createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
const staleChunkRetryKey='aeris:stale-chunk-retry';
window.addEventListener('vite:preloadError',event=>{
  try{if(sessionStorage.getItem(staleChunkRetryKey)==='1')return}catch{}
  event.preventDefault();
  try{sessionStorage.setItem(staleChunkRetryKey,'1')}catch{}
  const refreshUrl=new URL(window.location.href);
  refreshUrl.searchParams.set('_aeris_refresh',String(Date.now()));
  window.location.replace(refreshUrl.toString());
});
if('serviceWorker'in navigator&&import.meta.env.PROD)window.addEventListener('load',()=>navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`,{updateViaCache:'none'}).catch(()=>{}));
