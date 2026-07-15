"""DIPUL adapter placeholder: use verified WMS capabilities/config before requests."""
from .base import FetchResult
class GermanyDipulAdapter:
    country_code = "DE"
    def fetch(self) -> FetchResult:
        return FetchResult([], ["No production WMS endpoint/layer is hardcoded; verify official capabilities and reuse terms first."])
