// zimbohCam — parametreler ve presetler

export const GROUPS = [
  { id: 'ton', label: 'Ton' },
  { id: 'renk', label: 'Renk' },
  { id: 'grain', label: 'Grain' },
  { id: 'isik', label: 'Halation' },
];

// Renk karıştırıcı (Lightroom tarzı HSL): renk başına ton kaydırma, doygunluk, parlaklık
export const HSL_COLORS = [
  { id: 'red', label: 'Kırmızı', css: '#e5383b' },
  { id: 'orange', label: 'Turuncu', css: '#f08a24' },
  { id: 'yellow', label: 'Sarı', css: '#f2d024' },
  { id: 'green', label: 'Yeşil', css: '#3fbf4f' },
  { id: 'blue', label: 'Mavi', css: '#2f7fe0' },
  { id: 'purple', label: 'Mor', css: '#9b4fe0' },
];
function HSL_PARAMS() {
  return HSL_COLORS.flatMap(c => [
    { key: `hsl_${c.id}_h`, label: 'Ton kaydırma', group: 'renk', min: -180, max: 180, def: 0, step: 1, hsl: c.id, fmt: v => (v > 0 ? '+' : '') + Math.round(v) + '°' },
    { key: `hsl_${c.id}_s`, label: 'Doygunluk', group: 'renk', min: -100, max: 100, def: 0, step: 1, hsl: c.id },
    { key: `hsl_${c.id}_l`, label: 'Parlaklık', group: 'renk', min: -100, max: 100, def: 0, step: 1, hsl: c.id },
  ]);
}

// Her parametre: anahtar, etiket, grup, min, max, varsayılan (nötr), adım
export const PARAMS = [
  { key: 'exposure',   label: 'Pozlama',        group: 'ton',   min: -3,   max: 3,   def: 0, step: 0.05, fmt: v => (v > 0 ? '+' : '') + v.toFixed(2) + ' EV' },
  { key: 'contrast',   label: 'Kontrast',       group: 'ton',   min: -100, max: 100, def: 0, step: 1 },
  { key: 'highlights', label: 'Vurgular',       group: 'ton',   min: -100, max: 100, def: 0, step: 1 },
  { key: 'shadows',    label: 'Gölgeler',       group: 'ton',   min: -100, max: 100, def: 0, step: 1 },
  { key: 'whites',     label: 'Beyazlar',       group: 'ton',   min: -100, max: 100, def: 0, step: 1 },
  { key: 'blacks',     label: 'Siyahlar',       group: 'ton',   min: -100, max: 100, def: 0, step: 1 },
  { key: 'vignette',   label: 'Vinyet',         group: 'ton',   min: 0,    max: 100, def: 0, step: 1 },

  { key: 'temp',       label: 'Sıcaklık',       group: 'renk',  min: -100, max: 100, def: 0, step: 1 },
  { key: 'tint',       label: 'Yeşil / Mor',    group: 'renk',  min: -100, max: 100, def: 0, step: 1 },
  { key: 'saturation', label: 'Doygunluk',      group: 'renk',  min: -100, max: 100, def: 0, step: 1 },
  { key: 'shadowHue',  label: 'Gölge rengi',    group: 'renk',  min: 0,    max: 360, def: 200, step: 1, hue: true },
  { key: 'shadowAmt',  label: 'Gölge renk gücü',group: 'renk',  min: 0,    max: 100, def: 0, step: 1 },
  { key: 'highHue',    label: 'Vurgu rengi',    group: 'renk',  min: 0,    max: 360, def: 40, step: 1, hue: true },
  { key: 'highAmt',    label: 'Vurgu renk gücü',group: 'renk',  min: 0,    max: 100, def: 0, step: 1 },
  { key: 'mono',       label: 'Siyah-beyaz',    group: 'renk',  min: 0,    max: 1,   def: 0, step: 1, toggle: true },
  ...HSL_PARAMS(),

  { key: 'grainAmt',   label: 'Miktar',         group: 'grain', min: 0,    max: 100, def: 0, step: 1 },
  { key: 'grainSize',  label: 'Boyut',          group: 'grain', min: 0,    max: 100, def: 40, step: 1 },
  { key: 'grainColor', label: 'Renkli grain',   group: 'grain', min: 0,    max: 100, def: 0, step: 1 },

  { key: 'halAmt',     label: 'Halation',       group: 'isik',  min: 0,    max: 100, def: 0, step: 1 },
  { key: 'halRadius',  label: 'Halation yarıçapı', group: 'isik', min: 0,  max: 100, def: 40, step: 1 },
  { key: 'halHue',     label: 'Halation rengi', group: 'isik',  min: 0,    max: 50,  def: 12, step: 1, hue: true },
  { key: 'halThresh',  label: 'Işık eşiği',     group: 'isik',  min: 0,    max: 100, def: 50, step: 1 },
  { key: 'bloomAmt',   label: 'Bloom',          group: 'isik',  min: 0,    max: 100, def: 0, step: 1 },
  { key: 'bloomRadius',label: 'Bloom yarıçapı', group: 'isik',  min: 0,    max: 100, def: 50, step: 1 },
];

