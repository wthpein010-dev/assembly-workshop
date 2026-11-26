export const PHOTO_STYLES = Object.freeze([
  Object.freeze({ id: 'comic', label: '漫画' }),
  Object.freeze({ id: 'duotone', label: '双色插画' }),
  Object.freeze({ id: 'pixel', label: '像素' }),
]);

const outputSize = 144;
const maxZoom = 3;
const minSide = 64;
const maxSide = 1200;
const maxPixels = 60_000_000;
const maxFileBytes = 16 * 1024 * 1024;
const maxAvatarChars = 16_000;
const styles = new Map(PHOTO_STYLES.map(({ id }) => [id, id === 'pixel' ? 24 : 112]));
const clamp = (number, min, max) => Math.min(max, Math.max(min, number));
const lightness = (r, g, b) => r * .2126 + g * .7152 + b * .0722;

function photoFormat(bytes) {
  const header = String.fromCharCode(...bytes);
  return bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255
    || bytes[0] === 137 && header.slice(1, 4) === 'PNG'
    || header.startsWith('RIFF') && header.slice(8, 12) === 'WEBP'
    || header.slice(4, 8) === 'ftyp' && (header.slice(8, 12) === 'avif' || header.slice(8, 12) === 'avis');
}

export async function decodePhoto(file) {
  if (!(file instanceof Blob) || !file.size) throw new Error('请选择一张照片。');
  if (file.size > maxFileBytes) throw new Error('照片太大，请选择 16 MB 以内的图片。');
  if (!photoFormat(new Uint8Array(await file.slice(0, 16).arrayBuffer()))) {
    throw new Error('请选择 JPG、PNG、WebP 或 AVIF 照片。');
  }

  let photo;
  try {
    photo = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    throw new Error('无法读取这张照片，请重新选择。');
  }
  const { width, height } = photo;
  if (width * height > maxPixels) {
    photo.close();
    throw new Error('照片分辨率太高，请缩小图片后再试。');
  }
  if (Math.min(width, height) < minSide) {
    photo.close();
    throw new Error('请使用宽、高至少 64 像素的照片。');
  }
  const longestSide = Math.max(width, height);
  if (longestSide <= maxSide) return photo;
  const scale = maxSide / longestSide;
  try {
    return await createImageBitmap(photo, {
      resizeWidth: Math.max(1, Math.round(width * scale)),
      resizeHeight: Math.max(1, Math.round(height * scale)),
      resizeQuality: 'high',
    });
  } catch {
    throw new Error('暂时无法调整这张照片的尺寸，请缩小图片后再试。');
  } finally {
    photo.close();
  }
}

function layer(size, read = false) {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  return canvas.getContext('2d', { alpha: false, willReadFrequently: read });
}

function position(value) {
  return (clamp(Number(value) || 0, -100, 100) + 100) / 200;
}

function comic(image, size) {
  const pixels = image.data;
  const original = pixels.slice();
  const luma = new Float32Array(size * size);
  for (let i = 0; i < luma.length; i++) {
    const offset = i * 4;
    luma[i] = lightness(original[offset], original[offset + 1], original[offset + 2]);
  }
  const ink = [24, 38, 54];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const left = x ? i - 1 : i;
      const right = x + 1 < size ? i + 1 : i;
      const top = y ? i - size : i;
      const bottom = y + 1 < size ? i + size : i;
      const edge = Math.hypot(luma[left] - luma[right], luma[top] - luma[bottom]);
      const outline = clamp((edge - 23) / 105, 0, .72);
      const softened = luma[i] * .55 + (luma[left] + luma[right] + luma[top] + luma[bottom]) * .1125;
      const shade = clamp(Math.round((softened * 1.04 + 6) / 21) * 21, 10, 251);
      for (let channel = 0; channel < 3; channel++) {
        const offset = i * 4 + channel;
        const nearby = (original[left * 4 + channel] + original[right * 4 + channel]
          + original[top * 4 + channel] + original[bottom * 4 + channel]) / 4;
        const color = original[offset] * .55 + nearby * .45;
        const paint = shade + (color - softened) * 1.12;
        pixels[offset] = paint * (1 - outline) + ink[channel] * outline;
      }
    }
  }
}

function duotone(image) {
  const pixels = image.data;
  const shades = [[20, 34, 55], [55, 103, 129], [192, 137, 98], [255, 234, 190]];
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = lightness(pixels[i], pixels[i + 1], pixels[i + 2]);
    const tone = Math.round(clamp((luma - 16) / 225, 0, 1) * 15) / 5;
    const lower = Math.min(2, Math.floor(tone));
    const between = tone - lower;
    for (let channel = 0; channel < 3; channel++) {
      pixels[i + channel] = shades[lower][channel] * (1 - between) + shades[lower + 1][channel] * between;
    }
  }
}

function pixelate(image, size) {
  const pixels = image.data;
  const dither = [-6, 3, 6, -3];
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (i / 4) % size;
    const y = Math.floor(i / 4 / size);
    const shift = dither[(x % 2) + (y % 2) * 2];
    const luma = lightness(pixels[i], pixels[i + 1], pixels[i + 2]);
    for (let channel = 0; channel < 3; channel++) {
      const color = luma + (pixels[i + channel] - luma) * 1.22 + shift;
      pixels[i + channel] = 8 + Math.round(color / 31) * 30;
    }
  }
}

function encodeAvatar(canvas) {
  let mime = 'image/webp';
  for (const quality of [.88, .72, .54, .35, .18]) {
    let data = canvas.toDataURL(mime, quality);
    if (!data.startsWith('data:' + mime + ';base64,')) {
      mime = 'image/jpeg';
      data = canvas.toDataURL(mime, quality);
    }
    if (data.startsWith('data:' + mime + ';base64,') && data.length <= maxAvatarChars) return data;
  }
  throw new Error('这张头像压缩失败，请换张照片或试试其他风格。');
}

export function renderPhotoAvatar(photo, { style = 'comic', zoom = 1, x = 0, y = 0 } = {}) {
  if (!photo?.width || !photo?.height) throw new Error('请先选择一张照片。');
  const size = styles.get(style);
  if (!size) throw new Error('请选择一种头像风格。');
  const side = Math.min(photo.width, photo.height) / clamp(Number(zoom) || 1, 1, maxZoom);
  const sample = layer(size, true);
  sample.fillStyle = '#e7dac1';
  sample.fillRect(0, 0, size, size);
  sample.imageSmoothingQuality = 'high';
  sample.drawImage(photo, (photo.width - side) * position(x), (photo.height - side) * position(y),
    side, side, 0, 0, size, size);
  const image = sample.getImageData(0, 0, size, size);
  if (style === 'comic') comic(image, size);
  if (style === 'duotone') duotone(image);
  if (style === 'pixel') pixelate(image, size);
  sample.putImageData(image, 0, 0);
  const output = layer(outputSize);
  output.imageSmoothingEnabled = style !== 'pixel';
  output.drawImage(sample.canvas, 0, 0, outputSize, outputSize);
  return encodeAvatar(output.canvas);
}
