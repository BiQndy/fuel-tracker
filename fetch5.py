import urllib.request

urls = [
    'https://docs.2gis.com/maps/others/rasterjs/start',
    'https://docs.2gis.com/mapgl/start',
]

for url in urls:
    try:
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=15) as resp:
            html = resp.read().decode('utf-8', errors='replace')
        print(f"=== {url} ===")
        print(html[:7000])
        print("\n" + "="*60 + "\n")
    except Exception as e:
        print(f"=== {url} === ERROR: {e}\n")
