
/// --- DOM Elements ---
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
const savePointBtn = document.getElementById('save-point-btn');
const myLatSpan = document.getElementById('my-lat');
const myLonSpan = document.getElementById('my-lon');
const addPointBtn = document.getElementById('add-point-btn');
const menuCsvUpload = document.getElementById('menu-csv-upload');
const menuManualInput = document.getElementById('menu-manual-input');
const manualInputInterface = document.getElementById('manual-input-interface');
const csvUploadInterface = document.getElementById('csv-upload-interface');
const pahitHeightInput = document.getElementById('pahit-height');
const antHeight1Input = document.getElementById('ant-height-1');
const antHeight2Input = document.getElementById('ant-height-2');
const calcHeightBtn = document.getElementById('calc-height-btn');
const heightError = document.getElementById('height-error');
const heightResults = document.getElementById('height-results');
// NEW DOM elements for Point Metadata
const pointNameInReceiver = document.getElementById('receiver-point');
const antNum = document.getElementById('antenna-num');
const receiverNum = document.getElementById('receiver-num');
const pointNameInput = document.getElementById('point-name');
const surveyorNameInput = document.getElementById('surveyor-name');
const measurementNumInput = document.getElementById('measurement-num'); // NEW
const measurementDateInput = document.getElementById('measurement-date'); // NEW
const startTimeInput = document.getElementById('start-time'); // NEW
const endTimeInput = document.getElementById('end-time'); // NEW
const endDateInput = document.getElementById('end-date');
const resVA = document.getElementById('res-va');
const resVP = document.getElementById('res-vp');
const resDiff = document.getElementById('res-diff');
const resAvg = document.getElementById('res-avg');
const diffBox = document.getElementById('diff-box');
const saveHeightBtn = document.getElementById('save-height-btn'); 

let calculatedResults = null;
let lastConversion = null;
let csvFileContent = null;
let modeToggleButton;
let modeDropdown;
let currentMode = 'manual';
let userLocation = null;
let savedPoints = [];
let csvData = [];
let csvHeaders = [];
let locationWatchId = null;
let deviceHeading = null;
let lastUpdate = 0;

// --- GRS80 Ellipsoid Parameters ---
const GRS80 = {
    a: 6378137,                 // Semi-major axis
    f: 1 / 298.257222101,       // Inverse flattening
    get e_sq() { return 2 * this.f - Math.pow(this.f, 2); }, // Eccentricity squared
    get e_prime_sq() { return this.e_sq / (1 - this.e_sq); }
};
// --- ITM Projection Parameters ---
const ITM_PARAMS = {
    lat0_rad: 31.7343936111111 * Math.PI / 180,
    lon0_rad: 35.2045169444444 * Math.PI / 180,
    k0: 1.0000067,
    false_easting: 219529.584,
    false_northing: 626907.39,
    // High-precision Bursa-Wolf 7-parameters
    dX: -24.0024, dY: -17.1032, dZ: -17.8444,
    rX: -0.33077, rY: -1.85269, rZ: 1.66969,
    s_ppm: 5.4262
};

const WGS84 = {
    a: 6378137,
    f: 1 / 298.257223563,
    get e_sq() { return 2 * this.f - Math.pow(this.f, 2); }
};

const ISRAEL_BOUNDS = {
    minE: 100000, maxE: 300000,
    minN: 300000, maxN: 900000
};
 
function calculateMagneticDeclination(lat, lon) {
    // Israel approximation based on latitude
    // Southern Israel: ~3.2°
    // Central Israel (Tel Aviv area): ~3.5°
    // Northern Israel: ~3.8°
    // Reference: https://www.ngdc.noaa.gov/geomag/calculators/magcalc.shtml
    
    if (lat > 33) return 3.8;   // Northern Israel
    if (lat > 32) return 3.5;   // Central Israel
    return 3.2;                 // Southern Israel
}