export const PARAM_MAP = Object.fromEntries(PARAMS.map(p => [p.key, p]));

export function neutralParams() {
  return Object.fromEntries(PARAMS.map(p => [p.key, p.def]));
}

export function normalizeParams(obj) {
  const out = neutralParams();
  if (obj && typeof obj === 'object') {
    for (const p of PARAMS) {
      const v = Number(obj[p.key]);
      if (Number.isFinite(v)) out[p.key] = Math.min(p.max, Math.max(p.min, v));
    }
  }
  return out;
}

const P = o => normalizeParams(o);
const B = (id, name, cat, o) => ({ id, name, cat, builtin: true, params: P(o) });

export const CATEGORIES = [
  { id: 'neg', label: 'Renkli negatif' },
  { id: 'slide', label: 'Slayt' },
  { id: 'bw', label: 'Siyah-beyaz' },
  { id: 'exp', label: 'Deneysel' },
];

export const DEFAULT_FAVORITES = ['b-800t', 'b-portra', 'b-superia', 'b-ektachrome'];

export const BUILTIN_PRESETS = [
  // --- Renkli negatif ---
  B('b-800t', 'Cinestill 800T', 'neg', {
    exposure: 0.1, contrast: 8, highlights: 10, shadows: -6, whites: -6, blacks: 14, vignette: 22,
    temp: -38, tint: -6, saturation: -4, shadowHue: 188, shadowAmt: 28, highHue: 28, highAmt: 10,
    grainAmt: 48, grainSize: 52, grainColor: 30,
    halAmt: 70, halRadius: 42, halHue: 8, halThresh: 42, bloomAmt: 22, bloomRadius: 55,
  }),
  B('b-portra', 'Portra 400', 'neg', {
    exposure: 0.2, contrast: -18, highlights: -22, shadows: 12, whites: -4, blacks: 10, vignette: 10,
    temp: 14, tint: 4, saturation: -10, shadowHue: 165, shadowAmt: 8, highHue: 38, highAmt: 14,
    grainAmt: 24, grainSize: 36, grainColor: 18,
    halAmt: 6, halRadius: 35, halHue: 18, halThresh: 55, bloomAmt: 8, bloomRadius: 50,
    hsl_orange_s: -8,
  }),
  B('b-superia', 'Fuji Superia 400', 'neg', {
    exposure: 0.05, contrast: 12, highlights: -6, shadows: -4, whites: 0, blacks: 6, vignette: 14,
    temp: -6, tint: -16, saturation: 8, shadowHue: 150, shadowAmt: 18, highHue: 52, highAmt: 8,
    grainAmt: 36, grainSize: 46, grainColor: 26,
    halAmt: 10, halRadius: 35, halHue: 14, halThresh: 55, bloomAmt: 6,
    hsl_green_h: 8, hsl_green_s: 10,
  }),
  B('b-gold', 'Kodak Gold 200', 'neg', {
    exposure: 0.1, contrast: 6, highlights: -10, shadows: 6, whites: -4, blacks: 8, vignette: 15,
    temp: 22, tint: 6, saturation: 4, shadowHue: 40, shadowAmt: 8, highHue: 50, highAmt: 16,
    grainAmt: 30, grainSize: 42, grainColor: 22,
    halAmt: 8, halThresh: 55, bloomAmt: 6,
    hsl_yellow_s: 15, hsl_blue_s: -15, hsl_green_h: -8,
  }),
  B('b-ultramax', 'Kodak Ultramax 400', 'neg', {
    exposure: 0.05, contrast: 18, highlights: -4, shadows: -6, blacks: 6, vignette: 16,
    temp: 14, tint: 4, saturation: 10, shadowHue: 200, shadowAmt: 6, highHue: 40, highAmt: 10,
    grainAmt: 38, grainSize: 48, grainColor: 25,
    halAmt: 10, halThresh: 55, bloomAmt: 6,
    hsl_red_s: 10, hsl_yellow_s: 10,
  }),
  B('b-ektar', 'Kodak Ektar 100', 'neg', {
    contrast: 22, highlights: -8, shadows: -8, blacks: 2, vignette: 10,
    temp: 4, saturation: 30,
    grainAmt: 10, grainSize: 22, grainColor: 8,
    halAmt: 4, bloomAmt: 4,
    hsl_red_s: 15, hsl_blue_s: 20, hsl_blue_l: -15, hsl_orange_s: 5,
  }),
  B('b-portra800', 'Portra 800', 'neg', {
    exposure: 0.15, contrast: -8, highlights: -18, shadows: 10, whites: -6, blacks: 12, vignette: 14,
    temp: 18, tint: 4, saturation: -2, shadowHue: 30, shadowAmt: 10, highHue: 35, highAmt: 14,
    grainAmt: 46, grainSize: 54, grainColor: 30,
    halAmt: 14, halThresh: 50, bloomAmt: 12,
    hsl_orange_s: -8,
  }),
  B('b-pro400h', 'Fuji Pro 400H', 'neg', {
    exposure: 0.3, contrast: -22, highlights: -20, shadows: 14, whites: -8, blacks: 14, vignette: 6,
    temp: -6, tint: -8, saturation: -14, shadowHue: 170, shadowAmt: 22, highHue: 60, highAmt: 6,
    grainAmt: 26, grainSize: 38, grainColor: 16,
    halAmt: 4, bloomAmt: 8,
    hsl_green_h: 12, hsl_green_s: -15, hsl_blue_h: -10, hsl_orange_s: -10,
  }),
  B('b-c200', 'Fujicolor C200', 'neg', {
    contrast: 10, blacks: 8, vignette: 16,
    temp: -10, tint: -12, saturation: -4, shadowHue: 160, shadowAmt: 16, highHue: 55, highAmt: 6,
    grainAmt: 40, grainSize: 48, grainColor: 30,
    halAmt: 6, bloomAmt: 4,
    hsl_green_h: 6, hsl_red_s: -8,
  }),
  B('b-400d', 'CineStill 400D', 'neg', {
    exposure: 0.1, contrast: 4, highlights: -14, shadows: 6, blacks: 10, vignette: 14,
    temp: 16, tint: 2, saturation: 6, shadowHue: 190, shadowAmt: 10, highHue: 30, highAmt: 14,
    grainAmt: 40, grainSize: 48, grainColor: 24,
    halAmt: 60, halRadius: 40, halHue: 10, halThresh: 45, bloomAmt: 18,
  }),
  B('b-50d', 'CineStill 50D', 'neg', {
    contrast: 10, highlights: -6, blacks: 4, vignette: 10,
    temp: -14, tint: -2, saturation: 6, shadowHue: 205, shadowAmt: 10,
    grainAmt: 10, grainSize: 22, grainColor: 6,
    halAmt: 45, halThresh: 50, bloomAmt: 10,
    hsl_blue_s: 10,
  }),
  B('b-phoenix', 'Harman Phoenix 200', 'neg', {
    contrast: 40, highlights: 8, shadows: -14, whites: 4, blacks: 6, vignette: 28,
    temp: 8, tint: 4, saturation: 2, shadowHue: 10, shadowAmt: 8, highHue: 40, highAmt: 10,
    grainAmt: 60, grainSize: 60, grainColor: 40,
    halAmt: 80, halRadius: 50, halHue: 5, halThresh: 38, bloomAmt: 20,
    hsl_red_s: 8, hsl_red_h: -5, hsl_yellow_h: -10,
  }),
  B('b-lomo800', 'Lomography 800', 'neg', {
    exposure: 0.1, contrast: 20, blacks: 4, vignette: 26,
    temp: 6, saturation: 22, shadowHue: 220, shadowAmt: 10, highHue: 40, highAmt: 8,
    grainAmt: 56, grainSize: 58, grainColor: 40,
    halAmt: 18, bloomAmt: 14,
  }),

  // --- Slayt ---
  B('b-ektachrome', 'Ektachrome E100', 'slide', {
    exposure: -0.1, contrast: 30, highlights: 4, shadows: -16, whites: 6, blacks: -10, vignette: 16,
    temp: -10, tint: 0, saturation: 16, shadowHue: 222, shadowAmt: 14, highHue: 45, highAmt: 0,
    grainAmt: 12, grainSize: 26, grainColor: 10,
    halAmt: 0, bloomAmt: 4,
  }),
  B('b-velvia', 'Fuji Velvia 50', 'slide', {
    exposure: -0.15, contrast: 36, highlights: 4, shadows: -18, whites: 6, blacks: -14, vignette: 14,
    temp: -4, tint: 6, saturation: 30, shadowHue: 260, shadowAmt: 10,
    grainAmt: 6, grainSize: 20, grainColor: 4,
    hsl_green_s: 20, hsl_blue_s: 20, hsl_blue_l: -15, hsl_red_s: 10,
  }),
  B('b-provia', 'Fuji Provia 100F', 'slide', {
    contrast: 22, shadows: -8, blacks: -6, vignette: 8,
    temp: -2, saturation: 10,
    grainAmt: 8, grainSize: 20, grainColor: 6,
  }),
  B('b-kodachrome', 'Kodachrome 64', 'slide', {
    exposure: -0.05, contrast: 30, highlights: -4, shadows: -12, whites: 2, blacks: -6, vignette: 16,
    temp: 10, tint: 2, saturation: 14, shadowHue: 210, shadowAmt: 8, highHue: 40, highAmt: 10,
    grainAmt: 14, grainSize: 26, grainColor: 8,
    hsl_red_s: 20, hsl_red_l: -8, hsl_blue_h: -6, hsl_blue_l: -10, hsl_yellow_s: 10, hsl_green_s: -10,
  }),

  // --- Siyah-beyaz ---
  B('b-trix', 'Tri-X 400', 'bw', {
    exposure: 0, contrast: 38, highlights: 6, shadows: -14, whites: 4, blacks: 4, vignette: 26,
    mono: 1, temp: 8,
    grainAmt: 62, grainSize: 60, grainColor: 0,
    bloomAmt: 10, bloomRadius: 45,
  }),
  B('b-hp5', 'Ilford HP5 Plus 400', 'bw', {
    contrast: 18, highlights: -6, shadows: 4, blacks: 6, vignette: 20,
    mono: 1,
    grainAmt: 50, grainSize: 54,
    bloomAmt: 6,
  }),
  B('b-delta3200', 'Ilford Delta 3200', 'bw', {
    exposure: 0.1, contrast: 30, shadows: -10, whites: -4, blacks: 10, vignette: 30,
    mono: 1,
    grainAmt: 90, grainSize: 85,
    bloomAmt: 12,
  }),
  B('b-acros', 'Fuji Acros 100', 'bw', {
    contrast: 14, highlights: -10, shadows: 6, blacks: 2, vignette: 12,
    mono: 1,
    grainAmt: 12, grainSize: 22,
    hsl_red_l: -10, hsl_blue_l: 5,
  }),
  B('b-panf', 'Ilford Pan F 50', 'bw', {
    contrast: 34, highlights: 6, shadows: -10, whites: 8, blacks: -4, vignette: 16,
    mono: 1,
    grainAmt: 10, grainSize: 20,
  }),

  // --- Deneysel ---
  B('b-lomopurple', 'Lomochrome Purple', 'exp', {
    contrast: 18, blacks: 6, vignette: 18,
    temp: 6, tint: 14, saturation: 10,
    grainAmt: 40, grainSize: 46, grainColor: 30,
    hsl_green_h: 170, hsl_green_s: 10, hsl_blue_h: -100, hsl_yellow_h: -80, hsl_orange_h: -20,
  }),
  B('b-redscale', 'Redscale', 'exp', {
    exposure: 0, contrast: 40, shadows: -10, blacks: -4, vignette: 30,
    temp: 100, tint: -6, saturation: 25, shadowHue: 8, shadowAmt: 55, highHue: 32, highAmt: 55,
    grainAmt: 50, grainSize: 50, grainColor: 20,
    hsl_blue_s: -100, hsl_blue_l: -60, hsl_green_s: -70, hsl_green_l: -30, hsl_purple_s: -80,
  }),
  B('b-xpro', 'Cross-process', 'exp', {
    contrast: 45, highlights: 10, shadows: -20, blacks: -6, vignette: 20,
    temp: -6, tint: -20, saturation: 24, shadowHue: 220, shadowAmt: 26, highHue: 60, highAmt: 30,
    grainAmt: 28, grainSize: 40, grainColor: 20,
    hsl_yellow_s: 20, hsl_blue_h: -15,
  }),
  B('b-polaroid', 'Polaroid 600', 'exp', {
    exposure: 0.25, contrast: -20, highlights: -26, shadows: 12, whites: -14, blacks: 20, vignette: 34,
    temp: 8, tint: 6, saturation: -18, shadowHue: 190, shadowAmt: 18, highHue: 45, highAmt: 20,
    grainAmt: 20, grainSize: 40, grainColor: 10,
    bloomAmt: 14,
  }),
];

