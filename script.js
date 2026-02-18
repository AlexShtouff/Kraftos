// --- DOM Elements ---
const eastingInput = document.getElementById('easting');
const northingInput = document.getElementById('northing');
const convertBtn = document.getElementById('convert-btn');
const latResult = document.getElementById('latitude-result');   // ✔ THIS EXISTS
const lonResult = document.getElementById('longitude-result');  // ✔ THIS EXISTS
const latResultBox = document.getElementById('lat-result-box');
const lonResultBox = document.getElementById('lon-result-box');
const errorMessage = document.getElementById('error-message');
const manualActionsContainer = document.getElementById('manual-actions-container');
const csvUploadInput = document.getElementById('csv-upload');
const processCsvBtn = document.getElementById('process-csv-btn');
const csvResultsSection = document.getElementById('csv-results-section');
const csvResultsBody = document.getElementById('csv-results-body');
const csvErrorMessage = document.getElementById('csv-error-message');
const csvColumnSelection = document.getElementById('csv-column-selection');
const pointNameColumnSelect = document.getElementById('point-name-column');
const eastingColumnSelect = document.getElementById('easting-column');
const northingColumnSelect = document.getElementById('northing-column');
const myPointsSection = document.getElementById('my-points-section');
const myPointsContainer = document.getElementById('my-points-container');
const myPointsBtn = document.getElementById('my-points-btn');
// Use the correct ID from HTML
const savePointBtn = document.getElementById('save-point-btn');
const myLatSpan = document.getElementById('my-lat');
const myLonSpan = document.getElementById('my-lon');

let csvFileContent = null;

const addPointBtn = document.getElementById('add-point-btn');
let lastConversion = null;

let modeToggleButton;
let modeDropdown;
const menuManualInput = document.getElementById('menu-manual-input');
const menuCsvUpload = document.getElementById('menu-csv-upload');

const manualInputInterface = document.getElementById('manual-input-interface');
const csvUploadInterface = document.getElementById('csv-upload-interface');
// NEW VARIABLES
const pahitHeightInput = document.getElementById('pahit-height');
const antHeight1Input = document.getElementById('ant-height-1');
const antHeight2Input = document.getElementById('ant-height-2');
const calcHeightBtn = document.getElementById('calc-height-btn');
const heightError = document.getElementById('height-error');
const heightResults = document.getElementById('height-results');

const resVA = document.getElementById('res-va');
const resVP = document.getElementById('res-vp');
const resDiff = document.getElementById('res-diff');
const resAvg = document.getElementById('res-avg');
const diffBox = document.getElementById('diff-box');

// --- Global Variables ---
let currentMode = 'manual';
let userLocation = null;
let savedPoints = [];
let csvData = [];
let csvHeaders = [];

// Define ITM projection (Israel Transverse Mercator - IG05/IG12)
// Defined for proj4js
const ITM_PROJ_DEF = '+proj=tmerc +lat_0=31.73439388888889 +lon_0=35.20451694444445 +k=1.0000067 +x_0=219521.4 +y_0=626907.39 +ellps=GRS80 +towgs84=-48,55,52,0,0,0,0 +units=m +no_defs';

// --- Helper Functions ---
/**
 * Converts ITM coordinates (Easting, Northing) to WGS84 (Latitude, Longitude).
 */
