import { useRef, useState, useEffect } from 'react';
import checkImage from '../lib/cv/index.js';
import { useNavigate } from 'react-router-dom';
import { dbPromise } from '../db/db';

const PHOTO_WARN_THRESHOLD = 4;
const PHOTO_HARD_LIMIT = 7;
const ITEM_WARN_THRESHOLD = 30;

function getDraftPhotosKey(session) {
  if (!session || !session.startedAt) return null;
  return `captureDraftPhotos:${session.startedAt}`;
}

async function normalizeUploadedImage(file) {
  // Preferred path: createImageBitmap with imageOrientation:'from-image'
  // decodes the file AND applies whatever EXIF orientation tag it carries
  // — covers all 8 possible orientation values correctly, natively, with
  // no manual EXIF byte-parsing needed.
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
      const canvas = document.createElement('canvas');
      canvas.width = bitmap.width;
      canvas.height = bitmap.height;
      canvas.getContext('2d').drawImage(bitmap, 0, 0);
      bitmap.close();
      return canvas.toDataURL('image/jpeg');
    } catch (err) {
      // Fall through to the basic path below.
    }
  }

  // Fallback for browsers without createImageBitmap/imageOrientation
  // support: decode via <img>, same technique the app used before this
  // fix. Orientation won't be corrected here, but this is no worse than
  // the app's prior behavior — never a regression, just not the fix.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        canvas.getContext('2d').drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = () => reject(new Error('Image failed to decode'));
      img.src = reader.result;
    };
    reader.onerror = () => reject(new Error('File failed to read'));
    reader.readAsDataURL(file);
  });
}

