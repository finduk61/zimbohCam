// zimbohCam — parametreler ve presetler

export const GROUPS = [
  { id: 'ton', label: 'Ton' },
  { id: 'renk', label: 'Renk' },
  { id: 'grain', label: 'Grain' },
  { id: 'isik', label: 'Halation' },
];

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

export const BUILTIN_PRESETS = [
  {
    id: 'b-800t', name: 'Cinestill 800T', builtin: true,
    params: P({
      exposure: 0.1, contrast: 8, highlights: 10, shadows: -6, whites: -6, blacks: 14, vignette: 22,
      temp: -38, tint: -6, saturation: -4, shadowHue: 188, shadowAmt: 28, highHue: 28, highAmt: 10,
      grainAmt: 48, grainSize: 52, grainColor: 30,
      halAmt: 70, halRadius: 42, halHue: 8, halThresh: 42, bloomAmt: 22, bloomRadius: 55,
    }),
  },
  {
    id: 'b-portra', name: 'Portra 400', builtin: true,
    params: P({
      exposure: 0.2, contrast: -18, highlights: -22, shadows: 12, whites: -4, blacks: 10, vignette: 10,
      temp: 14, tint: 4, saturation: -10, shadowHue: 165, shadowAmt: 8, highHue: 38, highAmt: 14,
      grainAmt: 24, grainSize: 36, grainColor: 18,
      halAmt: 6, halRadius: 35, halHue: 18, halThresh: 55, bloomAmt: 8, bloomRadius: 50,
    }),
  },
  {
    id: 'b-trix', name: 'Tri-X 400', builtin: true,
    params: P({
      exposure: 0, contrast: 38, highlights: 6, shadows: -14, whites: 4, blacks: 4, vignette: 26,
      mono: 1, saturation: 0, temp: 8,
      grainAmt: 62, grainSize: 60, grainColor: 0,
      halAmt: 0, bloomAmt: 10, bloomRadius: 45,
    }),
  },
  {
    id: 'b-superia', name: 'Fuji Superia 400', builtin: true,
    params: P({
      exposure: 0.05, contrast: 12, highlights: -6, shadows: -4, whites: 0, blacks: 6, vignette: 14,
      temp: -6, tint: -16, saturation: 8, shadowHue: 150, shadowAmt: 18, highHue: 52, highAmt: 8,
      grainAmt: 36, grainSize: 46, grainColor: 26,
      halAmt: 10, halRadius: 35, halHue: 14, halThresh: 55, bloomAmt: 6,
    }),
  },
  {
    id: 'b-ektachrome', name: 'Ektachrome E100', builtin: true,
    params: P({
      exposure: -0.1, contrast: 30, highlights: 4, shadows: -16, whites: 6, blacks: -10, vignette: 16,
      temp: -10, tint: 0, saturation: 16, shadowHue: 222, shadowAmt: 14, highHue: 45, highAmt: 0,
      grainAmt: 12, grainSize: 26, grainColor: 10,
      halAmt: 0, bloomAmt: 4,
    }),
  },
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
  };
}
