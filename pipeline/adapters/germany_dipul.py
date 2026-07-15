"""Official DIPUL WMS configuration for personal/non-commercial map use."""
from .base import FetchResult
class GermanyDipulAdapter:
    country_code = "DE"
    capabilities_url = "https://uas-betrieb.de/geoservices/dipul/wms?service=WMS&version=1.3.0&request=GetCapabilities"
    attribution = "Quelle Geodaten: DFS, BKG 2026"
    def fetch(self) -> FetchResult:
        return FetchResult([], ["DIPUL is a raster WMS; consume it directly rather than representing pixels as vector features."])
