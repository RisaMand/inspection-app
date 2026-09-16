const { createClient } = require('@supabase/supabase-js');
const crypto = require('crypto');
const env = require('./env');

// Server-only client -- authenticated with the secret key, which bypasses
// row-level security. Never construct a client like this anywhere the
// frontend can reach; this file only ever runs on the backend.
const supabase = createClient(env.supabase.url, env.supabase.secretKey);
const bucket = env.supabase.bucket;

// How a real capture path is generated. Every real photo in this system is
// a JPEG (Capture.jsx's only output format, live or uploaded) -- namespaced
// by inspector so nobody's paths collide, and a random UUID rather than
// anything derived from user input, so a path can never be guessed or
// walked from one photo to another.
function generatePhotoPath(inspectorId) {
  return `${inspectorId}/${crypto.randomUUID()}.jpg`;
}

// One-time signed URL the client uploads the actual photo bytes to,
// directly to Supabase Storage -- the bytes never pass through this
// backend at all (architecture B, chosen over routing every photo through
// this server twice).
async function createSignedUploadUrl(path) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUploadUrl(path);
  if (error) {
    throw new Error(`Failed to create signed upload URL: ${error.message}`);
  }
  return data; // { signedUrl, token, path }
}

// A fresh, time-limited signed URL for actually viewing a stored photo.
// Never store this -- only the path is permanent; the signed URL is
// generated new every time a report is actually opened, so nothing baked
// into a legal record can silently expire.
async function createSignedDownloadUrl(path, expiresInSeconds = 3600) {
  const { data, error } = await supabase.storage.from(bucket).createSignedUrl(path, expiresInSeconds);
  if (error) {
    throw new Error(`Failed to create signed download URL for ${path}: ${error.message}`);
  }
  return data.signedUrl;
}

async function createSignedDownloadUrls(paths, expiresInSeconds = 3600) {
  if (!Array.isArray(paths) || paths.length === 0) return [];
  return Promise.all(paths.map((path) => createSignedDownloadUrl(path, expiresInSeconds)));
}

module.exports = {
  supabase,
  bucket,
  generatePhotoPath,
  createSignedUploadUrl,
  createSignedDownloadUrl,
  createSignedDownloadUrls,
};