const KEY = 'zimbohcam.presets.v1';

function safeGet(k) { try { return localStorage.getItem(k); } catch { return null; } }
function safeSet(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

export function loadUserPresets() {
  try {
    const arr = JSON.parse(safeGet(KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(p => p && p.id && p.name).map(p => ({ id: String(p.id), name: String(p.name).slice(0, 40), builtin: false, params: normalizeParams(p.params) }));
  } catch { return []; }
}

export function saveUserPresets(list) {
  return safeSet(KEY, JSON.stringify(list.filter(p => !p.builtin).map(({ id, name, params }) => ({ id, name, params }))));
}

const FKEY = 'zimbohcam.favorites.v1';
export function loadFavorites() {
  try { const a = JSON.parse(safeGet(FKEY) || 'null'); if (Array.isArray(a) && a.length) return a.map(String); } catch {}
  return [...DEFAULT_FAVORITES];
}
export function saveFavorites(list) { return safeSet(FKEY, JSON.stringify(list)); }

export function allPresets() {
  return [...BUILTIN_PRESETS, ...loadUserPresets()];
}

export function newId() {
  return 'u-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
}

export function exportPresetsJSON(list) {
  return JSON.stringify({
    app: 'zimbohCam', version: 1,
    presets: list.filter(p => !p.builtin).map(({ name, params }) => ({ name, params })),
  }, null, 2);
}

export function parseImportedPresets(text) {
  const data = JSON.parse(text);
  const arr = Array.isArray(data) ? data : data.presets;
  if (!Array.isArray(arr)) throw new Error('Geçersiz preset dosyası');
  return arr.filter(p => p && p.name).map(p => ({ id: newId(), name: String(p.name).slice(0, 40), builtin: false, params: normalizeParams(p.params) }));
}

export function paramsEqual(a, b) {
  return PARAMS.every(p => Math.abs((a[p.key] ?? p.def) - (b[p.key] ?? p.def)) < 1e-6);
}

// Ayarları WebGL için gerçek değerlere çevir
function hsv(h, s, v) {
  h = ((h % 360) + 360) % 360 / 60;
  const c = v * s, x = c * (1 - Math.abs(h % 2 - 1)), m = v - c;
  let r = 0, g = 0, b = 0;
  if (h < 1) [r, g, b] = [c, x, 0]; else if (h < 2) [r, g, b] = [x, c, 0];
  else if (h < 3) [r, g, b] = [0, c, x]; else if (h < 4) [r, g, b] = [0, x, c];
  else if (h < 5) [r, g, b] = [x, 0, c]; else [r, g, b] = [c, 0, x];
  return [r + m, g + m, b + m];
}
function chromaOf(rgb) {
  const L = 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2];
  return rgb.map(c => c - L);
}

export function toUniforms(p) {
  const t = p.temp / 100, ti = p.tint / 100;
  let wb = [Math.exp(0.42 * t), Math.exp(-0.3 * ti), Math.exp(-0.42 * t)];
  const wl = 0.2126 * wb[0] + 0.7152 * wb[1] + 0.0722 * wb[2];
  wb = wb.map(v => v / wl);
  return {
    exposure: Math.pow(2, p.exposure),
    wb,
    contrastK: Math.pow(2, p.contrast / 100 * 1.25),
    lo: 6.5 * Math.pow(2, p.shadows / 100 * 0.55),
    hi: 4.5 * Math.pow(2, -p.highlights / 100 * 0.55),
    blacks: p.blacks / 100,
    whites: p.whites / 100,
    vignette: p.vignette / 100 * 0.85,
    sat: 1 + p.saturation / 100,
    mono: p.mono >= 0.5 ? 1 : 0,
    shadowTint: chromaOf(hsv(p.shadowHue, 1, 1)).map(c => c * p.shadowAmt / 100 * 0.32),
    highTint: chromaOf(hsv(p.highHue, 1, 1)).map(c => c * p.highAmt / 100 * 0.28),
    grainAmt: p.grainAmt / 100 * 0.16,
    grainSize: 0.55 * Math.pow(2, p.grainSize / 100 * 2.4),
    grainColor: p.grainColor / 100,
    halAmt: p.halAmt / 100 * 1.6,
    halSigma: 0.003 + p.halRadius / 100 * 0.035,
    halColor: hsv(p.halHue, 0.97, 1),
    halThresh: 0.18 * Math.pow(2, 1.0 + p.halThresh / 100 * 3.2),
    bloomAmt: p.bloomAmt / 100 * 0.7,
    bloomSigma: 0.015 + p.bloomRadius / 100 * 0.09,
    hslH: HSL_COLORS.map(c => p[`hsl_${c.id}_h`]),
    hslS: HSL_COLORS.map(c => p[`hsl_${c.id}_s`] / 100),
    hslL: HSL_COLORS.map(c => p[`hsl_${c.id}_l`] / 100),
    hslOn: HSL_COLORS.some(c => p[`hsl_${c.id}_h`] || p[`hsl_${c.id}_s`] || p[`hsl_${c.id}_l`]) ? 1 : 0,
  };
}