function startDeviceOrientationTracking() {
    if (!window.DeviceOrientationEvent) return;

    const handleOrientation = (event) => {
        let heading = null;

        // Check for iOS-specific absolute heading
        if (event.webkitCompassHeading) {
            heading = event.webkitCompassHeading;
        } else if (event.absolute === true || event.alpha !== null) {
            // Android/Standard: alpha is 0 when pointing North, but increases counter-clockwise
            // We convert it to clockwise degrees
            heading = 360 - event.alpha;
        }

        if (heading !== null) {
            // Add magnetic declination for Israel (approx 3.5°)
            let declination = 3.5;
            if (userLocation) {
                declination = calculateMagneticDeclination(userLocation.latitude, userLocation.longitude);
            }
            
            deviceHeading = (heading + declination + 360) % 360;
           
            updateDirectionArrows();
        }
    };

    // iOS requires permission for DeviceOrientation
    if (typeof DeviceOrientationEvent.requestPermission === 'function') {
        // This should ideally be triggered by a button click to work on iOS
        DeviceOrientationEvent.requestPermission()
            .then(response => {
                if (response === 'granted') {
                    window.addEventListener('deviceorientation', handleOrientation);
                }
            });
    } else {
        window.addEventListener('deviceorientation', handleOrientation);
    }
}

function updateDirectionArrows() {
    if (!userLocation || deviceHeading === null) return;

    document.querySelectorAll('span.direction-arrow').forEach(el => {
        const index = parseInt(el.dataset.pointIndex);
        const point = savedPoints[index];
        if (!point) return;

        const bearing = calculateBearing(
            userLocation.latitude,
            userLocation.longitude,
            point.latitude,
            point.longitude
        );

        // FIX: If the arrow is 180 degrees off, we adjust the calculation 
        // to account for the inverted coordinate system.
        let rotation = (bearing - deviceHeading + 180) % 360;
        
        // Update the visual rotation
        el.style.display = 'inline-block';
        el.style.transform = `rotate(${rotation}deg)`;
                
    });
}

    
function handleOrientation(event) {
    const now = Date.now();
    if (now - lastUpdate < 30) return; // Only update every 30ms
    lastUpdate = now;
	
	if (event.alpha === null) return;

    // alpha = compass heading (0 = north)
    deviceHeading = event.alpha;

    updateDirectionArrows();
}
 
