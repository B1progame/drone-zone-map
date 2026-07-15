"""Normalize Luxembourg's official CC0 ED-269 JSON feed to GeoJSON."""
import httpx
from .base import FetchResult
class LuxembourgGeojsonAdapter:
    country_code="LU"
    endpoint="https://drones.geoportail.lu/zones"
    def fetch(self)->FetchResult:
        response=httpx.get(self.endpoint,headers={"User-Agent":"DroneZoneMapUpdater/0.1"},follow_redirects=True,timeout=30)
        response.raise_for_status()
        payload=response.json()
        features=[]
        for zone in payload.get("features",[]):
            for index,volume in enumerate(zone.get("geometry",[])):
                projection=volume.get("horizontalProjection")
                if not projection: continue
                authority=(zone.get("zoneAuthority") or [{}])[0]
                features.append({"type":"Feature","id":f"{zone.get('identifier','LU')}-{index}","properties":{"id":zone.get("identifier"),"name":zone.get("name"),"type":zone.get("type"),"restriction":zone.get("restriction"),"reasons":zone.get("reason",[]),"lowerLimit":volume.get("lowerLimit"),"upperLimit":volume.get("upperLimit"),"unit":volume.get("uomDimensions"),"lowerReference":volume.get("lowerVerticalReference"),"upperReference":volume.get("upperVerticalReference"),"authority":authority.get("name"),"updated":payload.get("title"),"attribution":"Direction de l'Aviation Civile Luxembourg · CC0"},"geometry":projection})
        return FetchResult(features,["Geo-awareness only; re-check the official geoportal before flight."])
