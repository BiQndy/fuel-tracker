// Fuel Route Tracker - Yandex Maps API 2.1
const els = {
    pointA: document.getElementById('pointA'),
    pointB: document.getElementById('pointB'),
    distance: document.getElementById('distance'),
    fuelConsumption: document.getElementById('fuelConsumption'),
    fuelResult: document.getElementById('fuelResult'),
    resetBtn: document.getElementById('resetBtn'),
};

const state = { pointA: null, pointB: null, markers: [], route: null, distanceKm: null, map: null };

let clickCount = 0;

function init() {
    console.log('Yandex Maps loaded:', typeof ymaps);
    if (typeof ymaps === 'undefined') { showError(); return; }

    const map = new ymaps.Map('map', {
        center: [55.751244, 37.618423],
        zoom: 12,
        controls: ['zoomControl'],
    });
    state.map = map;

    map.events.add('click', function(e) {
        const c = e.get('coords');
        handleClick(c[0], c[1]);
    });

    els.fuelConsumption.addEventListener('input', updateResult);
    els.resetBtn.addEventListener('click', resetAll);
}

function showError() {
    const el = document.getElementById('map');
    if (el) el.innerHTML = '<div style=\'display:flex;align-items:center;justify-content:center;height:100%;color:#e0e0e0;text-align:center;padding:20px;\'><div><h3 style=\'color:#ff7043;\'>Не удалось загрузить Яндекс.Карты</h3><p>Проверьте консоль (F12). Если IP-адрес заблокирован, откройте приложение через localhost (python -m http.server 8000).</p></div></div>';
    console.error('ERROR: ymaps is not defined');
}

ymaps.ready(init);


async function handleClick(lat, lon) {
    const address = await geocode(lat, lon);
    console.log('Clicked:', lat, lon, 'Address:', address);

    if (clickCount === 0) {
        state.pointA = { lat, lon, address };
        els.pointA.textContent = address;
        clickCount = 1;
        clearMarkers(); clearRoute();
        addMarker(lat, lon, 'A', '#4fc3f7');
        resetResults();
    } else {
        state.pointB = { lat, lon, address };
        els.pointB.textContent = address;
        clickCount = 0;
        addMarker(lat, lon, 'B', '#ff7043');
        buildRoute(state.pointA, state.pointB);
    }
}


async function buildRoute(A, B) {
    clearRoute();
    console.log('Building route:', A.lat, A.lon, '->', B.lat, B.lon);

    try {
        const route = new ymaps.multiRoute.MultiRoute({
            referencePoints: [[A.lat, A.lon], [B.lat, B.lon]],
        }, { boundsAutoApply: true });

        state.map.geoObjects.add(route);
        state.route = route;

        route.model.events.add('requestsuccess', function() {
            const active = route.getActiveRoute();
            if (active) {
                const dist = active.properties.get('distance');
                console.log('Route distance:', dist);
                if (dist && dist.value) {
                    state.distanceKm = Math.round(dist.value / 10) / 100;
                    els.distance.textContent = state.distanceKm.toFixed(1) + ' км';
                    updateResult();
                }
            }
        });

        route.model.events.add('requestfail', function() {
            console.error('Route failed');
            useFallback(A, B);
        });

        setTimeout(() => { if (state.distanceKm === null) useFallback(A, B); }, 10000);

    } catch(err) {
        console.error('Route error:', err);
        useFallback(A, B);
    }
}

function useFallback(A, B) {
    const d = haversine(A.lat, A.lon, B.lat, B.lon);
    state.distanceKm = Math.round(d * 10) / 10;
    els.distance.textContent = '~' + state.distanceKm.toFixed(1) + ' км';
    updateResult();
}

function updateResult() {
    if (state.distanceKm === null) return;
    const cons = parseFloat(els.fuelConsumption.value) || 8;
    const liters = (state.distanceKm * cons) / 100;
    els.fuelResult.textContent = liters.toFixed(1) + ' л';
}

async function geocode(lat, lon) {
    try {
        const result = await ymaps.geocode([lat, lon], { results: 1 });
        const first = result.geoObjects.get(0);
        if (first) {
            return first.properties.get('name') + ' ' + first.properties.get('description');
        }
    } catch (err) {
        console.warn('Geocode error:', err);
    }
    return lat.toFixed(4) + ', ' + lon.toFixed(4);
}

function addMarker(lat, lon, label, color) {
    const pm = new ymaps.Placemark([lat, lon], {
        hintContent: label === 'A' ? 'Точка А' : 'Точка Б',
        balloonContent: label === 'A' ? 'Начало' : 'Конец',
    }, {
        preset: 'islands#icon',
        iconColor: color,
        draggable: true,
    });
    state.map.geoObjects.add(pm);
    state.markers.push(pm);
}

function clearMarkers() {
    state.markers.forEach(m => state.map.geoObjects.remove(m));
    state.markers = [];
}

function clearRoute() {
    if (state.route) { state.map.geoObjects.remove(state.route); state.route = null; }
}

function resetAll() {
    clickCount = 0;
    state.pointA = null; state.pointB = null; state.distanceKm = null;
    clearMarkers(); clearRoute();
    els.pointA.textContent = '\u2014';
    els.pointB.textContent = '\u2014';
    els.distance.textContent = '\u2014';
    els.fuelResult.textContent = '\u2014';
}

function resetResults() {
    state.pointB = null; state.distanceKm = null;
    els.pointB.textContent = '\u2014';
    els.distance.textContent = '\u2014';
    els.fuelResult.textContent = '\u2014';
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