function convertItmToWgs84(easting, northing) {
    // --- GRS80 Ellipsoid Parameters ---
	const a = 6378137; // Semi-major axis
	const f = 1 / 298.257222101; // Inverse flattening
	const e_sq = 2 * f - f ** 2; // Eccentricity squared
	const e_prime_sq = e_sq / (1 - e_sq);
	// --- ITM Projection Parameters ---
	const lat0_rad = 31.7343936111111 * Math.PI / 180;
	const lon0_rad = 35.2045169444444 * Math.PI / 180;
	const k0 = 1.0000067;
	const false_easting = 219529.584;
	const false_northing = 626907.39;
	const M0_coeff0 = 1 - e_sq / 4 - 3 * e_sq ** 2 / 64 - 5 * e_sq ** 3 / 256;
	const M0_coeff2 = 3 * e_sq / 8 + 3 * e_sq ** 2 / 32 + 45 * e_sq ** 3 / 1024;
	const M0_coeff4 = 15 * e_sq ** 2 / 256 + 45 * e_sq ** 3 / 1024;
	const M0_coeff6 = 35 * e_sq ** 3 / 3072;

	const M0 = a * (M0_coeff0 * lat0_rad - M0_coeff2 * Math.sin(2 * lat0_rad) + M0_coeff4 * Math.sin(4 * lat0_rad) - M0_coeff6 * Math.sin(6 * lat0_rad));

 	const M = M0 + (northing - false_northing) / k0;
	const mu = M / (a * M0_coeff0);
	const e1 = (1 - Math.sqrt(1 - e_sq)) / (1 + Math.sqrt(1 - e_sq));

    const phi1_coeff2 = 3 * e1 / 2 - 27 * e1 ** 3 / 32;
    const phi1_coeff4 = 21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32;
    const phi1_coeff6 = 151 * e1 ** 3 / 96;
    const phi1_coeff8 = 1097 * e1 ** 4 / 512;

    const phi1 = mu + phi1_coeff2 * Math.sin(2 * mu) + phi1_coeff4 * Math.sin(4 * mu) + phi1_coeff6 * Math.sin(6 * mu) + phi1_coeff8 * Math.sin(8 * mu);

    const C1 = e_prime_sq * Math.cos(phi1) ** 2;
    const T1 = Math.tan(phi1) ** 2;
	const N1 = a / Math.sqrt(1 - e_sq * Math.sin(phi1) ** 2);
	const R1 = a * (1 - e_sq) / Math.pow(1 - e_sq * Math.sin(phi1) ** 2, 1.5);
    const D = (easting - false_easting) / (N1 * k0);

    const lat_rad_grs80 = phi1 - (N1 * Math.tan(phi1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * C1 ** 2 - 9 * e_prime_sq) * D ** 4 / 24 + (61 + 90 * T1 + 298 * C1 + 45 * T1 ** 2 - 252 * e_prime_sq - 3 * C1 ** 2) * D ** 6 / 720);
    const lon_rad_grs80 = lon0_rad + (D - (1 + 2 * T1 + C1) * D ** 3 / 6 + (5 - 2 * C1 + 28 * T1 - 3 * C1 ** 2 + 8 * e_prime_sq + 24 * T1 ** 2) * D ** 5 / 120) / Math.cos(phi1);

    const h_grs80 = 0;
    const sinLat_grs80 = Math.sin(lat_rad_grs80);
    const cosLat_grs80 = Math.cos(lat_rad_grs80);
    const sinLon_grs80 = Math.sin(lon_rad_grs80);
    const cosLon_grs80 = Math.cos(lon_rad_grs80);
    const N_grs80 = a / Math.sqrt(1 - e_sq * sinLat_grs80 ** 2);
    const X_grs80 = (N_grs80 + h_grs80) * cosLat_grs80 * cosLon_grs80;
    const Y_grs80 = (N_grs80 + h_grs80) * cosLat_grs80 * sinLon_grs80;
    const Z_grs80 = (N_grs80 * (1 - e_sq) + h_grs80) * sinLat_grs80;

 	const dX = -24.0024, dY = -17.1032, dZ = -17.8444;
	const rX_arcsec = -0.33077, rY_arcsec = -1.85269, rZ_arcsec = 1.66969;
	const s_ppm = 5.4262;

	const toRadians = Math.PI / (180 * 3600);
	const rX = rX_arcsec * toRadians, rY = rY_arcsec * toRadians, rZ = rZ_arcsec * toRadians;
	const s_factor = s_ppm * 1e-6;

	const X_wgs84 = dX + (1 + s_factor) * X_grs80 - rZ * Y_grs80 + rY * Z_grs80;
	const Y_wgs84 = dY + rZ * X_grs80 + (1 + s_factor) * Y_grs80 - rX * Z_grs80;
	const Z_wgs84 = dZ - rY * X_grs80 + rX * Y_grs80 + (1 + s_factor) * Z_grs80;

	const a_wgs84 = 6378137, f_wgs84 = 1 / 298.257223563;
	const e_sq_wgs84 = 2 * f_wgs84 - f_wgs84 ** 2;
	const p = Math.sqrt(X_wgs84 ** 2 + Y_wgs84 ** 2);
	let lon_rad_wgs84 = Math.atan2(Y_wgs84, X_wgs84);
	let lat_rad_wgs84 = Math.atan2(Z_wgs84, p * (1 - e_sq_wgs84));

	for (let i = 0; i < 10; i++) {
		const lat_prev = lat_rad_wgs84;
		const N_wgs84 = a_wgs84 / Math.sqrt(1 - e_sq_wgs84 * Math.sin(lat_prev) ** 2);
		lat_rad_wgs84 = Math.atan2(Z_wgs84 + e_sq_wgs84 * N_wgs84 * Math.sin(lat_prev), p);
		if (Math.abs(lat_rad_wgs84 - lat_prev) < 1e-12) break;
	}

    return {
        latitude: lat_rad_wgs84 * 180 / Math.PI,
        longitude: lon_rad_wgs84 * 180 / Math.PI,
    };
}

