"""Fetch selected CC0 Poly Haven maps, verify advertised checksums, optimize locally.
Requires Python 3 + Pillow. Run from any directory. Network failures are fatal;
existing self-hosted assets are not overwritten until all requested maps succeed.
No runtime CDN or API dependency is introduced.
"""
import hashlib
import io
import json
import tempfile
import urllib.request
from pathlib import Path
from PIL import Image

DEST = Path(__file__).resolve().parents[1] / 'public/assets/operations'
ASSETS = {'concrete': 'gravel_concrete_03', 'metal': 'metal_plate',
          'asphalt': 'asphalt_02', 'ground': 'brown_mud_leaves_01'}
HEADERS = {'User-Agent': 'OperationShadowstrike-AssetPreparation/1.0'}


def download(url):
    with urllib.request.urlopen(urllib.request.Request(url, headers=HEADERS), timeout=60) as response:
        return response.read()


def choose(files, channel):
    key = {'diff': 'Diffuse', 'rough': 'Rough', 'ao': 'AO', 'metal': 'Metal'}.get(channel, channel)
    sizes = files.get(key, {})
    for size in ['1k', '2k']:
        for extension in ['png', 'jpg']:
            entry = sizes.get(size, {}).get(extension)
            if entry:
                return entry
    return None


records = []
with tempfile.TemporaryDirectory() as directory:
    stage = Path(directory)
    for material, asset_id in ASSETS.items():
        api_url = f'https://api.polyhaven.com/files/{asset_id}'
        files = json.loads(download(api_url))
        info = json.loads(download(f'https://api.polyhaven.com/info/{asset_id}'))
        images = {}
        sources = []
        for channel in ['diff', 'nor_gl', 'rough', 'ao', 'metal']:
            entry = choose(files, channel)
            if not entry:
                if channel in ['diff', 'nor_gl', 'rough']:
                    raise RuntimeError(f'{asset_id}: required {channel} map is unavailable')
                continue
            data = download(entry['url'])
            if entry.get('md5') and hashlib.md5(data).hexdigest() != entry['md5']:
                raise RuntimeError(f'{asset_id}: source checksum mismatch for {channel}')
            image = Image.open(io.BytesIO(data)).convert('RGB')
            image.thumbnail((1024, 1024), Image.Resampling.LANCZOS)
            images[channel] = image
            sources.append({'channel': channel, 'url': entry['url'],
                            'sha256': hashlib.sha256(data).hexdigest(), 'source_md5': entry.get('md5')})
        albedo = f'{material}-albedo.webp'
        normal = f'{material}-normal.webp'
        orm = f'{material}-orm.png'
        images['diff'].save(stage / albedo, 'WEBP', quality=90, method=6)
        # Preserve normal values through lossless encoding, not perceptual JPEG.
        images['nor_gl'].save(stage / normal, 'WEBP', lossless=True, method=6)
        size = images['rough'].size
        ao = images.get('ao', Image.new('RGB', size, 'white')).resize(size).getchannel('R')
        rough = images['rough'].resize(size).getchannel('R')
        default_metal = 'white' if material == 'metal' else 'black'
        metallic = images.get('metal', Image.new('RGB', size, default_metal)).resize(size).getchannel('R')
        Image.merge('RGB', (ao, rough, metallic)).save(stage / orm, optimize=True)
        records.append({'name': material, 'asset_id': asset_id,
                        'source': f'https://polyhaven.com/a/{asset_id}', 'license': 'CC0-1.0',
                        'attribution_required': False, 'ao_available': 'ao' in images,
                        'albedo': albedo, 'normal': normal, 'orm': orm,
                        'sources': sources, 'authors': info.get('authors', {}),
                        'asset_name': info.get('name'), 'source_scale': info.get('scale'),
                        'optimized_files': {key: {'sha256': hashlib.sha256((stage / name).read_bytes()).hexdigest(),
                                                  'bytes': (stage / name).stat().st_size}
                                            for key, name in [('albedo', albedo), ('normal', normal), ('orm', orm)]}})
    for path in stage.iterdir():
        (DEST / path.name).write_bytes(path.read_bytes())
    manifest = {'available': True, 'resolution_limit': 1024, 'materials': records}
    (DEST / 'materials.json').write_text(json.dumps(manifest, indent=2) + '\n')
print('Prepared four self-hosted PBR materials and source/checksum manifest.')
