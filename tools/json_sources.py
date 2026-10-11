"""Keep publication credits but omit D&D Beyond and Roll20 URLs in JSON output."""
import re

REFERENCE_URL = re.compile(r'https?://(?:[a-z0-9-]+\.)*(?:dndbeyond\.com|roll20\.net)(?=[:/\s]|$)[^\s,<>"\]]*', re.I)


def without_reference_urls(value):
    if isinstance(value, dict):
        return {key: without_reference_urls(item) for key, item in value.items()
                if not (key.lower() in ('url', 'href') and isinstance(item, str) and REFERENCE_URL.fullmatch(item))}
    if isinstance(value, list):
        return [without_reference_urls(item) for item in value]
    if not isinstance(value, str) or not REFERENCE_URL.search(value):
        return value
    cleaned = REFERENCE_URL.sub('', value).strip(' ,;')
    if cleaned:
        return cleaned
    if '/tcoe/' in value:
        return 'Tasha’s Cauldron of Everything (2020)'
    if '357975-blood-hunter' in value:
        return 'Critical Role (partner content), Blood Hunter'
    return 'D&D Beyond' if 'dndbeyond.com' in value.lower() else 'Roll20'