function calculateMagneticDeclination(lat, lon) {
    // В Израиле склонение положительное (East)
    // Сейчас оно составляет примерно 5.2 - 5.5 градусов.
    return 5.3; 
}
/**
 * Calculates the distance between two lat/lon points in kilometers using the Haversine formula.
 */
function calculateDistance(lat1, lon1, lat2, lon2) {
    const R = 6371; // Radius of the Earth in km
	const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
	
	const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // Distance in km
}

// --- Event Listener for the single convert button ---


function getCsvHeaders(csvText) {
    if (!csvText) return null;
    const firstLine = csvText.split('\n')[0].trim();
    return firstLine.replace(/^\uFEFF/, '').split(',').map(header => header.trim());
}

function populateColumnSelectors(headers) {
    pointNameColumnSelect.innerHTML = '';
    eastingColumnSelect.innerHTML = '';
							  
    northingColumnSelect.innerHTML = '';

    const defaultOption = document.createElement('option');
    defaultOption.value = '';
    defaultOption.textContent = 'Choose a column...';
    defaultOption.disabled = true;
    defaultOption.selected = true;

    pointNameColumnSelect.appendChild(defaultOption.cloneNode(true));
    eastingColumnSelect.appendChild(defaultOption.cloneNode(true));
    northingColumnSelect.appendChild(defaultOption.cloneNode(true));
				  

    headers.forEach(header => {
        const option = document.createElement('option');
        option.value = header;
        option.textContent = header;
        pointNameColumnSelect.appendChild(option.cloneNode(true));
        eastingColumnSelect.appendChild(option.cloneNode(true));
        northingColumnSelect.appendChild(option);	
	});
}

// --- UI/Mode Management ---

function showInterface(mode) {
    currentMode = mode;
    document.querySelectorAll('.interface-section').forEach(container => {
        container.classList.add('hidden');
    });

    // Hide all error messages initially
    errorMessage.classList.add('hidden');
    csvErrorMessage.classList.add('hidden');

    // Reset height calculator results/errors
    heightResults.classList.add('hidden');
    diffBox.classList.remove('bg-red-100');
    heightError.textContent = '';

    let title = '';

    switch (mode) {
        case 'manual':
            document.getElementById('manual-input-interface').classList.remove('hidden');
            title = 'Manual Input';
            break;
        case 'csv':
            document.getElementById('csv-upload-interface').classList.remove('hidden');
            title = 'CSV Upload';
            break;
        case 'static':
            document.getElementById('static-data-interface').classList.remove('hidden');
            title = 'Vertical Distance Calculator';
            break;
    }

    // Update dropdown button text
    const modeBtn = document.getElementById('options-menu');
    if (modeBtn) {
        // Keep the icon
        const icon = modeBtn.querySelector('svg');
        modeBtn.childNodes[0].textContent = title + ' ';
        if (icon) modeBtn.appendChild(icon);
    }
    document.getElementById('mode-dropdown')?.classList.add('hidden');
}

function renderManualResults(result) {
    const lat = result.latitude.toFixed(6);
    const lon = result.longitude.toFixed(6);

    // UPDATE CORRECT ELEMENTS
    latResult.textContent = lat;
    lonResult.textContent = lon;

    // SAFETY – only if boxes exist
    latResultBox?.classList.add('success');
    lonResultBox?.classList.add('success');

    const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    const wazeUrl = `https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`;

    manualActionsContainer.innerHTML = `
        <a href="${googleMapsUrl}" target="_blank" class="map-button">Google Maps</a>
        <a href="${wazeUrl}" target="_blank" class="map-button">Waze</a>
    `;
    manualActionsContainer.style.display = 'flex';

    addPointBtn.style.display = 'inline-block';
}

let deviceHeading = 0;

function updateArrowsRotation() {
    const declination = userLocation ? calculateMagneticDeclination(userLocation.latitude, userLocation.longitude) : 5.3;
    const arrows = document.querySelectorAll('.direction-arrow');

    arrows.forEach(arrow => {
        const bearing = parseFloat(arrow.dataset.bearing); // Берем азимут, сохраненный в шаблоне
        if (isNaN(bearing)) return;

        // Итоговый угол поворота
        // 360 добавляем, чтобы не было отрицательных чисел
        let finalRotation = (bearing - (deviceHeading + declination) + 360) % 360;

        // Плавное вращение через CSS
        arrow.style.transform = `rotate(${finalRotation}deg)`;
    });
}

function startCompass() {
    // Для iOS (требуется разрешение)
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        DeviceOrientationEvent.requestPermission()
            .then(state => {
                if (state === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            });
    } else {
        // Для Android и других
        window.addEventListener('deviceorientationabsolute', handleOrientation, true);
    }
}

