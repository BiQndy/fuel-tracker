// ============================================================
// Fuel Route Tracker — логика приложения
// Использует Яндекс.Карты API 3.0
// ============================================================

const CONFIG = {
    // Ключ API Яндекс.Карт
    apikey: '6b86b20b-ab60-428d-a9b0-6ca63263f4f0',
    // Начальный центр карты (Москва)
    center: [55.751244, 37.618423],
    zoom: 12,
    // Цвета маркеров
    markerColors: {
        A: '#4fc3f7',
        B: '#ff7043',
    },
};

// ---- DOM элементы ----
const els = {
    pointA: document.getElementById('pointA'),
    pointB: document.getElementById('pointB'),
    distance: document.getElementById('distance'),
    fuelConsumption: document.getElementById('fuelConsumption'),
    fuelResult: document.getElementById('fuelResult'),
    resetBtn: document.getElementById('resetBtn'),
};

// ---- Состояние приложения ----
const state = {
    pointA: null, // { lat, lon, address }
    pointB: null, // { lat, lon, address }
    markers: [], // ymaps3 маркеры
    route: null, // ymaps3 MultiRoute
    distanceKm: null,
};

// ------------------------------------------------------------
// Инициализация
// ------------------------------------------------------------

async function init() {
    // Проверка, загрузился ли API Яндекс.Карт
    if (window.__ymapsError || typeof ymaps3 === 'undefined') {
        document.getElementById('map').innerHTML = '<div class="map-error">' +
            '<h3>⛔ Не удалось загрузить карту</h3>' +
            '<p>API-ключ Яндекс.Карт недействителен или неверно настроен.</p>' +
            '<p class="map-error-hint">Подробнее — в консоли браузера (F12 → Console).</p>' +
            '</div>';
        console.error('❌ Fuel Tracker: Яндекс.Карты API не загрузился. Проверьте API-ключ.');
        return;
    }

    await ymaps3.ready;

    const {
        YMap,
        YMapDefaultSchemeLayer,
        YMapDefaultFeaturesLayer,
        YMapMarker,
        YMapListener,
    } = await ymaps3.import('@yandex/ymaps3-map');
    await ymaps3.import('@yandex/ymaps3-marker');
    const { YMapMultiRoute } = await ymaps3.import('@yandex/ymaps3-multi-route');

    // Сохраняем конструкторы глобально
    window._YMap = YMap;
    window._YMapMarker = YMapMarker;
    window._YMapMultiRoute = YMapMultiRoute;

    // Создаём карту
    const map = new YMap(
        document.getElementById('map'),
        {
            location: {
                center: CONFIG.center,
                zoom: CONFIG.zoom,
            },
        },
        [
            new YMapDefaultSchemeLayer(),
            new YMapDefaultFeaturesLayer(),
        ]
    );

    window._map = map;

    // Слушаем клики по карте
    const listener = new YMapListener({
        layer: 'any',
        onClick: (obj, event) => handleMapClick(event),
    });
    map.addChild(listener);

    // Событие изменения расхода топлива
    els.fuelConsumption.addEventListener('input', updateFuelResult);

    // Кнопка сброса
    els.resetBtn.addEventListener('click', resetRoute);
}

// ------------------------------------------------------------
// Обработка клика по карте
// ------------------------------------------------------------

let clickCount = 0;

async function handleMapClick(event) {
    const coords = event.worldCoordinates; // [lon, lat]
    const lat = coords[1];
    const lon = coords[0];

    // Определяем адрес через геокодер
    const address = await reverseGeocode(lat, lon);

    if (clickCount === 0) {
        // Точка А
        state.pointA = { lat, lon, address };
        els.pointA.textContent = truncateAddress(address);
        clickCount = 1;
        removeAllMarkers();
        removeRoute();
        addMarker(lat, lon, 'A', CONFIG.markerColors.A);
        clearResults();
    } else if (clickCount === 1) {
        // Точка Б
        state.pointB = { lat, lon, address };
        els.pointB.textContent = truncateAddress(address);
        clickCount = 0;
        addMarker(lat, lon, 'B', CONFIG.markerColors.B);
        buildRoute(state.pointA, state.pointB);
    }
}

// ------------------------------------------------------------
// Построение маршрута
// ------------------------------------------------------------

