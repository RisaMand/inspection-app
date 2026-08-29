import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StartSession({ startSession, session }) {
  const [visitNumber, setVisitNumber] = useState('');
  const [shopNumber, setShopNumber] = useState('');
  const [gpsStatus, setGpsStatus] = useState('pending'); // pending | granted | denied | unavailable
  const [gps, setGps] = useState(null);
  const [manualLat, setManualLat] = useState('');
  const [manualLng, setManualLng] = useState('');
  const navigate = useNavigate();

  function requestGps() {
    if (!navigator.geolocation) {
      setGpsStatus('unavailable');
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setGpsStatus('granted');
      },
      () => {
        setGpsStatus('denied');
      }
    );
  }

  function handleSubmit(e) {
    e.preventDefault();

    if (session && session.items && session.items.length > 0) {
      const confirmed = window.confirm(
        `You have an active session with ${session.items.length} item(s) not yet closed out. Starting a new session will discard them. Continue?`
      );
      if (!confirmed) {
        navigate('/consolidated-report');
        return;
      }
    }

    let finalGps = null;

    if (gpsStatus === 'granted') {
      finalGps = gps;
    } else if (manualLat.trim() !== '' || manualLng.trim() !== '') {
      const parsedLat = parseFloat(manualLat);
      const parsedLng = parseFloat(manualLng);

      const validLat = !isNaN(parsedLat) && parsedLat >= -90 && parsedLat <= 90;
      const validLng = !isNaN(parsedLng) && parsedLng >= -180 && parsedLng <= 180;

      if (!validLat || !validLng) {
        alert('Enter a valid latitude (-90 to 90) and longitude (-180 to 180), or leave both blank to submit without GPS.');
        return;
      }

      finalGps = { lat: parsedLat, lng: parsedLng };
    }

    startSession(visitNumber, shopNumber, finalGps);
    navigate('/capture');
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 400, margin: '0 auto' }}>
      <h1>Start Inspection Session</h1>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Visit Number
            <input
              type="text"
              value={visitNumber}
              onChange={(e) => setVisitNumber(e.target.value)}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        </div>
        <div style={{ marginBottom: '1rem' }}>
          <label>
            Shop Number
            <input
              type="text"
              value={shopNumber}
              onChange={(e) => setShopNumber(e.target.value)}
              required
              style={{ display: 'block', width: '100%' }}
            />
          </label>
        </div>

        <div style={{ marginBottom: '1rem' }}>
          <button type="button" onClick={requestGps}>
            Capture GPS Location
          </button>
          {gpsStatus === 'granted' && (
            <p>✅ Location captured: {gps.lat.toFixed(5)}, {gps.lng.toFixed(5)}</p>
          )}
          {gpsStatus === 'denied' && (
            <div>
              <p>⚠️ Location permission denied. Enter manually:</p>
              <input
                type="number"
                step="any"
                min="-90"
                max="90"
                placeholder="Latitude (-90 to 90)"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}
              />
              <input
                type="number"
                step="any"
                min="-180"
                max="180"
                placeholder="Longitude (-180 to 180)"
                value={manualLng}
                onChange={(e) => setManualLng(e.target.value)}
                style={{ display: 'block', width: '100%' }}
              />
            </div>
          )}
          {gpsStatus === 'unavailable' && (
            <p>⚠️ Geolocation not supported on this device/browser.</p>
          )}
        </div>

        <button type="submit">Start Inspection</button>
      </form>
    </div>
  );
}