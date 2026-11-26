import { PHOTO_DATA_LIMIT, PHOTO_OUTPUT_SIZE } from './avatar-catalog.js?v=avatarhd1';

export const PHOTO_STYLES = Object.freeze([
  Object.freeze({ id: 'portrait', label: '柔光插画' }),
  Object.freeze({ id: 'comic', label: '清线漫画' }),
  Object.freeze({ id: 'duotone', label: '双色海报' }),
  Object.freeze({ id: 'pixel', label: '像素' }),
]);

const maxZoom = 3;
const minSide = 64;
const maxSide = 1920;
const maxPixels = 60_000_000;
const maxFileBytes = 16 * 1024 * 1024;
const styles = new Set(PHOTO_STYLES.map(({ id }) => id));
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

export function paintPhotoCrop(context, photo, { zoom = 1, x = 0, y = 0 } = {}) {
  const size = context.canvas.width;
  const side = Math.min(photo.width, photo.height) / clamp(Number(zoom) || 1, 1, maxZoom);
  context.fillStyle = '#e7dac1';
  context.fillRect(0, 0, size, size);
  context.imageSmoothingQuality = 'high';
  context.drawImage(photo, (photo.width - side) * position(x), (photo.height - side) * position(y),
    side, side, 0, 0, size, size);
}

function illustrate(image, size, contours) {
  const pixels = image.data;
  const original = pixels.slice();
  const luma = new Float32Array(size * size);
  let total = 0;
  for (let i = 0; i < luma.length; i++) {
    const offset = i * 4;
    luma[i] = lightness(original[offset], original[offset + 1], original[offset + 2]);
    total += luma[i];
  }
  const exposure = clamp((138 - total / luma.length) * .33, -8, 20);
  const tint = contours ? [2, 0, 1] : [4, 1, -2];
  const ink = [30, 41, 55];
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      const left = x ? i - 1 : i;
      const right = x + 1 < size ? i + 1 : i;
      const top = y ? i - size : i;
      const bottom = y + 1 < size ? i + size : i;
      const center = luma[i];
      const local = (luma[left] + luma[right] + luma[top] + luma[bottom]) * .25;
      const edge = Math.max(Math.abs(luma[left] - luma[right]), Math.abs(luma[top] - luma[bottom]));
      const softening = contours ? clamp((37 - edge) / 78, 0, .39) : clamp((28 - edge) / 140, 0, .19);
      const outline = contours ? clamp((edge - 20) / 185, 0, .32) : 0;
      const midtone = clamp(1 - Math.abs(center - 124) / 142, 0, 1);
      const detailed = center + clamp(center - local, -14, 14) * .48;
      const adjusted = detailed + midtone * (exposure + (center - 126) * (contours ? .16 : .065));
      const shade = contours ? adjusted + (Math.round(adjusted / 22) * 22 - adjusted) * .54 : adjusted;
      for (let channel = 0; channel < 3; channel++) {
        const offset = i * 4 + channel;
        const nearby = (original[left * 4 + channel] + original[right * 4 + channel]
          + original[top * 4 + channel] + original[bottom * 4 + channel]) / 4;
        const color = original[offset] + (nearby - original[offset]) * softening;
        const paint = shade + (color - center) * (contours ? 1.19 : 1.05) + tint[channel] * midtone;
        pixels[offset] = paint * (1 - outline) + ink[channel] * outline;
      }
    }
  }
}

function duotone(image) {
  const pixels = image.data;
  const shades = [[19, 26, 46], [66, 104, 136], [189, 160, 148], [255, 240, 215]];
  for (let i = 0; i < pixels.length; i += 4) {
    const luma = lightness(pixels[i], pixels[i + 1], pixels[i + 2]);
    const tone = clamp((luma - 9) / 243, 0, 1) * 3;
    const lower = Math.min(2, Math.floor(tone));
    const between = tone - lower;
    for (let channel = 0; channel < 3; channel++) {
      pixels[i + channel] = shades[lower][channel] * (1 - between) + shades[lower + 1][channel] * between;
    }
  }
}

function pixelate(image, size) {
  const pixels = image.data;
  const dither = [-4, 2, 4, -2];
  for (let i = 0; i < pixels.length; i += 4) {
    const x = (i / 4) % size;
    const y = Math.floor(i / 4 / size);
    const shift = dither[(x % 2) + (y % 2) * 2];
    const luma = lightness(pixels[i], pixels[i + 1], pixels[i + 2]);
    for (let channel = 0; channel < 3; channel++) {
      const color = luma + (pixels[i + channel] - luma) * 1.22 + shift;
      pixels[i + channel] = 6 + Math.round(color / 24) * 24;
    }
  }
}

async function encodeAvatar(canvas) {
  const encode = (type, quality) => new Promise(resolve => canvas.toBlob(resolve, type, quality));
  const qualitySteps = [.95, .89, .82, .73, .62, .49, .34, .20, .10];
  for (const mime of ['image/webp', 'image/jpeg']) {
    for (const quality of qualitySteps) {
      const blob = await encode(mime, quality);
      if (blob?.type !== mime) break;
      if (Math.ceil(blob.size / 3) * 4 + 23 > PHOTO_DATA_LIMIT) continue;
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('无法读取生成的头像，请重试。'));
        reader.readAsDataURL(blob);
      });
    }
  }
  throw new Error('这张头像压缩失败，请换张照片或试试其他风格。');
}

export async function renderPhotoAvatar(photo, { style = 'portrait', ...crop } = {}) {
  if (!photo?.width || !photo?.height) throw new Error('请先选择一张照片。');
  if (!styles.has(style)) throw new Error('请选择一种头像风格。');
  const size = style === 'pixel' ? 40 : PHOTO_OUTPUT_SIZE;
  const sample = layer(size, true);
  paintPhotoCrop(sample, photo, crop);
  const image = sample.getImageData(0, 0, size, size);
  if (style === 'portrait' || style === 'comic') illustrate(image, size, style === 'comic');
  if (style === 'duotone') duotone(image);
  if (style === 'pixel') pixelate(image, size);
  sample.putImageData(image, 0, 0);
  if (style !== 'pixel') return encodeAvatar(sample.canvas);
  const output = layer(PHOTO_OUTPUT_SIZE);
  output.imageSmoothingEnabled = false;
  output.drawImage(sample.canvas, 0, 0, PHOTO_OUTPUT_SIZE, PHOTO_OUTPUT_SIZE);
  return encodeAvatar(output.canvas);
}
