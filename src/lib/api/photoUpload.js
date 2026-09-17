// Photo upload flow wiring (FE<->BE integration arc, item 1 — session 11's
// sequencing). Capture.jsx and useSession.js's addItem() currently keep
// every photo as an in-memory data URL, stored only in IndexedDB — this
// module is the missing piece that turns one of those data URLs into a
// real Supabase Storage path, matching what sync.validator.js's
// imageReferences schema actually requires (a real
// <inspectorUuid>/<photoUuid>.jpg path, not a data URL). Nothing here
// changes when or whether a photo is captured — it's called later, at
// sync time, not from Capture.jsx directly.
import { api } from './client.js';

async function dataUrlToBlob(dataUrl) {
  const res = await fetch(dataUrl);
  return res.blob();
}

export async function uploadPhoto(token, dataUrl) {
  const { path, signedUrl } = await api.createUploadUrl(token);
  const blob = await dataUrlToBlob(dataUrl);

  const putRes = await fetch(signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'image/jpeg' },
    body: blob,
  });

  if (!putRes.ok) {
    throw new Error(`Photo upload failed (${putRes.status}) for one of this item's photos`);
  }

  return path;
}

export async function uploadPhotos(token, dataUrls) {
  const paths = [];
  for (const dataUrl of dataUrls) {
    paths.push(await uploadPhoto(token, dataUrl));
  }
  return paths;
}