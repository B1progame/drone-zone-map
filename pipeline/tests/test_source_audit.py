from __future__ import annotations

from pathlib import Path
import json
import unittest

from pipeline.adapters.public_uas_feeds import SlovakiaTransportAuthorityInspector
from pipeline.audit_registry import audit


ROOT = Path(__file__).resolve().parents[2]


class SourceAuditTests(unittest.TestCase):
    def test_complete_registry_has_a_source_specific_disposition(self) -> None:
        records = json.loads(
            (ROOT / "public" / "data" / "sources" / "countries.json").read_text(encoding="utf-8")
        )
        report = audit(records, as_of="2026-07-17")
        self.assertEqual(len(records), report["countryCount"])
        self.assertEqual(
            len(records),
            sum(report["dispositionCounts"].values()),
        )

    def test_slovak_inspector_tolerates_authority_kml_xsi_prefix(self) -> None:
        payload = b"""<?xml version="1.0"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Placemark xsi:schemaLocation="http://www.opengis.net/kml/2.2 kml22gx.xsd">
    <name>Example</name><Polygon/>
  </Placemark>
</kml>"""
        root = SlovakiaTransportAuthorityInspector._kml_root(payload)
        self.assertEqual(1, len(root.findall(".//{*}Placemark")))


if __name__ == "__main__":
    unittest.main()
