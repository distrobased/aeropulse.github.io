// Map init
const map = L.map('map').setView([20, 0], 2);
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

let markers = {};
let trailLayer = null;
let weatherLayer = null;
let followingFlightId = null;
let lastFlightData = [];
let savedFlights = JSON.parse(localStorage.getItem('savedFlights') || '{}');

// Terminator (day/night)
const terminator = L.terminator();
terminator.addTo(map);
setInterval(() => {
  terminator.setTime();
  terminator.redraw();
}, 60000);

// Airports static list
const majorAirports = [
  { name: "Heathrow", lat: 51.47, lon: -0.4543 },
  { name: "JFK", lat: 40.6413, lon: -73.7781 },
  { name: "Dubai DXB", lat: 25.2532, lon: 55.3657 }
];
majorAirports.forEach(a => {
  const m = L.circleMarker([a.lat, a.lon], { radius: 6, color: 'blue' }).addTo(map);
  m.bindTooltip(a.name);
});

// Splash hide
window.addEventListener('load', () => {
  setTimeout(() => {
    document.getElementById('splash').style.display = 'none';
  }, 2000);
});

function showInfo(f, imgUrl) {
  const panel = document.getElementById('info-panel');
  panel.classList.remove('hidden');
  document.getElementById('plane-img').src = imgUrl || 'assets/logo.png';
  document.getElementById('plane-details').innerHTML = `
    <strong>${f.callsign || 'N/A'}</strong><br>
    ICAO24: ${f.icao24}<br>
    Altitude: ${Math.round(f.alt) || 0} m<br>
    Speed: ${Math.round(f.vel) || 0} m/s
  `;

  // Store current selected flight for save/bookmark
  panel.dataset.selectedFlight = f.id;
}

function hideInfo() {
  document.getElementById('info-panel').classList.add('hidden');
  document.getElementById('info-panel').dataset.selectedFlight = '';
}

async function fetchFlights() {
  try {
    const res = await axios.get('https://opensky-network.org/api/states/all');
    return res.data.states.map(s => ({
      id: s[0], callsign: s[1]?.trim(), lat: s[6], lon: s[5], alt: s[7], vel: s[9], icao24: s[0]
    })).filter(f => f.lat && f.lon);
  } catch (e) {
    console.error("Error fetching flights:", e);
    return [];
  }
}

async function fetchPlaneImage(icao) {
  try {
    // Placeholder free plane image API URL, replace as needed
    return `https://api.skypictures.net/plane/${icao}.jpg`;
  } catch {
    return '';
  }
}

async function fetchTrail(icao) {
  try {
    const res = await axios.get(`https://opensky-network.org/api/tracks/all?icao24=${icao}&time=0`);
    return res.data.path.map(p => [p.latitude, p.longitude]);
  } catch {
    return [];
  }
}

function renderSavedFlights() {
  const list = document.getElementById('saved-flights-list');
  list.innerHTML = '';
  Object.values(savedFlights).forEach(f => {
    const li = document.createElement('li');
    li.textContent = `${f.callsign || 'N/A'} (${f.icao24})`;
    li.onclick = () => {
      map.setView([f.lat, f.lon], 6);
      if (markers[f.id]) markers[f.id].openPopup();
    };
    list.appendChild(li);
  });
}

