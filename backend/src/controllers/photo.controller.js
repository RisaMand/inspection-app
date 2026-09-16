const { success } = require('../utils/apiResponse');
const { generatePhotoPath, createSignedUploadUrl } = require('../config/supabaseStorage');

// F2, architecture B: the client asks for one of these per photo, then
// uploads the actual bytes straight to Supabase Storage using the
// signedUrl below -- this backend never sees or handles the image bytes
// themselves, only issues permission to upload one specific path.
exports.createUploadUrl = async (req, res) => {
  const path = generatePhotoPath(req.user.sub);
  const { signedUrl, token } = await createSignedUploadUrl(path);

  // `path` is the one thing the client must send back in imageReferences
  // on sync -- it's the permanent identifier; signedUrl/token are only
  // good for this one upload and are never stored anywhere.
  res.json(success({ path, signedUrl, token }));
};