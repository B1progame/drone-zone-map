# Map coverage

This page is the authoritative, human-readable coverage status for Aeris as of 25 September 2026. Street and satellite basemaps can be viewed worldwide, and offline basemap packages can be downloaded around a selected location in any country. Official drone-zone coverage is narrower: a country or territory that is **not shown below as directly mapped has no Aeris aviation overlay**. No coverage, missing shapes, or a blank map never means that flight is allowed.

The application is planning context only. Before every flight, check the responsible aviation authority, its current map, NOTAMs, temporary restrictions, and any local rules.

## Directly mapped countries

Aeris currently renders official or openly licensed zone information for 16 countries. The exact provider, license, limitations, and update status are kept in the [source registry](../public/data/sources/countries.json).

| Country | Coverage note |
| --- | --- |
| Canada (CA) | **Partial:** Transport Canada open airport-with-air-navigation-services points and national-park boundaries render live and are available in offline packages. 5.6 km WGS84 orientation rings are computed around the airport points. This is not a complete certified aerodrome/heliport list or controlled-airspace map. Use the [NRC Drone Site Selection Tool](https://cnrc.canada.ca/en/drone-tool-2/) for exact airspace and restrictions; NRC does not permit redistribution of its NAV CANADA-derived geometry. |
| Denmark (DK), Estonia (EE), Finland (FI), France (FR), Germany (DE) | Official live or bundled national geozones. |
| Ireland (IE), Liechtenstein (LI), Luxembourg (LU), Netherlands (NL), Portugal (PT), Spain (ES) | Official national geozones. FOCA's federal dataset covers Switzerland and Liechtenstein. |
| Sweden (SE), Switzerland (CH), United Kingdom (GB), United States (US) | FAA AIS controlled Class B/C/D and surface Class E zones, restricted/prohibited special-use airspace, and UAS facility grids. Facility ceilings are not permission; check B4UFLY, TFRs, and NOTAMs. |

## Official map hand-offs — not rendered in Aeris

These 37 countries have an official source recorded by Aeris, but their zone geometry is deliberately **not** put on the Aeris map. This avoids copying restricted data, bypassing a login or operational workflow, or inferring reuse permission from an interactive map. Use the linked authority tool.

| Country | Official source | Why it is not rendered |
| --- | --- | --- |
| Belgium (BE) | [Droneguide](https://map.droneguide.be/) | No stable documented public data URL and explicit reuse terms verified. |
| Austria (AT) | [Austro Control Dronespace](https://utm.dronespace.at/avm/) | Official interactive planner; no verified reusable zone feed. |
| Italy (IT) | [ENAC / d-flight](https://www.d-flight.it/web-app/) | Registered operators may obtain a personal export; public redistribution is not permitted. |
| Norway (NO) | [Avinor Drone map](https://experience.arcgis.com/experience/9d098dbc738e436f9525fdb4ef443f61) | Avinor terms prohibit copying and redistributing service data. |
| Poland (PL) | [PANSA DroneTower](https://www.pansa.pl/dronetower/) | Operational planning/notification service; no reusable anonymous feed verified. |
| Czechia (CZ) | [CAA Czechia / DroneMap](https://dronemap.gov.cz/index.php?lang=2) | Official interactive map; no documented reusable endpoint verified. |
| Slovakia (SK) | [Transport Authority](https://letectvo.nsat.sk/bezpilotne-letectvo/zemepisne-oblasti-uas/) | KML package exists, but reuse terms are not stated. |
| Hungary (HU) | [HungaroControl MyDroneSpace](https://mydronespace.hu/) | Official planning service; no reusable anonymous feed verified. |
| Romania (RO) | [Romanian CAA](https://www.caa.ro/ro/pages/drone) | Interactive map/table, but no reusable feed or reuse licence verified. |
| Bulgaria (BG) | [Bulgarian CAA](https://www.caa.bg/bg/category/633/7062) | Package can be inspected locally; reuse permission is not confirmed. |
| Greece (GR) | [HCAA Drone Aware Greece](https://hcaa.gov.gr/el/where-you-are-allowed-fly-uas-greece) | Official pre-flight map; no reusable public feed verified. |
| Croatia (HR) | [Croatia Control AMC Map](https://amc.crocontrol.hr/amc/maps/) | Public map shows UAG, ULG and URG drone zones and current airspace. Registration is needed for operational reservations or approvals; no reusable public feed verified. |
| Andorra (AD) | [Government of Andorra aviation and drone information](https://www.govern.ad/ca/tematiques/accio-climatica/transports/transport-aeri) | 2025 UAS regulation defines free, limited and prohibited flight zones. No current public map or reusable geometry download verified. |
| Slovenia (SI) | [Civil Aviation Agency](https://www.caa.si/geografske-omejitve-za-uas.html) | Public map metadata exists, but no reuse licence is stated. |
| Latvia (LV) | [LGS / Civil Aviation Agency](https://www.airspace.lv/drones/en) | Live official map, but no stable reusable download URL verified. |
| Lithuania (LT) | [Oro Navigacija](https://www.ans.lt/en/services/unmanned-aerial-vehicles-drones) | Registered UTM platform; no documented public reusable feed verified. |
| Australia (AU) | [CASA Drone Safety](https://www.casa.gov.au/knowyourdrone/drone-safety-apps) | Data access is for onboarded providers and authenticated services. |
| New Zealand (NZ) | [CAA New Zealand / AirShare](https://www.aviation.govt.nz/drones/flying-your-drone-safely/check-the-airspace/) | Officially endorsed map; no reusable public feed verified. |
| Japan (JP) | [MLIT DIPS 2.0](https://www.mlit.go.jp/koku/koku_ua_dips.html) | Official authenticated platform. |
| Brazil (BR) | [DECEA SARPAS](https://www.gov.br/pt-br/servicos/solicitar-autorizacao-para-voo-de-aeronaves-remotamente-pilotadas) | Authenticated operational service. |
| India (IN) | [DGCA Digital Sky](https://digitalsky.dgca.gov.in/) | Official real-time platform; no reusable public API verified. |
| Singapore (SG) | [CAAS / OneMap](https://www.caas.gov.sg/unmanned-aircraft/no-fly-zones-and-ua-flying-areas/) | Authoritative map; no reusable UA-zone feed verified. |
| South Africa (ZA) | [SACAA / ATNS AIP](https://www.caa.co.za/industry-information/aeronautical-information-index-of-aics/) | Current AIP/NOTAM publications are authoritative; no reusable national feed verified. |
| Malta (MT) | [Transport Malta / Civil Aviation Directorate](https://www.transport.gov.mt/aviation/drones/geographical-zones-5487) | Official page links the interactive map; no reusable public zone feed or redistribution permission verified. |
| Cyprus (CY) | [Department of Civil Aviation](https://drones.gov.cy/gr/geo-zones-map/) | Official map page provides a versioned KMZ download, but no redistribution licence was verified. |
| Iceland (IS) | [Icelandic Transport Authority / Ísland.is](https://island.is/en/drone-map) | Official government portal links to the Transport Authority's drone map; no reusable zone feed verified. |
| United Arab Emirates (AE) | [GCAA UAE Fly Zone](https://www.gcaa.gov.ae/en/Pages/NoFlyZonetest.aspx) | Official no-fly and prohibited-zone map. The KMZ linked from GCAA registration returned 404 during review, so Aeris links to the working interactive map. |
| Argentina (AR) | [ANAC Aeronautical Information Service](https://ais.anac.gob.ar/aip) | Current AIP charts include prohibited, restricted, and dangerous areas; review current amendments and NOTAMs. No reusable drone-zone feed verified. |
| Mexico (MX) | [SENEAM / AFAC AIP Mexico](https://aipmexico.seneam.gob.mx/AIP/) | Official aeronautical charts and restrictions; AFAC directs RPAS operators to AIP restrictions. No reusable national drone-zone feed verified. |
| China (CN) | [CAAC UOM platform](https://app.caac.gov.cn/) | Official national unmanned-aircraft and airspace service; detailed controlled-airspace extents are published by local governments. No reusable public feed verified. |
| Türkiye (TR) | [SHGM İHA Registration System](https://iha.shgm.gov.tr/public/index) | Official drone airspace map displays green free-flight areas and manages permissions; check local flight bans and AIP/NOTAMs. |
| Thailand (TH) | [CAAT UAS Portal](https://uasportal.caat.or.th/) | Official operations portal; check current restrictions and temporary notices directly. |
| Philippines (PH) | [CAAP critical-area lookup](https://www.caap.gov.ph/hcp/) | Official coordinate lookup requires a CAPTCHA; use it directly for the selected point. |
| Indonesia (ID) | [AirNav Indonesia AIS Center](https://pia.airnavindonesia.co.id/) | Official AIP, charts, and NOTAMs. Drone authorizations also use Ministry of Transport SIDOPI-GO. |
| Malaysia (MY) | [CAAM UAS / Malaysia AIP](https://www.caam.gov.my/public/unmanned-aircraft-system-uas/) | CAAM guidance and official AIP airspace maps; no reusable UAS feed verified. |
| Colombia (CO) | [Aerocivil Visor Geográfico UAS](https://www.aerocivil.gov.co/servicios-a-la-navegacion/sistema-%20de-aeronaves-pilotadas-a-distancia-rpas-drones/Paginas/default.aspx) | Official viewer covers UAS restrictions; reuse terms for its data are not verified. |
| Vietnam (VN) | [Ministry of National Defence UAV zones map](https://cambay.mod.gov.vn/) | Official national prohibited/restricted map; no reusable feed verified. |
| Saudi Arabia (SA) | [GACA UAS Portal](https://uas.gaca.gov.sa/uas/) | Official UAS portal and geographical-zone guidance; no public reusable feed verified. |

## Not yet integrated or source not yet reviewed

The following 196 ISO 3166-1 regions have no Aeris map layer or official hand-off entry yet. They are not supported. The codes include countries and assigned territories, matching the scope used by the project’s coverage audit.

```text
AD AF AG AI AL AM AO AQ AS AW AX AZ BA BB BD BF
BH BI BJ BL BM BN BO BQ BS BT BV BW BY BZ CC CD
CF CG CI CK CL CM CR CU CV CW CX DJ DM DO DZ EC
EG EH ER ET FJ FK FM FO GA GD GE GF GG GH GI GL
GM GN GP GQ GS GT GU GW GY HK HM HN HT IL IM IO
IQ IR JE JM JO KE KG KH KI KM KN KP KR KW KY KZ
LA LB LC LK LR LS LY MA MC MD ME MF MG MH MK ML
MM MN MO MP MQ MR MS MU MV MW MZ NA NC NE NF NG
NI NP NR NU OM PA PE PF PG PK PM PN PR PS PW PY
QA RE RS RU RW SB SC SD SH SJ SL SM SN SO SR SS
ST SV SX SY SZ TC TD TF TG TJ TK TL TM TN TO TT
TV TW TZ UA UG UM UY UZ VA VC VE VG VI VU WF WS
YE YT ZM ZW
```

Together, the 37 official hand-offs and 196 unintegrated/unreviewed ISO regions are every region not directly mapped by Aeris in the current 249-region audit. The live, machine-readable source of record is [`countries.json`](../public/data/sources/countries.json); audit progress is in [`world-progress.json`](../pipeline/state/world-progress.json).

