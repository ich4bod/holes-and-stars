import pathlib
import yaml
p = pathlib.Path('/home/ichabod/apps/ichabod-crane-net/data/creations.yaml')
entries = yaml.safe_load(p.read_text())
items = [e for e in entries if e.get('url', '').rstrip('/') == 'https://holes-and-stars.ichabod-crane.net']
assert len(items) == 1, 'exactly one canonical creations entry'
e = items[0]
assert e['name'] == 'Holes & Stars'
assert e['source'] == 'https://github.com/ich4bod/holes-and-stars'
assert e['blurb'] == 'Punch a few holes and grow a sky of interference. Move the whole mask; the sky stays put.'
assert str(e['built']) == '2026-10-08'
assert e['stack'] == 'Canvas · SVG · JavaScript'
assert e['weight'] == 53
print('catalog pass')
