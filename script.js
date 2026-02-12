// FULL CLEAN script.js — production ready
// Includes: ITM → WGS84 conversion, live GPS, compass arrows, storage, UI wiring

// =============================
// GLOBAL STATE
// =============================
let savedPoints = [];
let userLocation = null;
let deviceHeading = null;
let lastConversion = null;
let locationWatchId = null;

// =============================
// DOM ELEMENTS
// =============================
const eastingInput = document.getElementById('easting');
const northingInput = document.getElementById('northing');
const convertBtn = document.getElementById('convert-btn');
const addPointBtn = document.getElementById('add-point-btn');
const savePointBtn = document.getElementById('save-point-btn');

const latResult = document.getElementById('latitude-result');
const lonResult = document.getElementById('longitude-result');

const myPointsContainer = document.getElementById('my-points-container');
const myLatSpan = document.getElementById('my-lat');
const myLonSpan = document.getElementById('my-lon');

let modeToggleButton;
let modeDropdown;

// =============================
// ITM → WGS84 CONVERSION
// =============================
// Based on official Israeli Transverse Mercator parameters
function itmToWgs84(easting, northing) {
    const a = 6378137.0;
    const b = 6356752.3141;
    const f = (a - b) / a;
    const e = Math.sqrt(2 * f - f * f);

    const lat0 = 31.73439361111111 * Math.PI / 180;
    const lon0 = 35.20451694444444 * Math.PI / 180;

    const k0 = 1.0000067;
    const falseE = 219529.584;
    const falseN = 626907.39;

    const x = easting - falseE;
    const y = northing - falseN;

    const M = y / k0;
    const mu = M / (a * (1 - e * e / 4 - 3 * e ** 4 / 64 - 5 * e ** 6 / 256));

    const e1 = (1 - Math.sqrt(1 - e * e)) / (1 + Math.sqrt(1 - e * e));

    const J1 = 3 * e1 / 2 - 27 * e1 ** 3 / 32;
    const J2 = 21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32;
    const J3 = 151 * e1 ** 3 / 96;
    const J4 = 1097 * e1 ** 4 / 512;

    const fp = mu + J1 * Math.sin(2 * mu) + J2 * Math.sin(4 * mu)
        + J3 * Math.sin(6 * mu) + J4 * Math.sin(8 * mu);

    const C1 = e ** 2 * Math.cos(fp) ** 2 / (1 - e ** 2);
    const T1 = Math.tan(fp) ** 2;
    const R1 = a * (1 - e ** 2) / (1 - e ** 2 * Math.sin(fp) ** 2) ** 1.5;
    const N1 = a / Math.sqrt(1 - e ** 2 * Math.sin(fp) ** 2);

    const D = x / (N1 * k0);

    const Q1 = N1 * Math.tan(fp) / R1;
    const Q2 = D ** 2 / 2;
    const Q3 = (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e ** 2) * D ** 4 / 24;
    const Q4 = (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e ** 2 - 3 * C1 ** 2) * D ** 6 / 720;

    const lat = fp - Q1 * (Q2 - Q3 + Q4);

    const Q5 = D;
    const Q6 = (1 + 2 * T1 + C1) * D ** 3 / 6;
    const Q7 = (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e ** 2 + 24 * T1 ** 2) * D ** 5 / 120;

    const lon = lon0 + (Q5 - Q6 + Q7) / Math.cos(fp);

    return {
        latitude: lat * 180 / Math.PI,
        longitude: lon * 180 / Math.PI
    };
}

// =============================
// GEOLOCATION + COMPASS
// =============================
function startUserLocationTracking() {
    if (!navigator.geolocation) return;

    locationWatchId = navigator.geolocation.watchPosition(
        pos => {
            userLocation = {
                latitude: pos.coords.latitude,
                longitude: pos.coords.longitude
            };

            if (myLatSpan) myLatSpan.textContent = userLocation.latitude.toFixed(6);
            if (myLonSpan) myLonSpan.textContent = userLocation.longitude.toFixed(6);

            updateDistancesForSavedPoints();
            updateDirectionArrows();
        },
        err => console.warn('Geolocation error:', err.message),
        { enableHighAccuracy: true }
    );
}

function startDeviceOrientationTracking() {
    window.addEventListener('deviceorientation', e => {
        if (e.alpha == null) return;
        deviceHeading = e.alpha;
        updateDirectionArrows();
    });
}

