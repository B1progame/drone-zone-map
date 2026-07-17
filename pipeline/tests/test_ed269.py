from __future__ import annotations

from math import asin, cos, radians, sin, sqrt
import unittest

from pipeline.adapters.ed269 import circle_polygon, normalize_ed269


def distance_metres(a: list[float], b: list[float]) -> float:
    lng1, lat1, lng2, lat2 = map(radians, [a[0], a[1], b[0], b[1]])
    dlat, dlng = lat2 - lat1, lng2 - lng1
    value = sin(dlat / 2) ** 2 + cos(lat1) * cos(lat2) * sin(dlng / 2) ** 2
    return 2 * 6_371_008.8 * asin(sqrt(value))


class Ed269Tests(unittest.TestCase):
    def test_circle_is_closed_and_radius_is_preserved(self) -> None:
        geometry = circle_polygon([24.75, 59.44], 5_000)
        ring = geometry["coordinates"][0]
        self.assertEqual(97, len(ring))
        self.assertEqual(ring[0], ring[-1])
        self.assertAlmostEqual(5_000, distance_metres([24.75, 59.44], ring[0]), delta=1)

    def test_normalizer_preserves_zone_and_volume_details(self) -> None:
        payload = {
            "features": [
                {
                    "identifier": "TEST",
                    "name": "Test zone",
                    "restriction": "REQ_AUTHORISATION",
                    "reason": ["AIR_TRAFFIC"],
                    "zoneAuthority": [{"name": "CAA", "email": "ops@example.test"}],
                    "geometry": [
                        {
                            "lowerLimit": 0,
                            "upperLimit": 120,
                            "uomDimensions": "M",
                            "horizontalProjection": {
                                "type": "Circle",
                                "center": [4.9, 52.37],
                                "radius": 1000,
                            },
                        }
                    ],
                }
            ]
        }
        feature = normalize_ed269(payload, attribution="Test CAA", source_url="https://example.test")[0]
        self.assertEqual("Polygon", feature["geometry"]["type"])
        self.assertEqual("Circle", feature["properties"]["sourceGeometryType"])
        self.assertEqual(1000, feature["properties"]["circleRadiusMetres"])
        self.assertEqual(120, feature["properties"]["upperLimit"])
        self.assertEqual("CAA", feature["properties"]["authorityName"])
        self.assertEqual(["AIR_TRAFFIC"], feature["properties"]["reason"])


if __name__ == "__main__":
    unittest.main()
