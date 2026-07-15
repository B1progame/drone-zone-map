"""Base interface for verified, polite official-source adapters."""
from dataclasses import dataclass
from typing import Protocol

@dataclass
class FetchResult:
    features: list[dict]
    warnings: list[str]

class CountryAdapter(Protocol):
    country_code: str
    def fetch(self) -> FetchResult: ...
