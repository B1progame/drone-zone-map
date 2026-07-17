export const SUPPORTED_LANGUAGES = [
  ['en','English'],['de','Deutsch'],['es','Español'],['fr','Français'],['it','Italiano'],
  ['nl','Nederlands'],['da','Dansk'],['no','Norsk'],['sv','Svenska'],
  ['fi','Suomi'],['pt','Português'],['pl','Polski'],['cs','Čeština'],
  ['sk','Slovenčina'],['hu','Magyar'],['ro','Română'],['bg','Български'],
  ['el','Ελληνικά'],['hr','Hrvatski'],['sl','Slovenščina'],['et','Eesti'],
  ['lv','Latviešu'],['lt','Lietuvių'],['ga','Gaeilge'],['rm','Rumantsch']
] as const;

export const normalizeLanguage = (value?:string) => {
  const code=(value||navigator.language||'en').toLowerCase().split('-')[0];
  return SUPPORTED_LANGUAGES.some(([item])=>item===code)?code:'en';
};

const copy:Record<string,Partial<Record<'home'|'map'|'weather'|'ai'|'saved'|'result'|'official'|'close'|'search'|'checking'|'check'|'finding'|'locate'|'noPlace'|'searchError',string>>>={
  en:{home:'Home',map:'Map',weather:'Weather',ai:'AI Check',saved:'Saved',result:'LOCATION AIRSPACE CHECK',official:'Open official map',close:'Close location result',search:'Search a place or paste coordinates',checking:'Checking official service…',check:'Check location',finding:'Finding…',locate:'Use my current location',noPlace:'No matching place found. Try a town or coordinates.',searchError:'Place search is temporarily unavailable.'},
  de:{home:'Start',map:'Karte',weather:'Wetter',ai:'KI-Check',saved:'Gespeichert',result:'LUFTRAUMPRÜFUNG AM STANDORT',official:'Offizielle Karte öffnen',close:'Standortergebnis schließen',search:'Ort suchen oder Koordinaten einfügen',checking:'Offizieller Dienst wird geprüft…',check:'Ort prüfen',finding:'Suche…',locate:'Meinen Standort verwenden',noPlace:'Kein passender Ort gefunden. Versuche einen Ort oder Koordinaten.',searchError:'Die Ortssuche ist vorübergehend nicht verfügbar.'},
  es:{home:'Inicio',map:'Mapa',weather:'Tiempo',ai:'Comprobar IA',saved:'Guardado',result:'COMPROBACIÓN DEL ESPACIO AÉREO',official:'Abrir mapa oficial',close:'Cerrar resultado',search:'Buscar lugar o pegar coordenadas',checking:'Consultando el servicio oficial…',check:'Comprobar lugar',finding:'Buscando…',locate:'Usar mi ubicación actual',noPlace:'No se encontró el lugar. Prueba una ciudad o coordenadas.',searchError:'La búsqueda no está disponible temporalmente.'},
  fr:{home:'Accueil',map:'Carte',weather:'Météo',ai:'Contrôle IA',saved:'Enregistré',result:'VÉRIFICATION DE L’ESPACE AÉRIEN',official:'Ouvrir la carte officielle',close:'Fermer le résultat',search:'Rechercher un lieu ou coller des coordonnées',checking:'Consultation du service officiel…',check:'Vérifier le lieu',finding:'Recherche…',locate:'Utiliser ma position',noPlace:'Aucun lieu trouvé. Essayez une ville ou des coordonnées.',searchError:'La recherche de lieu est temporairement indisponible.'},
  it:{home:'Home',map:'Mappa',weather:'Meteo',ai:'Controllo IA',saved:'Salvati',result:'CONTROLLO DELLO SPAZIO AEREO',official:'Apri la mappa ufficiale',close:'Chiudi risultato',search:'Cerca un luogo o incolla le coordinate',checking:'Verifica del servizio ufficiale…',check:'Controlla posizione',finding:'Ricerca…',locate:'Usa la mia posizione',noPlace:'Nessun luogo trovato. Prova una città o coordinate.',searchError:'La ricerca del luogo non è temporaneamente disponibile.'},
  nl:{home:'Start',map:'Kaart',weather:'Weer',ai:'AI-check',saved:'Bewaard',result:'LUCHTRUIMCONTROLE OP LOCATIE',official:'Officiële kaart openen',close:'Resultaat sluiten',search:'Zoek een plaats of plak coördinaten'},
  da:{home:'Hjem',map:'Kort',weather:'Vejr',ai:'AI-tjek',saved:'Gemt',result:'LUFTRUMSKONTROL PÅ STEDET',official:'Åbn officielt kort',close:'Luk resultat',search:'Søg efter et sted eller indsæt koordinater'},
  no:{home:'Hjem',map:'Kart',weather:'Vær',ai:'AI-sjekk',saved:'Lagret',result:'LUFTROMSKONTROLL PÅ STEDET',official:'Åpne offisielt kart',close:'Lukk resultat',search:'Søk etter et sted eller lim inn koordinater'},
  sv:{home:'Hem',map:'Karta',weather:'Väder',ai:'AI-kontroll',saved:'Sparat',result:'LUFTRUMSKONTROLL PÅ PLATSEN',official:'Öppna officiell karta',close:'Stäng resultat',search:'Sök efter en plats eller klistra in koordinater'},
  pt:{home:'Início',map:'Mapa',weather:'Tempo',ai:'Verificação IA',saved:'Guardado',result:'VERIFICAÇÃO DO ESPAÇO AÉREO',official:'Abrir mapa oficial',close:'Fechar resultado',search:'Pesquisar local ou colar coordenadas'},
  pl:{home:'Start',map:'Mapa',weather:'Pogoda',ai:'Kontrola AI',saved:'Zapisane',result:'SPRAWDZENIE PRZESTRZENI POWIETRZNEJ',official:'Otwórz oficjalną mapę',close:'Zamknij wynik',search:'Wyszukaj miejsce lub wklej współrzędne'}
};

export function t(language:string,key:keyof typeof copy.en){
  return copy[normalizeLanguage(language)]?.[key]??copy.en[key]??key;
}
