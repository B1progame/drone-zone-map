"""Official ENAIRE servAIS ED-318-compatible ArcGIS service adapter metadata."""
from .base import FetchResult
class SpainEnaireAdapter:
    country_code="ES"
    service_url="https://servais.enaire.es/insignia/rest/services/NSF_SRV/SRV_UAS_ZG_V0/MapServer"
    layers={0:"ZGUAS_Infraestructuras",2:"ZGUAS_Aero",3:"ZGUAS_Urbano"}
    attribution="ENAIRE / AIS"
    def fetch(self)->FetchResult: return FetchResult([], ["Use live MapServer export/identify endpoints. Bulk offline export is disabled by the provider."])
