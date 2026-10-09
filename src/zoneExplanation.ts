// Explain the source category, without inferring legal permission from a colour.
export function zoneExplanation(layer:string,reason:unknown,language='en'):string|undefined {
 const code=`${layer} ${Array.isArray(reason)?reason.join(' '):reason??''}`.toLowerCase();
 const rules:[RegExp,string,string][]=[
  [/flughaef|flugplatz|kontrollzone|air_traffic|aerodrome|airport/,'Protects aircraft, airport approaches and aerodrome operations. Read the altitude limits and the published coordination or authorization conditions.','Schützt Flugverkehr, Anflugwege und den Flugplatzbetrieb. Beachte Höhenlimits und die veröffentlichten Freigabe- oder Genehmigungsbedingungen.'],
  [/naturschutz|vogelschutz|nationalpark|ffh|nature|environment/,'Protects habitats, wildlife or conservation areas. The source conditions determine whether flight, take-off or landing is restricted.','Schützt Lebensräume, Tiere oder Schutzgebiete. Die Quellenbedingungen legen fest, ob Flug, Start oder Landung eingeschränkt sind.'],
  [/bahnanlag|bundesauto|bundesstrass|stromleit|windkraft|kraftwerk|industrie|infrastructure/,'Identifies transport or infrastructure that needs protection. Check the applicable separation distances and consent requirements in the legal reference.','Kennzeichnet schutzbedürftige Verkehrswege oder Infrastruktur. Prüfe die vorgeschriebenen Abstände und Zustimmungen in der Rechtsgrundlage.'],
  [/militaer|justiz|polizei|behoerd|sicherheit|diplomat|sensitive|security/,'Protects a sensitive facility or security interest. Consult the listed authority and source conditions before planning an operation.','Schützt eine sensible Einrichtung oder Sicherheitsinteressen. Prüfe die zuständige Stelle und die Quellenbedingungen vor der Flugplanung.'],
  [/wohngrund|population/,'Identifies residential or populated areas where privacy and ground safety conditions may apply.','Kennzeichnet Wohn- oder besiedelte Gebiete, in denen Datenschutz- und Sicherheitsbedingungen gelten können.'],
  [/temporaer|temporary/,'A time-dependent restriction. Check the validity dates and current activation notices; the presence of a boundary does not establish its daily activation.','Zeitabhängige Einschränkung. Prüfe Gültigkeitsdaten und aktuelle Aktivierungshinweise; die Grenze allein belegt keine tägliche Aktivierung.']
 ];
 const entry=rules.find(([pattern])=>pattern.test(code));return entry?.[language.split('-')[0]==='de'?2:1];
}
