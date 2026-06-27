// Fuel Route Tracker - 2GIS RasterJS API
const API_KEY = 'b33facdc-f20e-4837-867d-36ed05444897';

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
    console.log('2GIS loaded:', typeof DG);
    if (typeof DG === 'undefined') {
        document.getElementById('map').innerHTML =
            '<div style="display:flex;align-items:center;justify-content:center;height:100%;color:#e0e0e0;text-align:center;padding:20px;">' +
            '<div><h3 style="color:#ff7043;">Не удалось загрузить 2ГИС</h3><p>Проверьте консоль (F12).</p></div></div>';
        return;
    }

    const map = DG.map('map', {
        center: [55.751244, 37.618423],
        zoom: 12,
        key: API_KEY,
    });
    state.map = map;

    map.on('click', (e) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        handleClick(lat, lon);
    });

    els.fuelConsumption.addEventListener('input', updateResult);
    els.resetBtn.addEventListener('click', resetAll);
}

// Wait for DG to be ready
function waitForDG() {
    if (typeof DG !== 'undefined') {
        init();
    } else {
        setTimeout(waitForDG, 100);
    }
}
waitForDG();


async function handleClick(lat, lon) {
    const address = await reverseGeocode(lat, lon);
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

    const url = 'https://routing.api.2gis.com/get_directions/v1?key=' + API_KEY +
        '&origin=' + A.lat + ',' + A.lon +
        '&destination=' + B.lat + ',' + B.lon +
        '&result_format=json';

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Route response:', data);

        let distance = null;
        if (data && data.result && data.result.length > 0) {
            distance = data.result[0].routeGeometry.totalDistance;
        }

        if (distance) {
            state.distanceKm = Math.round(distance / 10) / 100;
            els.distance.textContent = state.distanceKm.toFixed(1) + ' км';
            updateResult();
        } else {
            throw new Error('No distance');
        }
    } catch (err) {
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


async function reverseGeocode(lat, lon) {
    const url =
        'https://catalog.api.2gis.com/2.0/geocode' +
        '?key=' + API_KEY +
        '&lat=' + lat +
        '&lon=' + lon +
        '&format=json';

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        console.log('Geocode response:', data);

        if (data && data.result && data.result.items && data.result.items.length > 0) {
            return data.result.items[0].full_name || data.result.items[0].name;
        }
    } catch (err) {
        console.warn('Geocode error:', err);
    }
    return lat.toFixed(4) + ', ' + lon.toFixed(4);
}

function addMarker(lat, lon, label, color) {
    const marker = DG.marker([lat, lon], {
        icon: {
            html: '<div class="custom-marker" style="--marker-color:' + color + '"><span class="marker-label">' + label + '</span></div>',
            iconSize: [36, 36],
            iconAnchor: [18, 18],
        }
    }).addTo(state.map);
    state.markers.push(marker);
}

function clearMarkers() {
    state.markers.forEach(m => state.map.removeLayer(m));
    state.markers = [];
}

function clearRoute() {
    if (state.route) { state.map.removeLayer(state.route); state.route = null; }
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
