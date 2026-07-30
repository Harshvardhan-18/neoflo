/**
 * Image compression utility using OffscreenCanvas and createImageBitmap.
 * Compatible with Manifest V3 background service worker environment.
 */

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  let binary = '';
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;
  const chunkSize = 0x8000; // Process in 32k chunks to prevent stack overflow

  for (let i = 0; i < len; i += chunkSize) {
    const chunk = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

export async function compressImageDataUrl(
  dataUrl: string,
  maxDimension = 1024,
  quality = 0.70
): Promise<string> {
  try {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    const bitmap = await createImageBitmap(blob);

    let width = bitmap.width;
    let height = bitmap.height;

    if (width > maxDimension || height > maxDimension) {
      if (width >= height) {
        height = Math.round((height * maxDimension) / width);
        width = maxDimension;
      } else {
        width = Math.round((width * maxDimension) / height);
        height = maxDimension;
      }
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return dataUrl; // Fallback to raw if canvas context unavailable
    }

    ctx.drawImage(bitmap, 0, 0, width, height);

    const compressedBlob = await canvas.convertToBlob({
      type: 'image/jpeg',
      quality
    });

    const arrayBuffer = await compressedBlob.arrayBuffer();
    const base64 = arrayBufferToBase64(arrayBuffer);
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.warn('[Visual AI Agent Image] Compression failed, using original format:', error);
    return dataUrl;
  }
}
