// Basic Leaflet map setup and OpenSky data fetch
document.addEventListener('DOMContentLoaded', () => {
    const map = L.map('map').setView([20, 0], 2);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
    }).addTo(map);

    async function fetchFlights() {
        try {
            const response = await fetch('https://opensky-network.org/api/states/all');
            const data = await response.json();
            data.states.forEach(state => {
                const lat = state[6];
                const lon = state[5];
                if (lat && lon) {
                    L.marker([lat, lon]).addTo(map)
                        .bindPopup(\`<b>Callsign:</b> \${state[1]}<br><b>Altitude:</b> \${state[7]} m\`);
                }
            });
        } catch (error) {
            console.error('Failed to fetch flight data', error);
        }
    }

    fetchFlights();
    setInterval(fetchFlights, 15000); // Refresh every 15s
});
