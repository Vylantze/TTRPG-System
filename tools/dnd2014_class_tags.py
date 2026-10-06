"""Shared authoring helper for the bundled 2014 Class Feature category."""


def apply_class_tags(system):
    count = 0
    for feature in system['features']:
        local_id = feature['id'].removeprefix('dnd5e:2014:')
        if local_id.startswith(('fighter.', 'rogue.', 'wizard.', 'style.', 'expertise.')) or local_id == 'ability-score-improvement':
            tags = feature.setdefault('tags', [])
            if 'class-feature' not in tags:
                tags.insert(0, 'class-feature')
            count += 1
    for configuration in system['configurations']:
        configuration['system'].setdefault('tagDisplayNames', {})['class-feature'] = 'Class Feature'
    return count
