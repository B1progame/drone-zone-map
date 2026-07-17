import { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, UserRound } from 'lucide-react';
import { Logo } from './components';
import type { LocalAccount } from './auth';
import { signInLocal } from './auth';

const loginCopy:Record<string,{eyebrow:string;title:string;body:string;label:string;placeholder:string;button:string;admin:string;local:string}>={
  en:{eyebrow:'DEVICE-LOCAL ACCESS',title:'Your flight desk, ready when you are.',body:'Use any email, nickname, or callsign. No verification email or password is required for this private prototype.',label:'Email, nickname, or callsign',placeholder:'pilot@example.com',button:'Enter Aeris',admin:'The first account on this device becomes its administrator.',local:'Accounts and sessions remain in this browser.'},
  de:{eyebrow:'LOKALER ZUGANG',title:'Dein Flugplatz ist bereit.',body:'Nutze eine beliebige E-Mail, einen Namen oder ein Rufzeichen. Für diesen privaten Prototyp ist keine Bestätigung nötig.',label:'E-Mail, Name oder Rufzeichen',placeholder:'pilot@beispiel.de',button:'Aeris öffnen',admin:'Das erste Konto auf diesem Gerät wird Administrator.',local:'Konten und Sitzungen bleiben in diesem Browser.'},
  es:{eyebrow:'ACCESO LOCAL',title:'Tu mesa de vuelo está lista.',body:'Usa cualquier correo, apodo o indicativo. Este prototipo privado no requiere verificación ni contraseña.',label:'Correo, apodo o indicativo',placeholder:'piloto@ejemplo.es',button:'Entrar en Aeris',admin:'La primera cuenta de este dispositivo será administradora.',local:'Las cuentas y sesiones permanecen en este navegador.'},
  fr:{eyebrow:'ACCÈS LOCAL',title:'Votre poste de vol est prêt.',body:'Utilisez une adresse, un nom ou un indicatif. Ce prototype privé ne demande ni validation ni mot de passe.',label:'Adresse, nom ou indicatif',placeholder:'pilote@exemple.fr',button:'Ouvrir Aeris',admin:'Le premier compte de cet appareil devient administrateur.',local:'Les comptes et sessions restent dans ce navigateur.'},
  it:{eyebrow:'ACCESSO LOCALE',title:'La tua postazione di vol è pronta.',body:'Usa qualsiasi email, nome o nominativo. Questo prototipo privato non richiede verifica o password.',label:'Email, nome o nominativo',placeholder:'pilota@esempio.it',button:'Entra in Aeris',admin:'Il primo account su questo dispositivo diventa amministratore.',local:'Account e sessioni restano in questo browser.'}
};

export function AuthGate({language,onLogin}:{language:string;onLogin:(account:LocalAccount)=>void}){
  const [identifier,setIdentifier]=useState(''),[error,setError]=useState('');
  const copy=loginCopy[language]??loginCopy.en;
  const submit=()=>{try{onLogin(signInLocal(identifier))}catch(reason){setError(reason instanceof Error?reason.message:'Could not create the local account.')}};
  return <main className="loginPage">
    <div className="loginPhoto" aria-hidden="true"/>
    <header><Logo/></header>
    <section className="loginCard liquid">
      <div className="loginIcon"><UserRound/></div>
      <div className="eyebrow">{copy.eyebrow}</div>
      <h1>{copy.title}</h1>
      <p>{copy.body}</p>
      <label>{copy.label}<input autoFocus value={identifier} onChange={event=>setIdentifier(event.target.value)} onKeyDown={event=>event.key==='Enter'&&submit()} placeholder={copy.placeholder} aria-label={copy.label}/></label>
      {error&&<div className="loginError">{error}</div>}
      <button className="primary" onClick={submit}>{copy.button}<ArrowRight/></button>
      <div className="loginFacts"><span><ShieldCheck/>{copy.admin}</span><span><LockKeyhole/>{copy.local}</span></div>
    </section>
  </main>
}