function convertItmToWgs84(easting, northing) {
    // 1. Initial local Grid to Geographic (ITM -> GRS80)
    const { a, e_sq, e_prime_sq } = GRS80;
    const { lat0_rad, lon0_rad, k0, false_easting, false_northing } = ITM_PARAMS;

    const M0_coeff0 = 1 - e_sq / 4 - 3 * (e_sq ** 2) / 64 - 5 * (e_sq ** 3) / 256;
    const M0_coeff2 = 3 * e_sq / 8 + 3 * (e_sq ** 2) / 32 + 45 * (e_sq ** 3) / 1024;
    const M0_coeff4 = 15 * (e_sq ** 2) / 256 + 45 * (e_sq ** 3) / 1024;
    const M0_coeff6 = 35 * (e_sq ** 3) / 3072;
    
    const M0 = a * (M0_coeff0 * lat0_rad - M0_coeff2 * Math.sin(2 * lat0_rad) + M0_coeff4 * Math.sin(4 * lat0_rad) - M0_coeff6 * Math.sin(6 * lat0_rad));
    const M = M0 + (northing - false_northing) / k0;
    const mu = M / (a * M0_coeff0);
    
    const e1 = (1 - Math.sqrt(1 - e_sq)) / (1 + Math.sqrt(1 - e_sq));
    const phi1 = mu + (3 * e1 / 2 - 27 * (e1 ** 3) / 32) * Math.sin(2 * mu) 
                    + (21 * (e1 ** 2) / 16 - 55 * (e1 ** 4) / 32) * Math.sin(4 * mu) 
                    + (151 * (e1 ** 3) / 96) * Math.sin(6 * mu);

    const C1 = e_prime_sq * Math.cos(phi1) ** 2;
    const T1 = Math.tan(phi1) ** 2;
    const N1 = a / Math.sqrt(1 - e_sq * Math.sin(phi1) ** 2);
    const R1 = a * (1 - e_sq) / Math.pow(1 - e_sq * Math.sin(phi1) ** 2, 1.5);
    const D = (easting - false_easting) / (N1 * k0);

    const lat_grs80 = phi1 - (N1 * Math.tan(phi1) / R1) * (D ** 2 / 2 - (5 + 3 * T1 + 10 * C1 - 4 * (C1 ** 2) - 9 * e_prime_sq) * (D ** 4) / 24);
    const lon_grs80 = lon0_rad + (D - (1 + 2 * T1 + C1) * (D ** 3) / 6) / Math.cos(phi1);

    // 2. Geographic to Geocentric (Cartesian XYZ)
    const N = a / Math.sqrt(1 - e_sq * Math.sin(lat_grs80) ** 2);
    const X_g = N * Math.cos(lat_grs80) * Math.cos(lon_grs80);
    const Y_g = N * Math.cos(lat_grs80) * Math.sin(lon_grs80);
    const Z_g = (N * (1 - e_sq)) * Math.sin(lat_grs80);

    // 3. 7-Parameter Transformation (Bursa-Wolf)
    const toRad = Math.PI / (180 * 3600); // Arc-seconds to Radians
    const rx = ITM_PARAMS.rX * toRad;
    const ry = ITM_PARAMS.rY * toRad;
    const rz = ITM_PARAMS.rZ * toRad;
    const s = 1 + (ITM_PARAMS.s_ppm * 1e-6);

    const X_w = ITM_PARAMS.dX + s * (X_g - rz * Y_g + ry * Z_g);
    const Y_w = ITM_PARAMS.dY + s * (rz * X_g + Y_g - rx * Z_g);
    const Z_w = ITM_PARAMS.dZ + s * (-ry * X_g + rx * Y_g + Z_g);

    // 4. Geocentric back to Geographic (WGS84)
    const e2_w = WGS84.e_sq;
    const p = Math.sqrt(X_w ** 2 + Y_w ** 2);
    let lat_w = Math.atan2(Z_w, p * (1 - e2_w));
    let lon_w = Math.atan2(Y_w, X_w);

    // Precision Iteration
    for (let i = 0; i < 100; i++) {
        const lat_old = lat_w;
        const N_w = WGS84.a / Math.sqrt(1 - e2_w * Math.sin(lat_w) ** 2);
        lat_w = Math.atan2(Z_w + e2_w * N_w * Math.sin(lat_w), p);
        if (Math.abs(lat_w - lat_old) < 1e-12) break;
    }

    return {
        latitude: lat_w * 180 / Math.PI,
        longitude: lon_w * 180 / Math.PI
    };
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

function calculateBearing(lat1, lon1, lat2, lon2) {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x =
        Math.cos(φ1) * Math.sin(φ2) -
        Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);

    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360;
}

function startUserLocationTracking() {
    if (!navigator.geolocation) {
        console.warn('Geolocation is not supported by this browser.');
        return;
    }
    locationWatchId = navigator.geolocation.watchPosition(
        (position) => {
            userLocation = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude
            };

            // Update UI
            myLatSpan.textContent = userLocation.latitude.toFixed(6);
            myLonSpan.textContent = userLocation.longitude.toFixed(6);
			
            // Recalculate distances live
            updateDistancesForSavedPoints();
			updateDirectionArrows();
        },
        (error) => {
            console.error('Geolocation error:', error.message);
        },
        {
            enableHighAccuracy: true,
            maximumAge: 2000,
            timeout: 10000
        }
    );
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

/**
 * Renders the list of saved points in the right panel.
 */