function handleOrientation(event) {
    // Пытаемся получить истинный или магнитный курс
    let heading = event.webkitCompassHeading || event.alpha;
    
    if (typeof heading !== 'undefined') {
        // Если это Android (alpha), он считает против часовой стрелки, нужно инвертировать
        if (!event.webkitCompassHeading) {
            heading = 360 - heading;
        }
        deviceHeading = heading;
        updateArrowsRotation(); // Вызываем обновление стрелок
    }
}

function getSavedPoints() {
  return JSON.parse(localStorage.getItem('myPoints') || '[]');
}


function loadFromLocalStorage() {
    const stored = localStorage.getItem('itm_converter_points');
    if (stored) {
        savedPoints = JSON.parse(stored);
        renderSavedPoints(); 
    }
}

function renderSavedPoints() {
    myPointsContainer.innerHTML = '';
    const template = document.getElementById('point-card-template');

    if (savedPoints.length === 0) {
        myPointsContainer.innerHTML = '<p class="text-gray-500 text-center">No points saved yet.</p>';
        return;
    }

    savedPoints.forEach((point, index) => {
        const clone = template.content.cloneNode(true);

        // --- Заполняем текстовые поля ---
        clone.querySelector('.point-name').textContent = point.name || `Point ${index + 1}`;
        clone.querySelector('.point-date').textContent = `Saved: ${point.timestamp}`;
        
        // Координаты (форматируем до 6 знаков, как принято в GPS)
        clone.querySelector('.point-lat').textContent = Number(point.latitude).toFixed(6);
        clone.querySelector('.point-lon').textContent = Number(point.longitude).toFixed(6);
		
		// Настраиваем ссылки навигации
		clone.querySelector('.waze-link').href = `https://www.waze.com/ul?ll=${point.latitude},${point.longitude}&navigate=yes`;
		clone.querySelector('.maps-link').href = `https://www.google.com/maps/search/?api=1&query=${point.latitude},${point.longitude}`;
		
        // --- Логика удаления ---
        const deleteBtn = clone.querySelector('.delete-point-btn');
        deleteBtn.onclick = () => {
            savedPoints.splice(index, 1);
            saveToLocalStorage();
            renderSavedPoints();
        };
		
	    // --- Логика расстояния и стрелки ---
        if (userLocation) {
            const dist = calculateDistance(
                userLocation.latitude, userLocation.longitude,
                point.latitude, point.longitude
            );
            clone.querySelector('.point-distance').textContent = dist.toFixed(1);

            // Азимут (Bearings)
            const bearing = calculateBearing(
                userLocation.latitude, userLocation.longitude,
                point.latitude, point.longitude
            );
            
            // Здесь мы будем вращать стрелку 
            const arrow = clone.querySelector('.direction-arrow');
            arrow.dataset.bearing = bearing; // Сохраняем азимут в атрибут для анимации
        }

        myPointsContainer.appendChild(clone);
    });
}


// --- Event Handlers ---

function handleManualConvert() {
    errorMessage.classList.add('hidden');

    const easting = parseFloat(eastingInput.value);
    const northing = parseFloat(northingInput.value);

    if (isNaN(easting) || isNaN(northing) || easting <= 0 || northing <= 0) {
        errorMessage.textContent = 'Please enter valid, positive ITM Easting and Northing values.';
        errorMessage.classList.remove('hidden');
        renderManualResults(null);
        return;
    }

    const wgs84 = convertItmToWgs84(easting, northing);
    renderManualResults(wgs84);
	
	
	lastConversion = {
		easting,
		northing,
		latitude: wgs84.latitude,
		longitude: wgs84.longitude
	};
	addPointBtn.style.display = 'inline-block';

    if (!wgs84) {
        errorMessage.textContent = 'Conversion failed. Check input values and projection definition.';
        errorMessage.classList.remove('hidden');
    }
}

