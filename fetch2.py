import urllib.request

pages = [
    'https://docs.2gis.com/mapgl/overview/features',
    'https://docs.2gis.com/maps/others/rasterjs/overview',
]

for url in pages:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=10) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        print(f"=== {url} ===")
        print(html[:4000])
        print("\n" + "="*60 + "\n")
    except Exception as e:
        print(f"=== {url} === ERROR: {e}\n")
