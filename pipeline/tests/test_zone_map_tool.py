import json
import tempfile
import unittest
from pathlib import Path
from pipeline.zone_map_tool import build, validate
from pipeline.adapters.ed269 import normalize_ed269

class ZoneMapToolTests(unittest.TestCase):
    def test_austrian_array_preserves_conditions_and_geometry(self):
        zone = {'identifier':'AT-example','name':'Example heliport','restriction':'REQ_AUTHORISATION','extendedProperties':{'localizedMessages':[{'language':'en','message':'Authorization required during operating hours.'}]},'geometry':[{'lowerLimit':0,'upperLimit':120,'horizontalProjection':{'type':'Polygon','coordinates':[[[9,47],[10,47],[10,48],[9,47]]]}}]}
        features=normalize_ed269([zone],attribution='AT',source_url='https://example.org')
        self.assertEqual(features[0]['geometry'],zone['geometry'][0]['horizontalProjection'])
        self.assertEqual(features[0]['properties']['extendedProperties'],zone['extendedProperties'])
        with tempfile.TemporaryDirectory() as folder:
            result=build([zone],Path(folder),'AT','https://example.org')
            self.assertEqual(result['features'],1)
            self.assertEqual(json.loads((Path(folder)/'zones.geojson').read_text())['features'],features)
            self.assertTrue((Path(folder)/'manifest.json').exists())
            self.assertIn('application/json',(Path(folder)/'map.html').read_text())

    def test_invalid_coordinates_are_rejected(self):
        with self.assertRaises(ValueError):
            validate({'type':'FeatureCollection','features':[{'geometry':{'type':'Polygon','coordinates':[[[181,47],[9,47],[9,48],[181,47]]]}}]})

    def test_embedded_source_text_cannot_end_script(self):
        data={'type':'FeatureCollection','features':[{'properties':{'name':'</script><script>alert(1)</script>'},'geometry':{'type':'Polygon','coordinates':[[[9,47],[10,47],[10,48],[9,47]]]}}]}
        with tempfile.TemporaryDirectory() as folder:
            build(data,folder,'DE','test')
            html=(Path(folder)/'map.html').read_text()
            self.assertNotIn('</script><script>alert(1)',html)
            self.assertIn('\\u003c/script\\u003e',html)