function appendToMyPoints(pointName, easting, northing, latitude, longitude) {
    const lat = latitude.toFixed(6);
    const lon = longitude.toFixed(6);

    let distanceText = 'Distance unavailable';
    if (userLocation) {
        const dist = calculateDistance(userLocation.latitude, userLocation.longitude, latitude, longitude);
        distanceText = `Distance from my location: <strong>${dist.toFixed(2)} km</strong>`;
    }

    const gmapUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    const wazeUrl = `https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`;

    const pointCardHTML = `
        <div class="point-card">
            <div class="point-header">
                <h3 class="point-name">${pointName}</h3>
            </div>
            <div class="point-body">
                <div class="point-detail"><span>Easting</span> ${easting}</div>
                <div class="point-detail"><span>Northing</span> ${northing}</div>
                <div class="point-detail"><span>Latitude</span> ${lat}</div>
                <div class="point-detail"><span>Longitude</span> ${lon}</div>
                <div class="point-distance">${distanceText}</div>
                <div class="point-actions">
                    <a href="${gmapUrl}" target="_blank" class="map-button-csv google">Google Maps</a>
                    <a href="${wazeUrl}" target="_blank" class="map-button-csv waze">Waze</a>
                </div>
            </div>
        </div>
    `;

    myPointsContainer.insertAdjacentHTML('beforeend', pointCardHTML);
    myPointsSection.classList.remove('hidden');
}

function handleAddPoint() {
    const easting = parseFloat(eastingInput.value);
    const northing = parseFloat(northingInput.value);
    const latitude = parseFloat(latResult.textContent);
    const longitude = parseFloat(lonResult.textContent);

    if (isNaN(easting) || isNaN(northing) || isNaN(latitude) || isNaN(longitude)) {
        errorMessage.textContent = 'Cannot save point: Please perform a successful conversion first.';
        errorMessage.classList.remove('hidden');
        setTimeout(() => errorMessage.classList.add('hidden'), 3000);
        return;
    }

    const pointName = prompt('Enter a name for this point (optional):');
	const points = getSavedPoints();
	
    savedPoints.push({
        name: pointName || `Point ${savedPoints.length + 1}`,
        easting,
        northing,
        latitude,
        longitude
    });
	
	
	points.push(newPoint);
	localStorage.setItem('myPoints', JSON.stringify(points));
    renderSavedPoints();
    myPointsSection.classList.remove('hidden');
    document.getElementById('about-section').classList.add('hidden');
}

addPointBtn.addEventListener('click', () => {
	console.log("Add to List CLICKED — lastConversion:", lastConversion);

    if (lastConversion) {
        const pointName = prompt("Please enter a name for this point:", "Manual Point");

        if (pointName) { // If user entered a name
            const { easting, northing, latitude, longitude } = lastConversion;

           renderSavedPoints();

            // Reset UI
            eastingInput.value = '';
            northingInput.value = '';
            latResult.textContent = '-';
            lonResult.textContent = '-';
            latResultBox?.classList.remove('success');
            lonResultBox?.classList.remove('success');
            manualActionsContainer.style.display = 'none';
            manualActionsContainer.innerHTML = '';
            addPointBtn.style.display = 'none';
            lastConversion = null;

            // Open points section automatically
            myPointsSection.classList.remove('hidden');
        }
    } else {
        console.warn('No conversion data found. Make sure conversion was done first.');
    }
});


// NEW EVENT LISTENER LOGIC
if (calcHeightBtn) {
    calcHeightBtn.addEventListener('click', () => {
        // Get selected device
        const selectedDevice = document.querySelector('input[name="device"]:checked').value;

        // Get inputs
        const h1 = parseFloat(antHeight1Input.value);
        const h2 = parseFloat(antHeight2Input.value);
        const pHeight = parseFloat(pahitHeightInput.value);

        heightError.textContent = '';
        heightResults.classList.add('hidden');
        diffBox.classList.remove('bg-red-100'); // Reset highlight

        if (isNaN(h1) || isNaN(h2) || isNaN(pHeight)) {
            heightError.textContent = 'Please enter all three height measurements.';
            heightResults.classList.remove('hidden');
            return;
        }

        // Define constants based on device
        let R_ant, O_ant;

        if (selectedDevice === 'trimble') {
            // Trimble constants: 169.81mm radius, 44.34mm offset
            R_ant = 0.16981;
            O_ant = 0.04434;
        } else if (selectedDevice === 'topcon') {
            // Topcon constants: 149mm radius, 30mm offset
            R_ant = 0.149;
            O_ant = 0.03;
        } else {
            // Default fallback
            R_ant = 0.16981;
            O_ant = 0.04434;
        }

        // Pahit constants are shared: 0.15m radius, 0.0015m offset
        const R_pahit = 0.15;
        const O_pahit = 0.0015;

        // Calculate V1 (Vertical 1)
        let v1 = 0;
        if (h1 > R_ant) {
            v1 = Math.sqrt(Math.pow(h1, 2) - Math.pow(R_ant, 2)) - O_ant;
        } else {
            heightError.textContent = 'Antenna Measure 1 is too small.';
            return;
        }

        // Calculate V2 (Vertical 2)
        let v2 = 0;
        if (h2 > R_ant) {
            v2 = Math.sqrt(Math.pow(h2, 2) - Math.pow(R_ant, 2)) - O_ant;
        } else {
            heightError.textContent = 'Antenna Measure 2 is too small.';
            return;
        }

        // 1. Calculate VA (Vertical Antenna - Average of V1 and V2)
        const VA = (v1 + v2) / 2;

        // 2. Calculate VP (Vertical Pahit)
        let VP = 0;
        if (pHeight > R_pahit) {
            VP = Math.sqrt(Math.pow(pHeight, 2) - Math.pow(R_pahit, 2)) - O_pahit;
        } else {
            heightError.textContent = 'Pahit Height is too small (must be > 0.15m).';
            return;
        }

        // 3. Difference
        const diff = Math.abs(VA - VP);

        // 4. Average of VA and VP
        const average = (VA + VP) / 2;

        // Highlight Logic: Check if difference >= 4mm (0.004m)
        if (diff >= 0.004) {
            diffBox.classList.add('bg-red-100');
        }

        // Display Results
        resVA.textContent = VA.toFixed(4) + ' m';
        resVP.textContent = VP.toFixed(4) + ' m';
        resDiff.textContent = diff.toFixed(4) + ' m';
        resAvg.textContent = average.toFixed(4) + ' m';

        heightResults.classList.remove('hidden');
    });
}

