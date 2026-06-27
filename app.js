// ============================================================
// Fuel Route Tracker — logic for Yandex Maps API 2.1
// ============================================================

const CONFIG = {
    apikey: '6b86b20b-ab60-428d-a9b0-6ca63263f4f0',
    center: [55.751244, 37.618423],
    zoom: 12,
    markerColors: { A: '#4fc3f7', B: '#ff7043' },
};

const els = {
    pointA: document.getElementById('pointA'),
    pointB: document.getElementById('pointB'),
    distance: document.getElementById('distance'),
    fuelConsumption: document.getElementById('fuelConsumption'),
    fuelResult: document.getElementById('fuelResult'),
    resetBtn: document.getElementById('resetBtn'),
};

const state = {
    pointA: null, pointB: null,
    markers: [], route: null,
    distanceKm: null, map: null,
};

let clickCount = 0;

ymaps.ready(init);

function init() {
    if (typeof ymaps === 'undefined' || window.__ymapsError) {
        showMapError();
        return;
    }

    const map = new ymaps.Map('map', {
        center: CONFIG.center,
        zoom: CONFIG.zoom,
        controls: ['zoomControl'],
    });
    state.map = map;

    map.events.add('click', function (e) {
        const coords = e.get('coords');
        handleMapClick(coords[0], coords[1]);
    });

    els.fuelConsumption.addEventListener('input', updateFuelResult);
    els.resetBtn.addEventListener('click', resetRoute);
}

function showMapError() {
    document.getElementById('map').innerHTML =
        '<div class="map-error">' +
        '<h3>\u26d4 \u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443</h3>' +
        '<p>API-\u043a\u043b\u044e\u0447 \u043d\u0435\u0434\u0435\u0439\u0441\u0442\u0432\u0438\u0442\u0435\u043b\u0435\u043d.</p>' +
        '<p class="map-error-hint">F12 \u2192 Console</p></div>';
    console.error('Yandex.Maps API failed to load');
}

async function handleMapClick(lat, lon) {
    const address = await reverseGeocode(lat, lon);
    if (clickCount === 0) {
        state.pointA = { lat, lon, address };
        els.pointA.textContent = truncateAddress(address);
        clickCount = 1;
        removeAllMarkers();
        removeRoute();
        addMarker(lat, lon, 'A', CONFIG.markerColors.A);
        clearResults();
    } else {
        state.pointB = { lat, lon, address };
        els.pointB.textContent = truncateAddress(address);
        clickCount = 0;
        addMarker(lat, lon, 'B', CONFIG.markerColors.B);
        buildRoute(state.pointA, state.pointB);
    }
}

async function buildRoute(pointA, pointB) {
    removeRoute();
    try {
        var route = new ymaps.multiRoute.MultiRoute({
            referencePoints: [
                [pointA.lat, pointA.lon],
                [pointB.lat, pointB.lon],
            ],
            params: { routingMode: 'auto' },
        }, {
            boundsAutoApply: true,
            strokeWidth: 4,
            strokeColor: '#4fc3f7',
            opacity: 0.85,
            routeStrokeWidth: 6,
        });

        state.map.geoObjects.add(route);
        state.route = route;

        route.model.events.add('requestsuccess', function () {
            var active = route.getActiveRoute();
            if (active) {
                var dist = active.properties.get('distance');
                if (dist && dist.value) {
                    state.distanceKm = Math.round(dist.value / 10) / 100;
                    els.distance.textContent = state.distanceKm.toFixed(1) + ' \u043a\u043c';
                    updateFuelResult();
                }
            }
        });

        route.model.events.add('requestfail', function () {
            fallbackDist(pointA, pointB);
        });

        setTimeout(function () {
            if (state.distanceKm === null) fallbackDist(pointA, pointB);
        }, 8000);

    } catch (err) {
        console.error('Route error:', err);
        fallbackDist(pointA, pointB);
    }
}

function fallbackDist(a, b) {
    var d = haversineDistance(a.lat, a.lon, b.lat, b.lon);
    state.distanceKm = Math.round(d * 10) / 10;
    els.distance.textContent = '~' + state.distanceKm.toFixed(1) + ' \u043a\u043c (\u043f\u043e \u043f\u0440\u044f\u043c\u043e\u0439)';
    updateFuelResult();
}

function updateFuelResult() {
    if (state.distanceKm === null) return;
    var cons = parseFloat(els.fuelConsumption.value) || 8;
    var liters = (state.distanceKm * cons) / 100;
    els.fuelResult.textContent = liters.toFixed(1) + ' \u043b';
}

async function reverseGeocode(lat, lon) {
    try {
        var res = await ymaps.geocode([lat, lon], { results: 1, kind: 'house' });
        var first = res.geoObjects.get(0);
        if (first) {
            return first.properties.get('name') + ', ' + first.properties.get('description');
        }
    } catch (e) { console.warn('Geocode error:', e); }
    return lat.toFixed(4) + ', ' + lon.toFixed(4);
}

function addMarker(lat, lon, label, color) {
    var pm = new ymaps.Placemark([lat, lon], {
        iconContent: label,
    }, {
        preset: 'islands#circleIcon',
        iconColor: color,
        draggable: true,
    });

    pm.events.add('dragend', function () {
        var c = pm.geometry.getCoordinates();
        if (label === 'A' && state.pointA) {
            state.pointA.lat = c[0]; state.pointA.lon = c[1];
            reverseGeocode(c[0], c[1]).then(function (addr) {
                state.pointA.address = addr;
                els.pointA.textContent = truncateAddress(addr);
                if (state.pointB) buildRoute(state.pointA, state.pointB);
            });
        } else if (label === 'B' && state.pointB) {
            state.pointB.lat = c[0]; state.pointB.lon = c[1];
            reverseGeocode(c[0], c[1]).then(function (addr) {
                state.pointB.address = addr;
                els.pointB.textContent = truncateAddress(addr);
                if (state.pointA) buildRoute(state.pointA, state.pointB);
            });
        }
    });

    state.map.geoObjects.add(pm);
    state.markers.push(pm);
}

function removeAllMarkers() {
    state.markers.forEach(function (m) { state.map.geoObjects.remove(m); });
    state.markers = [];
}

function removeRoute() {
    if (state.route) { state.map.geoObjects.remove(state.route); state.route = null; }
}

function resetRoute() {
    clickCount = 0;
    state.pointA = null; state.pointB = null; state.distanceKm = null;
    removeAllMarkers(); removeRoute();
    els.pointA.textContent = '\u2014';
    els.pointB.textContent = '\u2014';
    els.distance.textContent = '\u2014';
    els.fuelResult.textContent = '\u2014';
}

function clearResults() {
    state.pointB = null; state.distanceKm = null;
    els.pointB.textContent = '\u2014';
    els.distance.textContent = '\u2014';
    els.fuelResult.textContent = '\u2014';
}

function truncateAddress(address) {
    if (!address) return '\u2014';
    var parts = address.split(', ');
    if (parts.length >= 5) return parts.slice(0, 3).join(', ') + '\u2026';
    if (parts.length >= 3) return parts.slice(0, 2).join(', ');
    return address;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    var R = 6371;
    var dLat = (lat2 - lat1) * Math.PI / 180;
    var dLon = (lon2 - lon1) * Math.PI / 180;
    var a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
