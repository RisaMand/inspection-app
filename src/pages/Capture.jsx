import { useRef, useState, useEffect } from 'react';
import { mockQualityCheck } from '../cv/mockQualityCheck';
import { useNavigate } from 'react-router-dom';
import { dbPromise } from '../db/db';

const PHOTO_WARN_THRESHOLD = 4;
const PHOTO_HARD_LIMIT = 7;
const ITEM_WARN_THRESHOLD = 30;

function getDraftPhotosKey(session) {
  if (!session || !session.startedAt) return null;
  return `captureDraftPhotos:${session.startedAt}`;
}

export default function Capture({ addItem, session, sessionLoaded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]); // array of dataUrl strings
  const [retakePrompt, setRetakePrompt] = useState(null); // { reason } or null
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });

        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err) {
        if (!cancelled) {
          setError('Camera access failed: ' + err.message);
        }
      }
    }
    startCamera();

    return () => {
      cancelled = true;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (sessionLoaded && !session) {
      navigate('/session');
    }
  }, [session, sessionLoaded, navigate]);

  // Restore any in-progress (not-yet-finished) photos after a refresh,
  // scoped to the currently active session — never leaks a previous
  // session's abandoned draft photos into a new one.
  useEffect(() => {
    const draftKey = getDraftPhotosKey(session);
    if (!draftKey) return; // no active session yet, nothing to restore against

    async function loadDraftPhotos() {
      const db = await dbPromise;
      const stored = await db.get('session', draftKey);
      if (stored && stored.length > 0) {
        setPhotos(stored);
      }
    }
    loadDraftPhotos();
  }, [session]);

  // Persist in-progress photos on every change, so a refresh doesn't lose
  // them — scoped to the same per-session key as the load effect.
  useEffect(() => {
    const draftKey = getDraftPhotosKey(session);
    if (!draftKey) return;

    async function saveDraftPhotos() {
      const db = await dbPromise;
      if (photos.length > 0) {
        await db.put('session', photos, draftKey);
      } else {
        await db.delete('session', draftKey);
      }
    }
    saveDraftPhotos();
  }, [photos, session]);

  function tryAddPhoto(dataUrl, currentPhotos, setPhotosFn, setRetakePromptFn) {
    if (currentPhotos.length >= PHOTO_HARD_LIMIT) {
      alert(`This item already has ${PHOTO_HARD_LIMIT} photos, which is the maximum. Finish this item or remove a photo before adding another.`);
      return;
    }

    if (currentPhotos.length === PHOTO_WARN_THRESHOLD) {
      const proceed = window.confirm(
        `This item already has ${PHOTO_WARN_THRESHOLD} photos. Most items only need a few (front/back/supplementary panels). Add another anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    setPhotosFn((prev) => [...prev, dataUrl]);
    setRetakePromptFn(null);
  }

  function capturePhoto() {
    if (!stream) {
      alert('Camera is not available. Use "Upload Photo" instead, or check camera permissions and reload.');
      return;
    }

    if (photos.length >= PHOTO_HARD_LIMIT) {
      alert(`This item already has ${PHOTO_HARD_LIMIT} photos, which is the maximum. Finish this item or remove a photo before adding another.`);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    const qualityResult = mockQualityCheck(dataUrl);

    if (qualityResult.pass) {
      tryAddPhoto(dataUrl, photos, setPhotos, setRetakePrompt);
    } else {
      setRetakePrompt({ reason: qualityResult.reason });
    }
  }

  function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (photos.length >= PHOTO_HARD_LIMIT) {
      alert(`This item already has ${PHOTO_HARD_LIMIT} photos, which is the maximum. Finish this item or remove a photo before adding another.`);
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = reader.result;
      const qualityResult = mockQualityCheck(dataUrl);

      if (qualityResult.pass) {
        tryAddPhoto(dataUrl, photos, setPhotos, setRetakePrompt);
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
    const itemId = addItem(photos);
    setPhotos([]);
    const draftKey = getDraftPhotosKey(session);
    if (draftKey) {
      dbPromise.then((db) => db.delete('session', draftKey));
    }

    const newItemCount = (session?.items?.length ?? 0) + 1;
    if (newItemCount === ITEM_WARN_THRESHOLD) {
      alert(`This session now has ${ITEM_WARN_THRESHOLD} items. Consider closing out this visit soon via the Consolidated Report screen.`);
    }

    navigate(`/item-result/${itemId}`);
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 500, margin: '0 auto' }}>
      <h1>Capture Label</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', background: '#000' }} />
      <canvas ref={canvasRef} style={{ display: 'none' }} />
      <button onClick={capturePhoto} disabled={!stream} style={{ marginTop: '1rem' }}>
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