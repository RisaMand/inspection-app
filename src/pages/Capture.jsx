import { useRef, useState, useEffect } from 'react';
import { mockQualityCheck } from '../cv/mockQualityCheck';

export default function Capture({ addItem }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]); // array of dataUrl strings
  const [retakePrompt, setRetakePrompt] = useState(null); // { reason } or null

  useEffect(() => {
    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        setError('Camera access failed: ' + err.message);
      }
    }
    startCamera();

    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function capturePhoto() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    const qualityResult = mockQualityCheck(dataUrl);

    if (qualityResult.pass) {
      setPhotos((prev) => [...prev, dataUrl]);
      setRetakePrompt(null);
    } else {
      setRetakePrompt({ reason: qualityResult.reason });
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const qualityResult = mockQualityCheck(dataUrl);

      if (qualityResult.pass) {
        setPhotos((prev) => [...prev, dataUrl]);
        setRetakePrompt(null);
      } else {
        setRetakePrompt({ reason: qualityResult.reason });
      }
    };
    reader.readAsDataURL(file);
    e.target.value = ''; // reset so the same file can be re-selected if needed
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
  }

  function triggerBarcodeStub() {
    alert('Barcode scanning not yet implemented — pending Person 3 (CV) integration.');
  }

  function finishItem() {
    if (photos.length === 0) {
      alert('Capture at least one photo before finishing this item.');
      return;
    }
    addItem(photos);
    setPhotos([]);
    alert('Item saved to session. Ready to scan next item.');
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
      <h1>Capture Label</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', background: '#000' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button onClick={capturePhoto} style={{ marginTop: '1rem' }}>
        Capture Photo
      </button>
      <label style={{ marginLeft: '0.5rem', cursor: 'pointer' }}>
        <input
          type="file"
          accept="image/*"
          onChange={handleFileUpload}
          style={{ display: 'none' }}
        />
        <span style={{ padding: '0.5rem 1rem', border: '1px solid #888', borderRadius: '4px' }}>
          Upload Photo
        </span>
      </label>

      <button onClick={triggerBarcodeStub} style={{ marginLeft: '0.5rem' }}>
        Scan Barcode
      </button>

      {retakePrompt && (
        <div style={{ background: '#402020', padding: '1rem', marginTop: '1rem', border: '1px solid red' }}>
          <p>⚠️ Retake needed: {retakePrompt.reason}</p>
          <button onClick={() => setRetakePrompt(null)}>Dismiss</button>
        </div>
      )}

      <div style={{ marginTop: '1rem' }}>
        <p>{photos.length} photo{photos.length !== 1 ? 's' : ''} captured for this item</p>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          {photos.map((photo, i) => (
            <div key={i} style={{ position: 'relative' }}>
              <img src={photo} alt={`capture ${i}`} style={{ width: 80, height: 80, objectFit: 'cover' }} />
              <button
                onClick={() => removePhoto(i)}
                style={{ position: 'absolute', top: 0, right: 0 }}
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      </div>
      <button onClick={finishItem} style={{ marginTop: '1rem' }}>
        Done with this item
      </button>
    </div>
  );
}