// Main render function
async function renderPlanes(regionFilter = '') {
  const flights = await fetchFlights();
  lastFlightData = flights;
  
  // Filter by region (very simple bounding box for demo)
  const filtered = flights.filter(f => {
    if (!regionFilter) return true;
    const { lat, lon } = f;
    switch(regionFilter) {
      case 'Europe': return lat >= 35 && lat <= 70 && lon >= -25 && lon <= 45;
      case 'North America': return lat >= 10 && lat <= 75 && lon >= -170 && lon <= -50;
      case 'Asia': return lat >= 5 && lat <= 80 && lon >= 45 && lon <= 180;
      case 'South America': return lat >= -60 && lat <= 15 && lon >= -90 && lon <= -30;
      case 'Africa': return lat >= -35 && lat <= 35 && lon >= -20 && lon <= 55;
      case 'Oceania': return lat >= -50 && lat <= 0 && lon >= 110 && lon <= 180;
      default: return true;
    }
  });

  document.getElementById('flight-count').textContent = `Planes: ${filtered.length}`;
  document.getElementById('busy-region').textContent = regionFilter || 'All Regions';

  filtered.forEach(async f => {
    if (!markers[f.id]) {
      const marker = L.marker([f.lat, f.lon]).addTo(map);
      marker.on('click', async () => {
        if (trailLayer) map.removeLayer(trailLayer);
        const img = await fetchPlaneImage(f.icao24);
        showInfo(f, img);
        const path = await fetchTrail(f.icao24);
        trailLayer = L.polyline(path, { color: 'red' }).addTo(map);
        if (document.getElementById('toggle-follow').checked) {
          followingFlightId = f.id;
        }
      });
      marker.on('mouseover', async () => {
        const img = await fetchPlaneImage(f.icao24);
        showInfo(f, img);
      });
      marker.on('mouseout', hideInfo);
      markers[f.id] = marker;
    } else {
      markers[f.id].setLatLng([f.lat, f.lon]);
    }
  });

  if (followingFlightId) {
    const flight = filtered.find(f => f.id === followingFlightId);
    if (flight) {
      map.panTo([flight.lat, flight.lon]);
    }
  }
}

// Weather overlay toggle (dummy layer for demo)
function addWeatherLayer() {
  if (weatherLayer) return;
  weatherLayer = L.tileLayer('https://tile.openweathermap.org/map/clouds_new/{z}/{x}/{y}.png?appid=YOUR_API_KEY');
  weatherLayer.addTo(map);
}
function removeWeatherLayer() {
  if (weatherLayer) {
    map.removeLayer(weatherLayer);
    weatherLayer = null;
  }
}

// Dark mode toggle
function toggleDarkMode() {
  document.body.classList.toggle('dark-mode');
}

// Event listeners
document.getElementById('search-input').addEventListener('input', e => {
  const query = e.target.value.toLowerCase();
  const match = lastFlightData.find(f =>
    (f.callsign && f.callsign.toLowerCase().includes(query)) ||
    (f.icao24 && f.icao24.toLowerCase().includes(query))
  );
  if (match) {
    map.setView([match.lat, match.lon], 6);
    markers[match.id]?.openPopup();
  }
});

document.getElementById('region-filter').addEventListener('change', e => {
  renderPlanes(e.target.value);
});

document.getElementById('toggle-darkmode').addEventListener('click', toggleDarkMode);

document.getElementById('toggle-settings').addEventListener('click', () => {
  const sidebar = document.getElementById('settings-sidebar');
  sidebar.classList.toggle('hidden');
});

document.getElementById('close-settings').addEventListener('click', () => {
  document.getElementById('settings-sidebar').classList.add('hidden');
});

document.getElementById('toggle-weather').addEventListener('change', e => {
  if (e.target.checked) addWeatherLayer();
  else removeWeatherLayer();
});

document.getElementById('toggle-follow').addEventListener('change', e => {
  if (!e.target.checked) followingFlightId = null;
});

document.getElementById('save-flight').addEventListener('click', () => {
  const panel = document.getElementById('info-panel');
  const flightId = panel.dataset.selectedFlight;
  if (!flightId) return alert('No flight selected');
  const flight = lastFlightData.find(f => f.id === flightId);
  if (!flight) return alert('Flight data not found');
  savedFlights[flight.id] = flight;
  localStorage.setItem('savedFlights', JSON.stringify(savedFlights));
  renderSavedFlights();
  alert(`Saved flight ${flight.callsign || flight.icao24}`);
});

// Bookmarks sidebar toggle (auto show when saved flights exist)
document.getElementById('saved-flights-list').addEventListener('click', e => {
  if (e.target.tagName === 'LI') {
    const flightText = e.target.textContent;
    const flight = Object.values(savedFlights).find(f =>
      `${f.callsign || 'N/A'} (${f.icao24})` === flightText);
    if (flight) {
      map.setView([flight.lat, flight.lon], 6);
      markers[flight.id]?.openPopup();
    }
  }
});

renderSavedFlights();
renderPlanes();
let intervalId = setInterval(() => {
  const updateInterval = parseInt(document.getElementById('update-interval').value, 10) * 1000 || 15000;
  renderPlanes(document.getElementById('region-filter').value);
  clearInterval(intervalId);
  intervalId = setInterval(() => renderPlanes(document.getElementById('region-filter').value), updateInterval);
}, 15000);
