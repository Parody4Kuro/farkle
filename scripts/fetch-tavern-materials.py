"""Fetch pinned, CC0 PBR maps from Poly Haven. Runtime never contacts these hosts."""
import hashlib
import json
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / 'public/art/materials'
SOURCES = ROOT / 'artifacts/art-source'
MATERIALS = {'wood': 'wood_table_worn', 'leather': 'brown_leather', 'fabric': 'denim_fabric'}

def fetch(url, destination):
    destination.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(['curl', '-fLsS', '--retry', '2', '--max-time', '120', url, '-o', str(destination)], check=True)

def main():
    records = []
    for label, asset in MATERIALS.items():
        metadata = SOURCES / 'licenses' / (asset + '.json')
        fetch('https://api.polyhaven.com/files/' + asset, metadata)
        info = json.loads(metadata.read_text())
        for channel, key in [('color', 'Diffuse'), ('normal', 'nor_gl'), ('roughness', 'Rough')]:
            entry = info[key]['1k']['jpg']
            destination = OUT / f'{label}-{channel}.jpg'
            fetch(entry['url'], destination)
            data = destination.read_bytes()
            if hashlib.md5(data).hexdigest() != entry['md5']:
                raise ValueError('Upstream checksum mismatch: ' + str(destination))
            records.append({'file': str(destination.relative_to(ROOT)), 'source': entry['url'],
                            'asset': 'https://polyhaven.com/a/' + asset, 'license': 'CC0-1.0',
                            'sha256': hashlib.sha256(data).hexdigest(), 'modifications': '1K original map; runtime tint and UV scale'})
    environment = json.loads((SOURCES / 'licenses/lebombo.json').read_text())
    target = ROOT / environment['file']
    fetch(environment['download']['url'], target)
    if hashlib.sha256(target.read_bytes()).hexdigest() != environment['sha256']:
        raise ValueError('Environment checksum mismatch')
    (SOURCES / 'materials.json').write_text(json.dumps(records, indent=2) + '\n')
    print(f'Verified {len(records)} local CC0 material maps.')

if __name__ == '__main__':
    main()