// --- CSV Handling ---

function parseCsvFile(file) {
    csvErrorMessage.classList.add('hidden');
    csvColumnSelection.classList.add('hidden');
    csvData = [];
    csvHeaders = [];

    Papa.parse(file, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: function (results) {
            if (results.data.length === 0) {
                csvErrorMessage.textContent = 'CSV file is empty or headers are missing.';
                csvErrorMessage.classList.remove('hidden');
                processCsvBtn.disabled = true;
                return;
            }

            csvData = results.data;
            csvHeaders = results.meta.fields || Object.keys(csvData[0]);

            [pointNameColumnSelect, eastingColumnSelect, northingColumnSelect].forEach(select => {
                select.innerHTML = '';
                if (select.id === 'point-name-column') {
                    const defaultOption = document.createElement('option');
                    defaultOption.value = '';
                    defaultOption.textContent = '-- No Name Column --';
                    select.appendChild(defaultOption);
                }

                csvHeaders.forEach(header => {
                    const option = document.createElement('option');
                    option.value = header;
                    option.textContent = header;
                    select.appendChild(option);
                });
            });

            autoSelectCsvColumns();

            csvColumnSelection.classList.remove('hidden');
            processCsvBtn.disabled = false;
        },
        error: function (error) {
            csvErrorMessage.textContent = `Error parsing CSV: ${error.message}`;
            csvErrorMessage.classList.remove('hidden');
            processCsvBtn.disabled = true;
        }
    });
}

function autoSelectCsvColumns() {
    const headerMap = {
        'easting': ['Easting', 'E', 'ITM_X', 'X'],
        'northing': ['Northing', 'N', 'ITM_Y', 'Y'],
        'pointName': ['Name', 'PointName', 'ID', 'PointID']
    };

    const findMatch = (target) => {
        const matches = headerMap[target];
        for (let header of csvHeaders) {
            if (matches.includes(header.trim())) {
                return header;
            }
        }
        return '';
    };

    eastingColumnSelect.value = findMatch('easting');
    northingColumnSelect.value = findMatch('northing');
    pointNameColumnSelect.value = findMatch('pointName');
}

