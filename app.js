// Fuel Route Tracker - Yandex Maps API 3.0
const CONFIG = {
    apikey: '6b86b20b-ab60-428d-a9b0-6ca63263f4f0',
    geocodeKey: '2010aee2-6b9d-4ca4-8529-ce5b57bd2290',
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


async function init() {
    console.log('init() called, ymaps3:', typeof ymaps3);

    if (typeof ymaps3 === 'undefined' || window.__ymapsError) {
        document.getElementById('map').innerHTML =
            '<div class="map-error">' +
            '<h3>\u26d4 \u041d\u0435 \u0443\u0434\u0430\u043b\u043e\u0441\u044c \u0437\u0430\u0433\u0440\u0443\u0437\u0438\u0442\u044c \u043a\u0430\u0440\u0442\u0443</h3>' +
            '<p>\u041f\u0440\u043e\u0432\u0435\u0440\u044c\u0442\u0435 API-\u043a\u043b\u044e\u0447 \u0432 \u043a\u0430\u0431\u0438\u043d\u0435\u0442\u0435<br/><a href="https://developer.tech.yandex.ru/" target="_blank">developer.tech.yandex.ru</a></p>' +
            '<p class="map-error-hint">F12 \u2192 Console</p></div>';
        return;
    }

    try {
        const { YMap, YMapDefaultSchemeLayer, YMapDefaultFeaturesLayer, YMapMarker, YMapListener } =
            await ymaps3.import('@yandex/ymaps3-map');

        await ymaps3.import('@yandex/ymaps3-marker');
        const { YMapMultiRoute } = await ymaps3.import('@yandex/ymaps3-multi-route');

        window._YMapMarker = YMapMarker;
        console.log('Modules loaded:', { YMap, YMapMarker, YMapMultiRoute });

        const map = new YMap(
            document.getElementById('map'),
            { location: { center: CONFIG.center, zoom: CONFIG.zoom } },
            [ new YMapDefaultSchemeLayer(), new YMapDefaultFeaturesLayer() ]
        );
        state.map = map;

        const listener = new YMapListener({
            layer: 'any',
            onClick: (e) => {
                const coords = e.worldCoordinates;
                handleMapClick(coords[1], coords[0]);
            },
        });
        map.addChild(listener);

        els.fuelConsumption.addEventListener('input', updateFuelResult);
        els.resetBtn.addEventListener('click', resetRoute);

    } catch (err) {
        console.error('Init error:', err);
        document.getElementById('map').innerHTML =
            '<div class="map-error"><h3>\u26d4 \u041e\u0448\u0438\u0431\u043a\u0430</h3><p>' + err.message + '</p></div>';
    }
}

ymaps3.ready.then(init);


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
        const { YMapMultiRoute } = await ymaps3.import('@yandex/ymaps3-multi-route');

        const route = new YMapMultiRoute(
            {
                coordinates: [
                    [pointA.lon, pointA.lat],
                    [pointB.lon, pointB.lat],
                ],
                routingMode: 'driving',
            },
            {
                strokeWidth: 4,
                strokeColor: '#4fc3f7',
                opacity: 0.85,
                activeStrokeWidth: 6,
                viaPointVisible: false,
                boundsAutoApply: true,
            }
        );

        state.map.addChild(route);
        state.route = route;

        route.events.once('update', () => {
            const data = route.getRoute();
            if (data && data.properties) {
                const length = data.properties.distance || 0;
                state.distanceKm = Math.round(length / 10) / 100;
                els.distance.textContent = state.distanceKm.toFixed(1) + ' \u043a\u043c';
                updateFuelResult();
            }
        });

        setTimeout(() => {
            if (state.distanceKm === null) fallbackDist(pointA, pointB);
        }, 8000);

    } catch (err) {
        console.error('Route error:', err);
        fallbackDist(pointA, pointB);
    }
}

function fallbackDist(a, b) {
    const d = haversine(a.lat, a.lon, b.lat, b.lon);
    state.distanceKm = Math.round(d * 10) / 10;
    els.distance.textContent = '~' + state.distanceKm.toFixed(1) + ' \u043a\u043c (\u043f\u043e \u043f\u0440\u044f\u043c\u043e\u0439)';
    updateFuelResult();
}

function updateFuelResult() {
    if (state.distanceKm === null) return;
    const cons = parseFloat(els.fuelConsumption.value) || 8;
    const liters = (state.distanceKm * cons) / 100;
    els.fuelResult.textContent = liters.toFixed(1) + ' \u043b';
}

async function reverseGeocode(lat, lon) {
    const url =
        'https://geocode-maps.yandex.ru/1.x/' +
        '?format=json' +
        '&apikey=' + CONFIG.geocodeKey +
        '&geocode=' + lon + ',' + lat +
        '&kind=house' +
        '&results=1';

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        const geoObjects = data.response.GeoObjectCollection.featureMember;
        if (geoObjects && geoObjects.length > 0) {
            return geoObjects[0].GeoObject.metaDataProperty.GeocoderMetaData.text;
        }
    } catch (err) {
        console.warn('Geocode error:', err);
    }
    return lat.toFixed(4) + ', ' + lon.toFixed(4);
}

function addMarker(lat, lon, label, color) {
    const YMapMarker = window._YMapMarker;
    if (!YMapMarker) return;

    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.innerHTML = '<span class="marker-label">' + label + '</span>';
    el.style.setProperty('--marker-color', color);

    const marker = new YMapMarker({ coordinates: [lon, lat] }, el);
    state.map.addChild(marker);
    state.markers.push(marker);
}

function removeAllMarkers() {
    state.markers.forEach((m) => state.map.removeChild(m));
    state.markers = [];
}

function removeRoute() {
    if (state.route) {
        state.map.removeChild(state.route);
        state.route = null;
    }
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
    const parts = address.split(', ');
    if (parts.length >= 5) return parts.slice(0, 3).join(', ') + '\u2026';
    if (parts.length >= 3) return parts.slice(0, 2).join(', ');
    return address;
}

function haversine(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2)**2 + Math.cos(lat1*Math.PI/180) * Math.cos(lat2*Math.PI/180) * Math.sin(dLon/2)**2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
}