async function buildRoute(pointA, pointB) {
    const YMapMultiRoute = window._YMapMultiRoute;
    const map = window._map;

    removeRoute();

    try {
        const route = new YMapMultiRoute(
            {
                coordinates: [
                    [pointA.lon, pointA.lat],
                    [pointB.lon, pointB.lat],
                ],
                routingMode: 'driving',
            },
            {
                // Настройки отображения
                strokeWidth: 4,
                strokeColor: '#4fc3f7',
                opacity: 0.85,
                activeStrokeWidth: 6,
                viaPointVisible: false,
                boundsAutoApply: true,
            }
        );

        map.addChild(route);
        state.route = route;

        // Ждём, пока маршрут построится, и получаем расстояние
        route.events.once('update', () => {
            const data = route.getRoute();
            if (data && data.properties) {
                // Длина маршрута в метрах
                const length = data.properties.distance || 0;
                state.distanceKm = Math.round(length / 10) / 100;
                els.distance.textContent = `${state.distanceKm.toFixed(1)} км`;
                updateFuelResult();
            }
        });

        // Таймаут на случай ошибки
        setTimeout(() => {
            if (state.distanceKm === null) {
                // Если не получили данные, пробуем прямой расчёт по прямой
                const d = haversineDistance(
                    pointA.lat, pointA.lon,
                    pointB.lat, pointB.lon
                );
                state.distanceKm = Math.round(d * 10) / 10;
                els.distance.textContent = `~${state.distanceKm.toFixed(1)} км (по прямой)`;
                updateFuelResult();
            }
        }, 5000);

    } catch (err) {
        console.error('Ошибка построения маршрута:', err);
        // Fallback — расстояние по прямой
        const d = haversineDistance(
            pointA.lat, pointA.lon,
            pointB.lat, pointB.lon
        );
        state.distanceKm = Math.round(d * 10) / 10;
        els.distance.textContent = `~${state.distanceKm.toFixed(1)} км (по прямой)`;
        updateFuelResult();
    }
}

// ------------------------------------------------------------
// Расчёт расхода топлива
// ------------------------------------------------------------

function updateFuelResult() {
    if (state.distanceKm === null) return;

    const consumption = parseFloat(els.fuelConsumption.value) || 8;
    const liters = (state.distanceKm * consumption) / 100;

    els.fuelResult.textContent = `${liters.toFixed(1)} л`;
}

// ------------------------------------------------------------
// Геокодер (обратное геокодирование)
// ------------------------------------------------------------

async function reverseGeocode(lat, lon) {
    const url =
        `https://geocode-maps.yandex.ru/1.x/` +
        `?format=json` +
        `&apikey=${CONFIG.apikey}` +
        `&geocode=${lon},${lat}` +
        `&kind=house` +
        `&results=1`;

    try {
        const resp = await fetch(url);
        const data = await resp.json();
        const geoObjects = data.response.GeoObjectCollection.featureMember;
        if (geoObjects && geoObjects.length > 0) {
            return geoObjects[0].GeoObject.metaDataProperty.GeocoderMetaData.text;
        }
    } catch (err) {
        console.warn('Ошибка геокодирования:', err);
    }
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
}

// ------------------------------------------------------------
// Работа с маркерами
// ------------------------------------------------------------

function addMarker(lat, lon, label, color) {
    const YMapMarker = window._YMapMarker;
    const map = window._map;

    // Создаём HTML-элемент маркера
    const el = document.createElement('div');
    el.className = 'custom-marker';
    el.innerHTML = `<span class="marker-label">${label}</span>`;
    el.style.setProperty('--marker-color', color);

    const marker = new YMapMarker(
        { coordinates: [lon, lat] },
        el
    );

    map.addChild(marker);
    state.markers.push(marker);
}

function removeAllMarkers() {
    const map = window._map;
    state.markers.forEach((m) => map.removeChild(m));
    state.markers = [];
}

function removeRoute() {
    const map = window._map;
    if (state.route) {
        map.removeChild(state.route);
        state.route = null;
    }
}

// ------------------------------------------------------------
// Сброс маршрута
// ------------------------------------------------------------

function resetRoute() {
    clickCount = 0;
    state.pointA = null;
    state.pointB = null;
    state.distanceKm = null;

    removeAllMarkers();
    removeRoute();

    els.pointA.textContent = '—';
    els.pointB.textContent = '—';
    els.distance.textContent = '—';
    els.fuelResult.textContent = '—';
}

function clearResults() {
    state.pointB = null;
    state.distanceKm = null;
    els.pointB.textContent = '—';
    els.distance.textContent = '—';
    els.fuelResult.textContent = '—';
}

// ------------------------------------------------------------
// Вспомогательные функции
// ------------------------------------------------------------

function truncateAddress(address) {
    if (!address) return '—';
    // Укорачиваем: оставляем город и улицу/дом
    const parts = address.split(', ');
    if (parts.length >= 5) {
        // Полный адрес → первые 3 части
        return parts.slice(0, 3).join(', ') + '…';
    }
    if (parts.length >= 3) {
        return parts.slice(0, 2).join(', ');
    }
    return address;
}

function haversineDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // км
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) ** 2;
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ------------------------------------------------------------
// Старт
// ------------------------------------------------------------

init();