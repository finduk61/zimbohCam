// zimbohCam — ProRAW / DNG çözme (LibRaw WebAssembly) ve görüntü kaynakları
import { halfLUT } from './engine.js';

export function isRawFile(file) {
  return /\.(dng|cr2|cr3|nef|arw|raf|orf|rw2)$/i.test(file.name || '') || /dng|raw/i.test(file.type || '');
}

// LibRaw ile doğrusal 16 bit RGB çöz
export async function decodeRaw(file, { half = false, onStage } = {}) {
  if (!self.crossOriginIsolated) throw new Error('COI');
  const { default: LibRaw } = await import('../lib/libraw/index.js');
  const raw = new LibRaw();
  try {
    onStage && onStage('RAW dosyası okunuyor…');
    const buf = new Uint8Array(await file.arrayBuffer());
    onStage && onStage(half ? 'RAW çözülüyor (hızlı mod)…' : 'RAW çözülüyor… (48MP birkaç saniye sürebilir)');
    await raw.open(buf, {
      outputBps: 16, gamm: [1, 1], noAutoBright: true, useCameraWb: true,
      outputColor: 1, userQual: 3, highlight: 0, halfSize: half,
    });
    let meta = {};
    try { meta = (await raw.metadata()) || {}; } catch {}
    const img = await raw.imageData();
    if (!img || !img.data) throw new Error('Görüntü verisi alınamadı');
    let d = img.data;
    if (!(d instanceof Uint16Array)) {
      if (img.bits === 16) d = new Uint16Array(d.buffer, d.byteOffset, d.byteLength >> 1);
      else { const o = new Uint16Array(d.length); for (let i = 0; i < d.length; i++) o[i] = d[i] * 257; d = o; }
    }
    const colors = img.colors || 3;
    if (colors !== 3) {
      const o = new Uint16Array(img.width * img.height * 3);
      for (let i = 0, n = img.width * img.height; i < n; i++) { o[i*3] = d[i*colors]; o[i*3+1] = d[i*colors+1]; o[i*3+2] = d[i*colors+2]; }
      d = o;
    }
    return { kind: 'raw', w: img.width, h: img.height, data: d, meta };
  } finally {
    try { raw.dispose(); } catch {}
  }
}

// Görüntü (JPEG/HEIC/PNG) yükle
export async function decodeImage(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.decoding = 'async';
    img.src = url;
    await img.decode();
    return { kind: 'image', w: img.naturalWidth, h: img.naturalHeight, img, url };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

// --- RAW kaynak yardımcıları ---

// Otomatik pozlama: geometrik ortalama parlaklığı orta griye (0.18) getir
export function autoGain(src) {
  const { w, h, data } = src;
  const step = Math.max(1, Math.floor(Math.sqrt(w * h / 40000)));
  let sum = 0, n = 0;
  for (let y = 0; y < h; y += step) for (let x = 0; x < w; x += step) {
    const i = (y * w + x) * 3;
    const L = (0.2126 * data[i] + 0.7152 * data[i+1] + 0.0722 * data[i+2]) / 65535;
    sum += Math.log(Math.max(L, 1e-5)); n++;
  }
  const g = 0.18 / Math.exp(sum / n);
  return Math.min(24, Math.max(0.5, g * 0.85));
}

// Tam görüntüden bir bölgeyi kutu filtresiyle (outW x outH) half-float RGB'ye örnekle
export function rawRegionHalf(src, x0, y0, rw, rh, outW, outH) {
  const lut = halfLUT();
  const { w, data } = src;
  const out = new Uint16Array(outW * outH * 3);
  const sx = rw / outW, sy = rh / outH;
  if (sx <= 1.0001 && sy <= 1.0001) {
    for (let y = 0; y < outH; y++) {
      const yy = Math.min(src.h - 1, Math.floor(y0 + y * sy));
      let o = y * outW * 3;
      for (let x = 0; x < outW; x++) {
        const xx = Math.min(w - 1, Math.floor(x0 + x * sx));
        const i = (yy * w + xx) * 3;
        out[o++] = lut[data[i]]; out[o++] = lut[data[i+1]]; out[o++] = lut[data[i+2]];
      }
    }
    return out;
  }
  // küçültme: her çıktı pikseli için en fazla 4x4 örnek
  const nx = Math.min(4, Math.ceil(sx)), ny = Math.min(4, Math.ceil(sy));
  const inv = 1 / (nx * ny);
  for (let y = 0; y < outH; y++) {
    let o = y * outW * 3;
    for (let x = 0; x < outW; x++) {
      let r = 0, g = 0, b = 0;
      for (let j = 0; j < ny; j++) {
        const yy = Math.min(src.h - 1, Math.floor(y0 + (y + (j + 0.5) / ny) * sy));
        const row = yy * w;
        for (let i = 0; i < nx; i++) {
          const xx = Math.min(w - 1, Math.floor(x0 + (x + (i + 0.5) / nx) * sx));
          const k = (row + xx) * 3;
          r += data[k]; g += data[k+1]; b += data[k+2];
        }
      }
      out[o++] = lut[(r * inv) | 0]; out[o++] = lut[(g * inv) | 0]; out[o++] = lut[(b * inv) | 0];
    }
  }
  return out;
}

// Görüntüden bölge → canvas (texImage2D için)
let _cv = null;
export function imageRegionCanvas(src, x0, y0, rw, rh, outW, outH) {
  if (!_cv) _cv = document.createElement('canvas');
  _cv.width = outW; _cv.height = outH;
  const ctx = _cv.getContext('2d');
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(src.img, x0, y0, rw, rh, 0, 0, outW, outH);
  return _cv;
}