function renderSavedPoints() {
    myPointsContainer.innerHTML = '';

    if (savedPoints.length === 0) {
        myPointsContainer.innerHTML = '<p class="text-gray-500 text-center text-sm">No points saved yet. Save a point after conversion!</p>';
        return;
    }

    savedPoints.forEach((point, index) => {
        const pointDiv = document.createElement('div');
        pointDiv.className = 'bg-white rounded-lg shadow-md border border-gray-200';
        pointDiv.innerHTML = `
            <div class="point-header p-3 flex justify-between items-center border-b border-gray-200">
                <span class="text-base font-semibold text-gray-800">${point.name || 'Point ' + (index + 1)}</span>
                <button data-index="${index}" class="delete-point-btn text-red-500 hover:text-red-700 text-sm font-medium">Delete</button>
            </div>
            <div class="point-body">
                <div class="point-detail">
                    <span class="point-detail-label">ITM X:</span>
                    <span class="point-detail-value">${point.easting.toFixed(2)}</span>
                </div>
                <div class="point-detail">
                    <span class="point-detail-label">ITM Y:</span>
                    <span class="point-detail-value">${point.northing.toFixed(2)}</span>
                </div>
                <div class="point-detail">
                    <span class="point-detail-label">WGS84 Lat:</span>
                    <span class="point-detail-value">${point.latitude.toFixed(6)}</span>
                </div>
                <div class="point-detail">
                    <span class="point-detail-label">WGS84 Lon:</span>
                    <span class="point-detail-value">${point.longitude.toFixed(6)}</span>
                </div>
                <div class="point-distance">
                    Distance to My Location:
                    <strong data-point-index="${index}">
                        ${userLocation
                            ? calculateDistance(
                                userLocation.latitude,
                                userLocation.longitude,
                                point.latitude,
                                point.longitude
                            ).toFixed(3) + ' km'
                            : 'N/A'}
                    </strong>
                </div>
            </div>
            <div class="point-header p-3 flex justify-between items-center border-b border-gray-200">
                <span class="text-base font-semibold text-gray-800">
                    ${point.name || 'Point ' + (index + 1)}
                </span>
                <span
                    class="direction-arrow"
                    data-point-index="${index}"
                    style="display:inline-block; transform: rotate(0deg); font-size: 1.25rem;"
                >
                    ➤
                </span>
            </div>
        `;
        myPointsContainer.appendChild(pointDiv);
    });

    document.querySelectorAll('.delete-point-btn').forEach(button => {
        button.addEventListener('click', (e) => {
            const indexToDelete = parseInt(e.target.dataset.index);
            savedPoints.splice(indexToDelete, 1);
            saveToLocalStorage();         // ADD THIS LINE: Updates the permanent storage
			renderSavedPoints();
        });
    });
}

function updateDistancesForSavedPoints() {
    if (!userLocation) return;

    // ✅ Only select <strong> elements with data-point-index (distance elements)
    document.querySelectorAll('strong[data-point-index]').forEach(el => {
        const index = parseInt(el.dataset.pointIndex);
        const point = savedPoints[index];

        if (!point) return;

        const distKm = calculateDistance(
            userLocation.latitude,
            userLocation.longitude,
            point.latitude,
            point.longitude
        );

        el.textContent = `${distKm.toFixed(3)} km`;
    });
}

// --- Event Handlers ---

