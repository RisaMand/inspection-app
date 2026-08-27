import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

export default function StartSession({ startSession }) {
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
    const finalGps =
      gpsStatus === 'granted'
        ? gps
        : manualLat && manualLng
        ? { lat: parseFloat(manualLat), lng: parseFloat(manualLng) }
        : null;

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
                type="text"
                placeholder="Latitude"
                value={manualLat}
                onChange={(e) => setManualLat(e.target.value)}
                style={{ display: 'block', width: '100%', marginBottom: '0.5rem' }}
              />
              <input
                type="text"
                placeholder="Longitude"
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