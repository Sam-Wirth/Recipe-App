// Browser-only helper: turn whatever the user picked (iPhone HEIC, a 12 MP JPEG,
// a PNG screenshot) into a modest JPEG the vision API accepts.
//
// - HEIC/HEIF is decoded with `heic-to`, loaded on demand so it only costs
//   bandwidth when someone actually picks a HEIC photo.
// - Everything is scaled so the long edge is at most MAX_EDGE. Claude downsizes
//   larger images anyway, so sending more pixels only adds upload time and cost.
// - Re-encoding also applies EXIF rotation, so sideways phone photos come out upright.

const MAX_EDGE = 1568;
const JPEG_QUALITY = 0.85;
const MAX_BYTES = 5 * 1024 * 1024; // must match the server limit

export class ImagePrepError extends Error {}

function looksLikeHeic(file: File) {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name);
}

async function decode(file: File): Promise<ImageBitmap> {
  // Some browsers report HEIC files with an empty MIME type, so also sniff the bytes.
  let heic = looksLikeHeic(file);
  if (!heic && !file.type) {
    const { isHeic } = await import('heic-to');
    heic = await isHeic(file).catch(() => false);
  }

  if (!heic) {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      throw new ImagePrepError("That file couldn't be read as an image.");
    }
  }

  // Safari can decode HEIC natively, which is faster than the WASM decoder.
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    /* fall through to the library */
  }

  try {
    const { heicTo } = await import('heic-to');
    return await heicTo({ blob: file, type: 'bitmap' });
  } catch {
    throw new ImagePrepError("Couldn't convert that HEIC photo. Try exporting it as JPEG.");
  }
}

function toJpeg(bitmap: ImageBitmap, quality: number): Promise<Blob> {
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const width = Math.round(bitmap.width * scale);
  const height = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new ImagePrepError('Your browser could not process the image.');

  ctx.fillStyle = '#fff'; // JPEG has no transparency; avoid black backgrounds on PNGs
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);

  return new Promise((resolve, reject) =>
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new ImagePrepError('Image conversion failed.'))),
      'image/jpeg',
      quality,
    ),
  );
}

/** Returns a JPEG File ready to upload, or throws ImagePrepError with a user-facing message. */
export async function prepareImage(file: File): Promise<File> {
  const bitmap = await decode(file);
  try {
    let blob = await toJpeg(bitmap, JPEG_QUALITY);
    if (blob.size > MAX_BYTES) blob = await toJpeg(bitmap, 0.7); // very detailed photos
    if (blob.size > MAX_BYTES) throw new ImagePrepError('Image is still larger than 5 MB after compression.');

    const name = file.name.replace(/\.[^.]+$/, '') + '.jpg';
    return new File([blob], name, { type: 'image/jpeg', lastModified: Date.now() });
  } finally {
    bitmap.close();
  }
}