function handleManualConvert() {
	
    errorMessage.classList.add('hidden');
    const easting = parseFloat(eastingInput.value);
    const northing = parseFloat(northingInput.value);

    // GUARD RAIL: Check if coordinates are actually in Israel
    if (easting < ISRAEL_BOUNDS.minE || easting > ISRAEL_BOUNDS.maxE || 
        northing < ISRAEL_BOUNDS.minN || northing > ISRAEL_BOUNDS.maxN) {
        errorMessage.textContent = 'Warning: These coordinates appear to be outside of the Israel Grid area.';
        errorMessage.classList.remove('hidden');
        // We still allow the conversion, but we warn the user.
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

//function appendToMyPoints(pointName, easting, northing, latitude, longitude) {
  //  const lat = latitude.toFixed(6);
    //const lon = longitude.toFixed(6);

   // let distanceText = 'Distance unavailable';
   // if (userLocation) {
     //   const dist = calculateDistance(userLocation.latitude, userLocation.longitude, latitude, longitude);
       // distanceText = `${dist.toFixed(3)} km`;
   // }

    //const gmapUrl = `https://www.google.com/maps?q=${lat},${lon}`;
    //const wazeUrl = `https://www.waze.com/ul?ll=${lat},${lon}&navigate=yes`;

    // Store the point in savedPoints FIRST
    //const pointIndex = savedPoints.length;
    //savedPoints.push({
      //  name: pointName || `Point ${pointIndex + 1}`,
        //easting,
        //northing,
        //latitude,
        //longitude
    //});

    //const pointCardHTML = `
      //  <div class="point-card">
        //    <div class="point-header p-3 flex justify-between items-center border-b border-gray-200">
          //      <h3 class="point-name text-base font-semibold text-gray-800">${pointName}</h3>
            //    <span class="direction-arrow" data-point-index="${pointIndex}" 
              //        style="display:inline-block; transform: rotate(0deg); font-size: 1.25rem;">
                //    ➤
                //</span>
            //</div>
            //<div class="point-body">
              //  <div class="point-detail"><span>Easting</span> ${easting}</div>
                //<div class="point-detail"><span>Northing</span> ${northing}</div>
                //<div class="point-detail"><span>Latitude</span> ${lat}</div>
                //<div class="point-detail"><span>Longitude</span> ${lon}</div>
                //<div class="point-distance">
                  //  Distance to My Location:
                    //<strong data-point-index="${pointIndex}">
                      //  ${distanceText}
                    //</strong>
                //</div>
                //<div class="point-actions">
                  //  <a href="${gmapUrl}" target="_blank" class="map-button-csv google">Google Maps</a>
                    //<a href="${wazeUrl}" target="_blank" class="map-button-csv waze">Waze</a>
               // </div>
            //</div>
        //</div>
    //`;

    //myPointsContainer.insertAdjacentHTML('beforeend', pointCardHTML);
    //myPointsSection.classList.remove('hidden');
//}

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

    if (pointName !== null) {  // User didn't cancel the prompt
        savedPoints.push({
            name: pointName || `Point ${savedPoints.length + 1}`,
            easting,
            northing,
            latitude,
            longitude
        });

        renderSavedPoints();  // ✅ Single function call to render everything
        myPointsSection.classList.remove('hidden');
        
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
    }
}

addPointBtn.addEventListener('click', () => {
	console.log("Add to List CLICKED — lastConversion:", lastConversion);

    if (lastConversion) {
        const pointName = prompt("Please enter a name for this point:", "Manual Point");

        if (pointName) { // If user entered a name
            const { easting, northing, latitude, longitude } = lastConversion;

            // ✅ Replace appendToMyPoints with this:
            savedPoints.push({
                name: pointName,
                easting,
                northing,
                latitude,
                longitude
            });
			
			// FIND THIS IN YOUR SCRIPT:
			function saveCurrentPoint() {
				// ... existing code that creates the point object ...
				
				savedPoints.push(newPoint); // This adds it to the list in the current session
				
				saveToLocalStorage();       // ADD THIS LINE: This makes it permanent!
				
				renderSavedPoints();
			}

            renderSavedPoints();  // ✅ Single function call

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
        // 1. Get Inputs and Reset State
        const selectedDevice = document.querySelector('input[name="device"]:checked').value;
        const h1 = parseFloat(antHeight1Input.value);
        const h2 = parseFloat(antHeight2Input.value);
        const pHeight = parseFloat(pahitHeightInput.value);
        
        heightError.textContent = '';
        heightResults.classList.add('hidden');
        diffBox.classList.remove('bg-red-100'); 
        
        if (saveHeightBtn) saveHeightBtn.disabled = true;

        if (isNaN(h1) || isNaN(h2) || isNaN(pHeight)) {
            heightError.textContent = 'Please enter all three height measurements.';
            heightResults.classList.remove('hidden');
            calculatedResults = null; // Clear old data
            return;
        }

        // 2. Perform Calculation
        let R_ant, O_ant;
        if (selectedDevice === 'trimble') {
            R_ant = 0.16981; O_ant = 0.04434;
        } else if (selectedDevice === 'topcon') {
            R_ant = 0.149; O_ant = 0.03;
        } else {
            R_ant = 0; O_ant = 0;
        }
        const R_pahit = 0.15;
        const O_pahit = 0.0015;

        const va_vert1 = Math.sqrt(h1 * h1 - R_ant * R_ant);
        const va_vert2 = Math.sqrt(h2 * h2 - R_ant * R_ant);
        const VA = (va_vert1 + va_vert2) / 2 - O_ant;
        const VP = Math.sqrt(pHeight * pHeight - R_pahit * R_pahit) - O_pahit;
        const diff = Math.abs(VA - VP);
        const average = (VA + VP) / 2;

        // 3. Update Display
        if (diff >= 0.004) {
            diffBox.classList.add('bg-red-100');
        }
        resVA.textContent = VA.toFixed(4) + ' m';
        resVP.textContent = VP.toFixed(4) + ' m';
        resDiff.textContent = diff.toFixed(4) + ' m';
        resAvg.textContent = average.toFixed(4) + ' m';
        heightResults.classList.remove('hidden');

        // 4. Store ONLY the Calculated Results (Not the metadata yet)
        calculatedResults = {
            h1: h1,
            h2: h2,
            pHeight: pHeight,
            VA: VA,
            VP: VP,
            average: average,
            diff: diff
        };
        
        // 5. Enable Save Button
        if (saveHeightBtn) saveHeightBtn.disabled = false;
    });
}
if (saveHeightBtn) {
    saveHeightBtn.addEventListener('click', () => {
        // --- 1. Validation: Ensure Calculations Exist ---
        if (!calculatedResults) {
            alert('No calculated data available. Please calculate height first.');
            return;
        }

        // --- 2. Validation: Ensure Metadata is Filled ---
        const surveyor = surveyorNameInput.value.trim();
        const pointName = pointNameInput.value.trim();
        const pointNameReceiver = pointNameInReceiver.value.trim();
        
        const startDate = measurementDateInput.value.trim();
        const startTime = startTimeInput.value.trim();
        
        // NEW: Get Stop Data
        const endDate = endDateInput ? endDateInput.value.trim() : '';
        const endTime = endTimeInput.value.trim();

        if (!surveyor || !pointName || !pointNameReceiver || !startDate || !startTime || !endDate || !endTime) {
            alert('⚠ Please fill in all fields (Surveyor, Point Names, Dates, Start & End Times) before saving.');
            return;
        }

        // --- 3. Build Data for Excel ---
        const staticMeasurementData = [
            // Metadata
            { Key: "Receiver number", Value: receiverNum ? receiverNum.value : 'N/A' },
            { Key: "Antenna number", Value: antNum ? antNum.value : 'N/A' },
            { Key: "Surveyor", Value: surveyor },
            { Key: "Measurement #", Value: measurementNumInput ? measurementNumInput.value : 'N/A' },
            { Key: "Point Name", Value: pointName },
            { Key: "Point Name in Receiver", Value: pointNameReceiver },
            
            // Time Data (Updated order)
            { Key: "Start Date", Value: startDate },
            { Key: "Start Time", Value: startTime },
            { Key: "End Date", Value: endDate }, // 👈 Added to Excel
            { Key: "End Time", Value: endTime },

            // Raw Inputs (From stored calculations)
            { Key: "Antenna Slant Height 1 (m)", Value: calculatedResults.h1.toFixed(4) },
            { Key: "Antenna Slant Height 2 (m)", Value: calculatedResults.h2.toFixed(4) },
            { Key: "Pahit Slant Height (m)", Value: calculatedResults.pHeight.toFixed(4) },

            // Calculated Outputs
            { Key: "Antenna Vertical Height (m)", Value: calculatedResults.VA.toFixed(4) },
            { Key: "Pahit Vertical Height (m)", Value: calculatedResults.VP.toFixed(4) },
            { Key: "Average Height (m)", Value: calculatedResults.average.toFixed(4) },
            { Key: "Height Difference (m)", Value: calculatedResults.diff.toFixed(4) },
        ];

        // --- 4. Generate Excel ---
        const filenamePoint = pointName || 'Point';
        const filenameDate = startDate || 'Date';
        const filenameTime = startTime.replace(/:/g, '-') || 'Time';

        if (typeof XLSX !== 'undefined') {
            const worksheet = XLSX.utils.json_to_sheet(staticMeasurementData);
            
            // Set column widths
            worksheet['!cols'] = [{ wch: 25 }, { wch: 25 }]; 
            
            const workbook = XLSX.utils.book_new();
            XLSX.utils.book_append_sheet(workbook, worksheet, "Static Survey");
            
            const fileName = `Static_Measurement_${filenamePoint}_${filenameDate}_${filenameTime}.xlsx`;
            XLSX.writeFile(workbook, fileName);
            
            // --- 5. Cleanup: Clear Fields After Save ---
            pointNameInput.value = '';
            pointNameInReceiver.value = '';
            measurementNumInput.value = '';
            
            // Clear Dates and Times
            measurementDateInput.value = '';
            startTimeInput.value = '';
            endDateInput.value = ''; // 👈 Clear new input
            endTimeInput.value = '';

            if (surveyorNameInput) surveyorNameInput.value = '';
            if (antNum) antNum.value = '';
            if (receiverNum) receiverNum.value = '';

            // Clear Height Inputs
            antHeight1Input.value = '';
            antHeight2Input.value = '';
            pahitHeightInput.value = '';

            // Clear Results Display
            resVA.textContent = '';
            resVP.textContent = '';
            resDiff.textContent = '';
            resAvg.textContent = '';
            heightResults.classList.add('hidden');
            diffBox.classList.remove('bg-red-100');

            // Reset Data State
            calculatedResults = null;
            saveHeightBtn.disabled = true;

        } else {
            alert("XLSX library not loaded. Cannot export to Excel.");
        }
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
            
            // ✅ Replace appendToMyPoints with this:
            if (wgs84) {
                savedPoints.push({
                    name: pointName,
                    easting,
                    northing,
                    latitude: wgs84.latitude,
                    longitude: wgs84.longitude
                });
            }
            
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

    // ✅ Render all points once after processing all CSV rows
    renderSavedPoints();

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
    myPointsSection.classList.remove('hidden');  // ✅ Also show the points section
}

// --- Initialization ---

document.addEventListener('DOMContentLoaded', () => {
    // Event listeners
    if (convertBtn) convertBtn.addEventListener('click', handleManualConvert);
	
	startUserLocationTracking();
    startDeviceOrientationTracking();

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

function saveToLocalStorage() {
    // This takes your 'savedPoints' list and stores it in the browser's hidden vault
    localStorage.setItem('itm_converter_points', JSON.stringify(savedPoints));
};

function loadFromLocalStorage() {
    const stored = localStorage.getItem('itm_converter_points');
    if (stored) {
        savedPoints = JSON.parse(stored);
        // Important: Trigger the UI to draw the points we just loaded
        renderSavedPoints(); 
    }
}

// Call it immediately
loadFromLocalStorage();
