from __future__ import annotations

import json
from pathlib import Path
import tempfile
import unittest

from pipeline.import_private_export import import_export
from pipeline.private_importer.core import classify_category, normalize_feature, validate_dataset


class PrivateImporterTests(unittest.TestCase):
    def test_classification_uses_source_text_not_colour(self) -> None:
        self.assertEqual("prohibited", classify_category("Flight prohibited"))
        self.assertEqual("unknown", classify_category("#ff0000"))

    def test_normalizer_preserves_original_properties(self) -> None:
        feature = {
            "type": "Feature",
            "id": "one",
            "geometry": {
                "type": "Polygon",
                "coordinates": [[[12, 41], [13, 41], [13, 42], [12, 41]]],
            },
            "properties": {"name": "Official name", "restriction": "Prohibited", "extra": 7},
        }
        normalized = normalize_feature(
            feature,
            country="IT",
            authority="ENAC / d-flight",
            source_url="https://www.d-flight.it/web-app/",
            layer_name="test",
            imported_at="2026-07-19T00:00:00+00:00",
        )
        self.assertEqual(7, normalized["properties"]["originalProperties"]["extra"])
        self.assertTrue(validate_dataset({"type": "FeatureCollection", "features": [normalized]})["valid"])

    def test_manual_import_stays_private_and_needs_no_credentials(self) -> None:
        payload = {
            "type": "FeatureCollection",
            "features": [
                {
                    "type": "Feature",
                    "id": "it-1",
                    "geometry": {
                        "type": "Polygon",
                        "coordinates": [[[12, 41], [13, 41], [13, 42], [12, 41]]],
                    },
                    "properties": {"name": "Fixture", "restriction": "Conditional"},
                }
            ],
        }
        with tempfile.TemporaryDirectory() as directory:
            source = Path(directory) / "export.geojson"
            source.write_text(json.dumps(payload), encoding="utf-8")
            output = Path(__file__).resolve().parents[2] / "private-data" / "tests" / "it.geojson"
            try:
                result = import_export("IT", source, output)
                self.assertEqual(1, result["featureCount"])
                stored = json.loads(output.read_text(encoding="utf-8"))
                self.assertTrue(stored["privatePersonalUseOnly"])
            finally:
                output.unlink(missing_ok=True)
                output.parent.rmdir()


if __name__ == "__main__":
    unittest.main()