export default function Capture({ addItem, session, sessionLoaded }) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);
  const photosRef = useRef([]);
  const ocrResultsRef = useRef([]);

  const [stream, setStream] = useState(null);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]); // array of dataUrl strings
  const [retakePrompt, setRetakePrompt] = useState(null); // { reason } or null
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const navigate = useNavigate();

  // Keep a ref mirror of `photos` so async callbacks (file upload) can check
  // the true, current count instead of a stale value captured in a closure
  // from before they started.
  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      let mediaStream;

      try {
        // Prefer the rear/environment-facing camera — this is a field
        // inspection tool, an inspector photographs a label in front of
        // them, not themselves. 'exact' forces a hard requirement, which
        // throws on devices with only one camera (e.g. most laptops).
        // VERIFIED on real device (Android phone, Vercel HTTPS deploy,
        // installed as PWA): rear camera opens correctly.
        mediaStream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { exact: 'environment' } },
        });
      } catch (exactErr) {
        try {
          // Fallback: no rear camera available under a strict match (single-
          // camera device, or the constraint isn't supported) — fall back to
          // whatever camera the device/browser offers rather than failing
          // outright.
          mediaStream = await navigator.mediaDevices.getUserMedia({ video: true });
        } catch (fallbackErr) {
          if (!cancelled) {
            setError('Camera access failed: ' + fallbackErr.message);
          }
          return;
        }
      }

      if (cancelled) {
        mediaStream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = mediaStream;
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
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
      if (photosRef.current.length > 0) {
        await db.put('session', photos, draftKey);
      } else {
        await db.delete('session', draftKey);
      }
    }
    saveDraftPhotos();
  }, [photos, session]);

  function tryAddPhoto(dataUrl, cvResult) {
    const currentCount = photosRef.current.length;

    if (currentCount >= PHOTO_HARD_LIMIT) {
      alert(`This item already has ${PHOTO_HARD_LIMIT} photos, which is the maximum. Finish this item or remove a photo before adding another.`);
      return;
    }

    if (currentCount === PHOTO_WARN_THRESHOLD) {
      const proceed = window.confirm(
        `This item already has ${PHOTO_WARN_THRESHOLD} photos. Most items only need a few (front/back/supplementary panels). Add another anyway?`
      );
      if (!proceed) {
        return;
      }
    }

    setPhotos((prev) => [...prev, dataUrl]);
    ocrResultsRef.current.push({
      ocrText: cvResult.ocrText,
      confidence: cvResult.confidence,
    });
    setRetakePrompt(null);
  }

  async function capturePhoto() {
    if (!stream) {
      alert('Camera is not available. Use "Upload Photo" instead, or check camera permissions and reload.');
      return;
    }

    if (photosRef.current.length >= PHOTO_HARD_LIMIT) {
      alert(`This item already has ${PHOTO_HARD_LIMIT} photos, which is the maximum. Finish this item or remove a photo before adding another.`);
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg');

    setIsAnalyzing(true);
    try {
      const result = await checkImage(dataUrl);

      if (result.qualityCheck.pass) {
        tryAddPhoto(dataUrl, result);
      } else {
        setRetakePrompt({
          reason: `Image is too blurry (Quality score: ${Math.round(result.qualityCheck.score)} / required: ${result.qualityCheck.threshold}). Hold steady and try again.`,
        });
      }
    } catch (err) {
      alert('Error running computer vision check: ' + err.message);
    } finally {
      setIsAnalyzing(false);
    }
  }

  async function handleFileUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (photosRef.current.length >= PHOTO_HARD_LIMIT) {
      alert(`This item already has ${PHOTO_HARD_LIMIT} photos, which is the maximum. Finish this item or remove a photo before adding another.`);
      e.target.value = '';
      return;
    }

    // Normalize whatever format was picked (PNG, WEBP, GIF, HEIC, etc.)
    // into a real, correctly-oriented JPEG — same format the camera path
    // always produces, with EXIF rotation already applied.
    try {
      const normalizedDataUrl = await normalizeUploadedImage(file);
      setIsAnalyzing(true);
      const result = await checkImage(normalizedDataUrl);

      if (result.qualityCheck.pass) {
        tryAddPhoto(normalizedDataUrl, result);
      } else {
        setRetakePrompt({
          reason: `Uploaded image is too blurry (Quality score: ${Math.round(result.qualityCheck.score)} / required: ${result.qualityCheck.threshold}). Please choose a clearer image.`,
        });
      }
    } catch (err) {
      alert("Couldn't process this photo — verify format or try another image: " + err.message);
    } finally {
      setIsAnalyzing(false);
      e.target.value = ''; // reset so the same file can be re-selected if needed
    }
  }

  function removePhoto(index) {
    setPhotos((prev) => prev.filter((_, i) => i !== index));
    ocrResultsRef.current = ocrResultsRef.current.filter((_, i) => i !== index);
  }

  function triggerBarcodeStub() {
    alert('Barcode scanning not yet implemented — pending Person 3 (CV) integration.');
  }

  async function finishItem() {
    if (photosRef.current.length === 0) {
      alert('Capture at least one photo before finishing this item.');
      return;
    }

    // Combine OCR text from all captured photos for this item
    const combinedOcrText = ocrResultsRef.current.map((r) => r.ocrText).filter(Boolean).join('\n');
    const avgConfidence = ocrResultsRef.current.length > 0
      ? ocrResultsRef.current.reduce((acc, cur) => acc + (cur.confidence || 0), 0) / ocrResultsRef.current.length
      : 0;

    const itemId = await addItem({
      photos: photosRef.current,
      ocrText: combinedOcrText,
      confidence: avgConfidence,
    });
    setPhotos([]);
    ocrResultsRef.current = [];
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

      <div style={{ marginTop: '1rem', display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <button onClick={capturePhoto} disabled={!stream || isAnalyzing}>
          {isAnalyzing ? 'Processing CV...' : 'Capture Photo'}
        </button>

        <label style={{ cursor: isAnalyzing ? 'not-allowed' : 'pointer', display: 'inline-flex' }}>
          <input
            type="file"
            accept="image/*"
            onChange={handleFileUpload}
            disabled={isAnalyzing}
            style={{ display: 'none' }}
          />
          <span style={{ padding: '0.6rem 1.2rem', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '1rem', fontWeight: 500, color: 'var(--text-h)' }}>
            {isAnalyzing ? 'Processing...' : 'Upload Photo'}
          </span>
        </label>

        <button onClick={triggerBarcodeStub} disabled={isAnalyzing}>
          Scan Barcode
        </button>
      </div>

      {isAnalyzing && (
        <p style={{ marginTop: '0.5rem', color: '#888' }}>
          Running quality check and OCR recognition...
        </p>
      )}

      {retakePrompt && (
        <div style={{ background: '#402020', color: '#fff', padding: '1rem', marginTop: '1rem', border: '1px solid red', borderRadius: '4px' }}>
          <p>⚠️ Retake needed: {retakePrompt.reason}</p>
          <button onClick={() => setRetakePrompt(null)} style={{ marginTop: '0.5rem' }}>Dismiss</button>
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

      <button onClick={finishItem} disabled={isAnalyzing} style={{ marginTop: '1rem' }}>
        Done with this item
      </button>
    </div>
  );
}