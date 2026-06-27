import urllib.request
import re

pages = [
    'https://docs.2gis.com/mapgl/overview/features',
    'https://docs.2gis.com/maps/others/rasterjs/overview',
]

for url in pages:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        
        # Find links containing 'quick', 'start', 'getting', 'intro'
        links = re.findall(r'href="(/[^"]*(?:quick|start|getting|intro|install|begin)[^"]*)"', html, re.IGNORECASE)
        unique = sorted(set(links))
        print(f"=== {url} ===")
        print(f"Relevant links: {unique[:10]}")
        
        # Also print text content around certain keywords
        for keyword in ['script src', 'DGIS', 'api key', 'ключ', 'инициализации', 'initialize']:
            matches = list(re.finditer(r'.{0,120}' + re.escape(keyword) + r'.{0,120}', html, re.IGNORECASE))[:3]
            for m in matches:
                print(f"  ...{m.group().strip()}...")
        print()
    except Exception as e:
        print(f"=== {url} === ERROR: {e}\n")
