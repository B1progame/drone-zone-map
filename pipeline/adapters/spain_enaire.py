"""Official ENAIRE servAIS viewport downloader (never scrapes map pixels)."""
import httpx
from .base import FetchResult
class SpainEnaireAdapter:
    country_code="ES"
    service_url="https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V0/MapServer"
    layers={0:"ZGUAS_Infraestructuras",2:"ZGUAS_Aero",3:"ZGUAS_Urbano"}
    attribution="ENAIRE / AIS"
    def fetch(self)->FetchResult: return FetchResult([], ["Use live MapServer export/identify endpoints. Bulk offline export is disabled by the provider."])
    def fetch_bbox(self,bbox:tuple[float,float,float,float],precision:int=5,max_pages:int=10)->FetchResult:
        """Download official GeoJSON intersecting a WGS84 bbox, page by page.

        Bounding the request is intentional: it avoids bulk harvesting and keeps
        geometry, memory use and browser rendering proportional to the viewed area.
        """
        west,south,east,north=bbox
        if not (-19<=west<east<=5 and 27<=south<north<=45):
            raise ValueError("Spain bbox must be within -19,27,5,45 (WGS84)")
        features=[];warnings=[]
        with httpx.Client(headers={"User-Agent":"AerisDroneMap/0.2 (+https://github.com/B1progame/drone-zone-map)"},timeout=60,follow_redirects=True) as client:
            for layer,name in self.layers.items():
                for page in range(max_pages):
                    params={"where":"1=1","geometry":f"{west},{south},{east},{north}","geometryType":"esriGeometryEnvelope","inSR":4326,"spatialRel":"esriSpatialRelIntersects","outFields":"identifier,type,name,reasons,lower,upper,uom,updateDateTime","returnGeometry":"true","outSR":4326,"geometryPrecision":precision,"resultOffset":page*2000,"resultRecordCount":2000,"f":"geojson"}
                    response=client.get(f"{self.service_url}/{layer}/query",params=params);response.raise_for_status();payload=response.json();batch=payload.get("features",[])
                    for feature in batch: feature.setdefault("properties",{})["enaireLayer"]=layer
                    features.extend(batch)
                    if not payload.get("exceededTransferLimit") or not batch: break
                else: warnings.append(f"{name}: stopped at {max_pages*2000} features; use a smaller bbox")
        warnings.append("Live official snapshot; temporary changes may occur. Re-check ENAIRE before flight.")
        return FetchResult(features,warnings)
