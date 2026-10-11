"""Read and write the modular System authoring package used by data generators."""
import copy
import json
from pathlib import Path
from json_sources import without_reference_urls


def read_system(path):
    path = Path(path)
    cache = {}

    def resolve(value):
        if isinstance(value, dict) and '$ref' in value:
            name, _, pointer = value['$ref'].partition('#')
            if name not in cache:
                cache[name] = json.loads((path.parent / name).read_text(encoding='utf-8'))
            item = cache[name]
            if isinstance(item, dict) and "assetVersion" in item:
                item = item["data"]
            for token in pointer.lstrip('/').split('/') if pointer else []:
                token = token.replace('~1', '/').replace('~0', '~')
                item = item[int(token)] if isinstance(item, list) else item[token]
            return resolve(item)
        if isinstance(value, dict):
            return {key: resolve(item) for key, item in value.items()}
        if isinstance(value, list):
            result = []
            for item in value:
                resolved = resolve(item)
                if isinstance(item, dict) and '$ref' in item and isinstance(resolved, list):
                    result.extend(resolved)
                else:
                    result.append(resolved)
            return result
        return value

    return resolve(json.loads(path.read_text(encoding='utf-8')))


def write_system(path, data, modular=None):
    path = Path(path)
    data = without_reference_urls(data)
    if modular is None:
        original = json.loads(path.read_text(encoding='utf-8')) if path.exists() else {}
        modular = any(isinstance(f, dict) and '$ref' in f for f in original.get('features', []))

    def save(target, value):
        existing = json.loads(target.read_text(encoding='utf-8')) if target.exists() else None
        if target != path and isinstance(existing, dict) and 'assetVersion' in existing:
            value = {'assetVersion': existing['assetVersion'], 'data': value}
        if existing != value:
            target.write_text(json.dumps(value, indent=2, ensure_ascii=False) + '\n', encoding='utf-8')

    if not modular:
        save(path, data)
        return
    manifest = copy.deepcopy(data)
    groups = {name: [] for name in ['features', 'class-features', 'subclasses', 'spells', 'races']}
    class_ids = {cls['id'] for config in data['configurations'] for cls in config['classes']}
    for feature in data['features']:
        tags = feature.get('tags', [])
        fid = feature['id']
        if 'spell' in tags or feature.get('roll', {}).get('spell') or '.spell.' in fid or '.prepared.' in fid:
            group = 'spells'
        elif 'subclass' in fid or any(tag in tags for tag in ['subclass-feature', 'subclass-mechanic']) or any(':artificer.' + name in fid for name in ['armorer', 'alchemist', 'artillerist', 'battle-smith']):
            group = 'subclasses'
        elif 'race' in tags or ':race.' in fid or ':race-' in fid:
            group = 'races'
        elif any(fid.startswith(cls + '.') for cls in class_ids):
            group = 'class-features'
        else:
            group = 'features'
        groups[group].append(feature)
    manifest['features'] = [{'$ref': name + '.json'} for name in groups]
    for name, features in groups.items():
        save(path.parent / (name + '.json'), features)
    for key, filename in [('blocks', 'blocks.json'), ('items', 'items.json'), ('itemFeatures', 'item-features.json')]:
        if key in data:
            save(path.parent / filename, data[key])
            manifest[key] = {'$ref': filename}
    for key, filename in [('system', 'definitions.json'), ('classes', 'classes.json')]:
        variants = {}
        for config in manifest['configurations']:
            value = config[key]
            name = next((name for name, item in variants.items() if item == value), None)
            if name is None:
                name = 'variant-' + str(len(variants) + 1)
                variants[name] = value
            config[key] = {'$ref': filename + '#/' + name}
        save(path.parent / filename, variants)
    save(path, manifest)