// =============================
// MATH HELPERS
// =============================
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) *
        Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;

    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

// =============================
// STORAGE
// =============================
function saveToLocalStorage() {
    localStorage.setItem('itm_saved_points', JSON.stringify(savedPoints));
}

function loadFromLocalStorage() {
    const data = localStorage.getItem('itm_saved_points');
    if (!data) return;

    savedPoints = JSON.parse(data);
    renderSavedPoints();
}

// =============================
// UI RENDERING
// =============================
function renderSavedPoints() {
    if (!myPointsContainer) return;

    myPointsContainer.innerHTML = '';

    if (savedPoints.length === 0) {
        myPointsContainer.innerHTML = '<p>No points saved yet.</p>';
        return;
    }

    savedPoints.forEach((point, index) => {
        const div = document.createElement('div');
        div.className = 'point-card';

        let dist = 'N/A';
        if (userLocation) {
            const km = calculateDistance(
                userLocation.latitude,
                userLocation.longitude,
                point.latitude,
                point.longitude
            );
            dist = km < 1 ? `${(km * 1000).toFixed(0)} m` : `${km.toFixed(3)} km`;
        }

        div.innerHTML = `
            <div>
                <strong>${point.name}</strong>
                <button data-i="${index}" class="delete-btn">Delete</button>
            </div>
            <div>
                Dist: <strong data-point-index="${index}">${dist}</strong>
                <span class="direction-arrow" data-point-index="${index}">➔</span>
            </div>
        `;

        myPointsContainer.appendChild(div);
    });

    document.querySelectorAll('.delete-btn').forEach(btn => {
        btn.onclick = e => {
            savedPoints.splice(+e.target.dataset.i, 1);
            saveToLocalStorage();
            renderSavedPoints();
        };
    });
}

function updateDistancesForSavedPoints() {
    if (!userLocation) return;

    document.querySelectorAll('strong[data-point-index]').forEach(el => {
        const i = +el.dataset.pointIndex;
        const p = savedPoints[i];
        if (!p) return;

        const km = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            p.latitude,
            p.longitude
        );

        el.textContent = km < 1
            ? `${(km * 1000).toFixed(0)} m`
            : `${km.toFixed(3)} km`;
    });
}

function updateDirectionArrows() {
    if (!userLocation || deviceHeading == null) return;

    document.querySelectorAll('.direction-arrow').forEach(el => {
        const i = +el.dataset.pointIndex;
        const p = savedPoints[i];
        if (!p) return;

        const bearing = calculateBearing(
            userLocation.latitude,
            userLocation.longitude,
            p.latitude,
            p.longitude
        );

        const rot = (bearing - deviceHeading + 360) % 360;
        el.style.transform = `rotate(${rot}deg)`;
    });
}

// =============================
// CONVERSION HANDLERS
// =============================
function handleManualConvert() {
    const e = parseFloat(eastingInput?.value);
    const n = parseFloat(northingInput?.value);

    if (isNaN(e) || isNaN(n)) return;

    const result = itmToWgs84(e, n);

    if (latResult) latResult.textContent = result.latitude.toFixed(6);
    if (lonResult) lonResult.textContent = result.longitude.toFixed(6);

    lastConversion = {
        easting: e,
        northing: n,
        latitude: result.latitude,
        longitude: result.longitude
    };

    if (addPointBtn) addPointBtn.style.display = 'inline-block';
}

function handleAddPoint() {
    if (!lastConversion) return;

    const name = prompt('Point name:', 'Point');
    if (!name) return;

    savedPoints.push({ name, ...lastConversion });
    saveToLocalStorage();
    renderSavedPoints();
}

// =============================
// INITIALIZATION
// =============================
document.addEventListener('DOMContentLoaded', () => {
    loadFromLocalStorage();

    convertBtn?.addEventListener('click', handleManualConvert);
    addPointBtn?.addEventListener('click', handleAddPoint);
    savePointBtn?.addEventListener('click', handleAddPoint);

    modeToggleButton = document.getElementById('options-menu');
    modeDropdown = document.getElementById('mode-dropdown');

    modeToggleButton?.addEventListener('click', () =>
        modeDropdown?.classList.toggle('hidden')
    );

    startUserLocationTracking();
    startDeviceOrientationTracking();

    renderSavedPoints();
});