function processConvertedCsv() {
    // Safety check: if elements are missing, stop to prevent crash
    if (!csvErrorMessage || !csvResultsBody || !csvResultsSection) {
        console.error("Missing CSV HTML elements");
        return;
    }
	csvErrorMessage.classList.add('hidden');
    csvResultsBody.innerHTML = '';
    csvResultsSection.classList.add('hidden');

    const eastingCol = eastingColumnSelect.value;
    const northingCol = northingColumnSelect.value;
    const nameCol = pointNameColumnSelect.value;

    if (!eastingCol || !northingCol) {
        csvErrorMessage.textContent = 'Please select both Easting and Northing columns.';
        csvErrorMessage.classList.remove('hidden');
        return;
    }

    const convertedPoints = csvData.map((row, index) => {
        const easting = parseFloat(row[eastingCol]);
        const northing = parseFloat(row[northingCol]);
        const pointName = nameCol ? row[nameCol] : `Row ${index + 1}`;

        let wgs84 = null;
        let status = 'Success';

        if (isNaN(easting) || isNaN(northing) || easting <= 0 || northing <= 0) {
            status = 'Error: Invalid ITM values';
        } else {
            wgs84 = convertItmToWgs84(easting, northing);
			renderSavedPoints();
            if (!wgs84) status = 'Error: Conversion failed';
        }

        return {
            name: pointName,
            easting,
            northing,
            wgs84,
            status
        };
    });

    convertedPoints.forEach(point => {
        const row = csvResultsBody.insertRow();
        const statusClass = point.status === 'Success' ? 'text-green-600' : 'text-red-500';

        let wgs84Text = point.status === 'Success' ?
            `${point.wgs84.latitude.toFixed(6)}, ${point.wgs84.longitude.toFixed(6)}` :
            `<span class="${statusClass}">${point.status}</span>`;

        if (point.status === 'Success') {
		const lat = point.wgs84.latitude.toFixed(6);
		const lon = point.wgs84.longitude.toFixed(6);
		const googleMapsUrl = `https://www.google.com/maps?q=${lat},${lon}`;
		const wazeUrl = `https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`;

		actionsHtml = `
			<td>
				<a href="${googleMapsUrl}" target="_blank" class="map-button-csv google">Maps</a>
				<a href="${wazeUrl}" target="_blank" class="map-button-csv waze">Waze</a>
			</td>
		`;
		}
    });

    document.querySelectorAll('.map-button-csv').forEach(button => {
        button.addEventListener('click', (e) => {
            const lat = parseFloat(e.target.dataset.lat);
            const lon = parseFloat(e.target.dataset.lon);
            const msg = `Map feature simulated. Coordinates: Lat ${lat.toFixed(6)}, Lon ${lon.toFixed(6)}`;
            alert(msg);
        });
    });

    csvResultsSection.classList.remove('hidden');
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Event listeners
    if (convertBtn) convertBtn.addEventListener('click', handleManualConvert);

    // Use defensive check for savePointBtn and correct function
    if (savePointBtn) savePointBtn.addEventListener('click', handleAddPoint);

    // REMOVED heightCalculateBtn listener here as it is now handled above

    if (myPointsBtn) {
        myPointsBtn.addEventListener('click', () => {
            const aboutSection = document.getElementById('about-section');
            myPointsSection.classList.toggle('hidden');
            aboutSection.classList.toggle('hidden');

            if (!myPointsSection.classList.contains('hidden')) {
                renderSavedPoints();
                myPointsBtn.textContent = 'Hide Saved Points';
            } else {
                myPointsBtn.textContent = 'View Saved Points';
            }
        });
    }

    if (csvUploadInput) {
        csvUploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                parseCsvFile(file);
            }
        });
    }

    if (processCsvBtn) processCsvBtn.addEventListener('click', processConvertedCsv);

    // --- SAVE FUNCTIONALITY FIXED (Static Page) ---
    const saveBtn = document.getElementById('save-btn');
    const saveError = document.getElementById('save-error');

    if (saveBtn) {
        saveBtn.addEventListener('click', () => {
            // Correct IDs based on HTML
            const surveyor = document.getElementById('surveyor')?.value.trim();
            const pointName = document.getElementById('point-name')?.value.trim();
            const date = document.getElementById('survey-date')?.value.trim();
            const startTime = document.getElementById('start-time')?.value.trim();

            // Read content from Result Boxes, handling potential whitespace and null elements
            const VA = resVA?.textContent.trim().replace(' m', '');
            const VP = resVP?.textContent.trim().replace(' m', '');
            const diff = resDiff?.textContent.trim().replace(' m', '');
            const average = resAvg?.textContent.trim().replace(' m', '');

            // Enhanced validation debug logging
            console.log("Save Attempt Data:", { surveyor, pointName, date, startTime, VA, VP, average, diff });

            if (!surveyor || !pointName || !date || !startTime) {
                if (saveError) saveError.textContent = '⚠ Please fill in all metadata fields (Surveyor, Point Name, Date, Time).';
                return;
            }

            if (!VA || !average || VA === "" || average === "") {
                if (saveError) saveError.textContent = '⚠ Please calculate the height first.';
                return;
            }

            if (saveError) saveError.textContent = '';

            // Create CSV Content
            //const csvContent = "data:text/csv;charset=utf-8,"
            //    + `Surveyor,${surveyor}\n`
            //    + `Point Name,${pointName}\n`
            //    + `Date,${date}\n`
            //    + `Start Time,${startTime}\n`
            //    + `Antenna Vertical Height,${VA}\n`
            //    + `Pahit Vertical Height,${VP}\n`
            //    + `Average Height,${average}\n`
            //    + `Height Difference,${diff}\n`;

            // Trigger Download
            //const encodedUri = encodeURI(csvContent);
            //const link = document.createElement("a");
            //link.setAttribute("href", encodedUri);
            //link.setAttribute("download", `${pointName}_${date}_${startTime}.csv`);
            //document.body.appendChild(link);
            //link.click();
            //document.body.removeChild(link);
			
			// Prepare data for Excel
			//const excelData = [
			//	{ Key: "Surveyor", Value: surveyor },
			//	{ Key: "Point Name", Value: pointName },
			//	{ Key: "Date", Value: date },
			//	{ Key: "Start Time", Value: startTime },
			//	{ Key: "Antenna Vertical Height", Value: VA },
			//	{ Key: "Pahit Vertical Height", Value: VP },
			//	{ Key: "Average Height", Value: average },
			//	{ Key: "Height Difference", Value: diff },
			//];

			// Convert JSON to worksheet
			//const worksheet = XLSX.utils.json_to_sheet(excelData);

			// Optional: Set column width
			//worksheet['!cols'] = [
			//	{ wch: 22 }, // 'Key' column width
			//	{ wch: 15 }, // 'Value' column width
			//];

			// Create workbook & add worksheet
			//const workbook = XLSX.utils.book_new();
			//XLSX.utils.book_append_sheet(workbook, worksheet, "Vertical Survey");

			// Export Excel file
			//const filename = `${pointName}_${date}_${startTime}.xlsx`;
			//XLSX.writeFile(workbook, filename);

			function saveVerticalMeasurementExcel(data) {
			const worksheet = XLSX.utils.aoa_to_sheet([
				["Key", "Value"],
				["Surveyor", data.surveyor],
			//	["Receiver_#", data.device],
			//	["Receiver_#", data.receiverNum],
			//	["Antenna_#", data.antennaNum],
				["Point Name", data.pointName],
				["Date", data.date],
				["Start Time", data.startTime],
				["Antenna Vertical Height", data.VA],
				["Pahit Vertical Height", data.VP],
				["Average Height", data.average],
				["Height Difference", data.diff],
			]);

			const workbook = XLSX.utils.book_new();
			XLSX.utils.book_append_sheet(workbook, worksheet, "Vertical Survey");

			XLSX.writeFile(workbook, `${data.pointName}_${data.date}_${data.startTime}.xlsx`);
}
			saveVerticalMeasurementExcel({
				surveyor,
			//	device,
			//	receiverNum,
			//	antennaNum
				pointName,
				date,
				startTime,
				VA,
				VP,
				average,
				diff
			});


            // Clear all input fields after successful save
            document.getElementById('surveyor').value = '';
            document.getElementById('point-name').value = '';
            document.getElementById('receiver-point').value = '';
            document.getElementById('survey-date').value = '';
            document.getElementById('start-time').value = '';
            document.getElementById('end-time').value = '';
            antHeight1Input.value = '';
            antHeight2Input.value = '';
            pahitHeightInput.value = '';

            // Clear results display
            resVA.textContent = '';
            resVP.textContent = '';
            resDiff.textContent = '';
            resAvg.textContent = '';
            heightResults.classList.add('hidden');
            diffBox.classList.remove('bg-red-100');
        });
    }

    // Mode switching logic
    modeToggleButton = document.getElementById('options-menu');
    modeDropdown = document.getElementById('mode-dropdown');
    const menuManualInput = document.getElementById('menu-manual-input');
    const menuCsvUpload = document.getElementById('menu-csv-upload');
    const menuStaticData = document.getElementById('menu-static-data');

    if (modeToggleButton && modeDropdown) {
        modeToggleButton.addEventListener('click', () => {
            modeDropdown.classList.toggle('hidden');
        });
    }

    if (menuManualInput) {
        menuManualInput.addEventListener('click', (event) => {
            event.preventDefault();
            showInterface('manual');
        });
    }

    if (menuCsvUpload) {
        menuCsvUpload.addEventListener('click', (event) => {
            event.preventDefault();
            showInterface('csv');
        });
    }

    if (menuStaticData) {
        menuStaticData.addEventListener('click', (event) => {
            event.preventDefault();
            showInterface('static');
        });
    }

    window.addEventListener('click', function (e) {
        if (modeDropdown && !modeToggleButton.contains(e.target) && !modeDropdown.contains(e.target)) {
            modeDropdown.classList.add('hidden');
        }
    });

    showInterface('manual');
});

// Get user's location
navigator.geolocation?.getCurrentPosition(
    position => {
        userLocation = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
        };
        myLatSpan.textContent = userLocation.latitude.toFixed(6);
        myLonSpan.textContent = userLocation.longitude.toFixed(6);
    },
    error => {
        myLatSpan.textContent = 'Unavailable';
        myLonSpan.textContent = 'Unavailable';
        console.warn('Geolocation error:', error.message);
    }
);
