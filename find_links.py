import urllib.request
import re

url = 'https://docs.2gis.com/api-platform'

try:
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
    with urllib.request.urlopen(req, timeout=10) as resp:
        html = resp.read().decode('utf-8', errors='replace')
        
    # Find all links containing mapgl, raster, tiles, static, map
    links = re.findall(r'href="(/[^"]*(?:mapgl|raster|tiles|static|map)[^"]*)"', html, re.IGNORECASE)
    unique = sorted(set(links))
    print(f"Found {len(unique)} links on {url}")
    for link in unique[:30]:
        print(link)
        
except Exception as e:
    print(f"ERROR: {e}")
