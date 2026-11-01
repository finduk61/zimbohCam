// zimbohCam — uygulama
import { FilmEngine } from './engine.js';
import {
  GROUPS, PARAMS, PARAM_MAP, BUILTIN_PRESETS, neutralParams, normalizeParams,
  loadUserPresets, saveUserPresets, newId, exportPresetsJSON, parseImportedPresets,
  paramsEqual, toUniforms, CATEGORIES, HSL_COLORS, loadFavorites, saveFavorites, DEFAULT_FAVORITES,
} from './presets.js';
import { Camera, NUMERIC_CAPS, MODE_CAPS } from './camera.js';
import { isRawFile, decodeRaw, decodeImage, autoGain, rawRegionHalf, imageRegionCanvas } from './raw.js';
import * as store from './store.js';

const VERSION = '1.1.0';
const $ = id => document.getElementById(id);
const app = $('app'), stage = $('stage'), canvas = $('view'), video = $('video');

// ---------- Ayarlar ----------
const SKEY = 'zimbohcam.settings.v1';
function readJSON(k) { try { return JSON.parse(localStorage.getItem(k) || 'null') || {}; } catch { return {}; } }
const settings = Object.assign({
  saveOriginal: false, autoShare: false, streamRes: 'max', jpegQ: 92,
  exportSize: 'full', rawMode: 'full', lastPreset: 'b-800t', lastParams: null,
}, readJSON(SKEY));
let persistT = 0;
function persist(now) {
  clearTimeout(persistT);
  const run = () => { try { localStorage.setItem(SKEY, JSON.stringify(settings)); } catch {} };
  if (now) run(); else persistT = setTimeout(run, 400);
}

// ---------- Durum ----------
let mode = 'camera';
let fx = true;
let presets = [...BUILTIN_PRESETS, ...loadUserPresets()];
let activeId = presets.some(p => p.id === settings.lastPreset) ? settings.lastPreset : 'b-800t';
let params = settings.lastParams ? normalizeParams(settings.lastParams) : { ...activePreset().params };
let U = toUniforms(params);
let panelTab = 'ton';
let hslSel = 'red';
let favorites = loadFavorites().filter(id => presets.some(p => p.id === id));
if (!favorites.length) favorites = [...DEFAULT_FAVORITES];

function activePreset() { return presets.find(p => p.id === activeId) || BUILTIN_PRESETS[0]; }

// ---------- Motor ----------
let engine = null;
try { engine = new FilmEngine(canvas); }
catch (e) {
  stage.innerHTML = `<div class="placeholder"><h2>Başlatılamadı</h2><p>${esc(e.message)}</p></div>`;
}
const cam = new Camera(video);

function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }

// ---------- Yardımcılar ----------
let toastT = 0;
function toast(msg, action, fn, ms = 3200) {
  const t = $('toast');
  t.innerHTML = `<span>${esc(msg)}</span>` + (action ? `<button>${esc(action)}</button>` : '');
  t.hidden = false;
  if (action) t.querySelector('button').onclick = () => { t.hidden = true; fn(); };
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, action ? Math.max(ms, 6000) : ms);
}
function busy(on, text, prog) {
  $('busy').hidden = !on;
  if (text != null) $('busyText').textContent = text;
  $('busyBar').parentElement.style.display = prog == null ? 'none' : '';
  if (prog != null) $('busyBar').style.width = Math.round(prog * 100) + '%';
}
function stamp(d = new Date()) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}
function freeCanvas(c) { if (c) { c.width = 0; c.height = 0; } }
function canvasToBlob(c, q) { return new Promise(res => c.toBlob(b => res(b), 'image/jpeg', q)); }

async function shareFiles(files) {
  try {
    if (navigator.canShare && navigator.canShare({ files })) {
      await navigator.share({ files });
      return 'shared';
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return 'cancel';
    if (e && e.name === 'NotAllowedError') return 'needtap';
    throw e;
  }
  for (const f of files) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(f); a.download = f.name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 20000);
  }
  return 'downloaded';
}
function downloadBlob(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 20000);
}

// Canvas'ı sahneye sığdır
function fitCanvas(aspect, maxW, maxH, fill) {
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  let cw = r.width, ch = r.width / aspect;
  if (ch > r.height) { ch = r.height; cw = ch * aspect; }
  if (fill) { cw = r.width; ch = r.height; }
  const pw = Math.max(1, Math.min(Math.round(cw * dpr), Math.round(maxW)));
  const ph = Math.max(1, Math.min(Math.round(ch * dpr), Math.round(maxH)));
  if (canvas.width !== pw) canvas.width = pw;
  if (canvas.height !== ph) canvas.height = ph;
  const sw = cw + 'px', sh = ch + 'px';
  if (canvas.style.width !== sw) canvas.style.width = sw;
  if (canvas.style.height !== sh) canvas.style.height = sh;
}

// ---------- Mod geçişi ----------
function setMode(m) {
  mode = m;
  app.classList.toggle('mode-camera', m === 'camera');
  app.classList.toggle('mode-edit', m === 'edit');
  document.querySelectorAll('#modeSeg button').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  if (m === 'camera') {
    $('editEmpty').hidden = true;
    canvas.style.transform = cam.facingFront ? 'scaleX(-1)' : '';
    startCamera();
  } else {
    cam.stop();
    $('camStart').hidden = true;
    canvas.style.transform = '';
    $('editEmpty').hidden = !!ed;
    canvas.style.visibility = ed ? 'visible' : 'hidden';
    if (ed) scheduleRender();
  }
  if (panelTab === 'cam' && m !== 'camera') panelTab = 'ton';
  if (!$('panel').hidden) renderPanel();
  updateHud();
}
document.querySelectorAll('#modeSeg button').forEach(b => b.onclick = () => { if (b.dataset.mode !== mode) setMode(b.dataset.mode); });

// ---------- FX aç/kapat ----------
$('fxBtn').onclick = () => {
  fx = !fx;
  $('fxBtn').classList.toggle('on', fx);
  $('fxBtn').setAttribute('aria-pressed', String(fx));
  $('fxLabel').textContent = fx ? 'FX AÇIK' : 'FX KAPALI';
  app.classList.toggle('fx-off', !fx);
  if (mode === 'edit') scheduleRender();
};

// ---------- Kamera ----------
let loopOn = false, camFrame = 0, capturing = false;

async function startCamera() {
  if (!engine) return;
  canvas.style.visibility = 'visible';
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showCamMsg('Bu tarayıcı kamera erişimi vermiyor. Uygulamayı Safari ile https adresinden aç.', false);
    return;
  }
  try {
    $('camStart').hidden = true;
    cam.resolution = settings.streamRes;
    await cam.start(cam.lens);
    if (mode !== 'camera') { cam.stop(); return; }
    canvas.style.transform = cam.facingFront ? 'scaleX(-1)' : '';
    renderLenses();
    updateHud();
    if (!loopOn) { loopOn = true; camLoop(); }
    if (!$('panel').hidden && panelTab === 'cam') renderPanel();
  } catch (e) {
    const denied = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError');
    showCamMsg(denied
      ? 'Kamera izni verilmedi. iPhone Ayarlar → Safari → Kamera → "İzin Ver" seçip tekrar dene.'
      : 'Kamera açılamadı: ' + (e && e.message || e), true);
  }
}
function showCamMsg(msg, retry) {
  $('camMsg').textContent = msg;
  $('camStartBtn').hidden = !retry;
  $('camStart').hidden = false;
}
$('camStartBtn').onclick = () => startCamera();

function camLoop() {
  if (mode !== 'camera' || !cam.stream) { loopOn = false; return; }
  const v = video;
  if (v.readyState >= 2 && v.videoWidth) {
    const vw = v.videoWidth, vh = v.videoHeight;
    const crop = cam.cropRect();
    const cw = crop[2] * vw, ch = crop[3] * vh;
    fitCanvas(cw / ch, cw, ch);
    engine.uploadDisplay(v);
    engine.render({
      src: { tex: engine.srcTex, linear: false, rect: [0, 0, 1, 1] },
      dst: crop, full: [vw, vh], grainRef: Math.min(cw, ch),
      outW: canvas.width, outH: canvas.height, u: U, fx, seed: ++camFrame, flipY: true, imgRect: crop,
    });
  }
  if ('requestVideoFrameCallback' in v) v.requestVideoFrameCallback(camLoop);
  else requestAnimationFrame(camLoop);
}

const LENS_LABEL = { '13': '13', '24': '24', '48': '48', '120': '120', front: 'Ön' };
function renderLenses() {
  const el = $('lenses');
  const list = [...cam.availableLenses()];
  el.innerHTML = list.map(l => `<button class="lens ${cam.lens === l ? 'on' : ''}" data-l="${l}">${LENS_LABEL[l]}${l !== 'front' ? '<small>mm</small>' : ''}</button>`).join('')
    + `<button class="lens ${cam.lens === 'front' ? 'on' : ''}" data-l="front">Ön</button>`;
  el.querySelectorAll('.lens').forEach(b => b.onclick = () => switchLens(b.dataset.l));
}
async function switchLens(l) {
  if (l === cam.lens) return;
  const sameDevice = (a, b) => ['24', '48'].includes(a) && ['24', '48'].includes(b);
  if (sameDevice(cam.lens, l) && cam.stream) {
    cam.lens = l;
    await cam.setZoom(l === '48' ? 2 : 1);
  } else {
    try { await cam.start(l); } catch (e) { toast('Lens açılamadı: ' + (e.message || e)); }
  }
  canvas.style.transform = cam.facingFront ? 'scaleX(-1)' : '';
  renderLenses(); updateHud();
  if (!$('panel').hidden && panelTab === 'cam') renderPanel();
}

function updateHud() {
  const h = $('hud');
  if (mode === 'camera' && cam.stream) {
    const z = cam.lens === 'front' ? '' : cam.hwZoom ? `${cam.hwZoom}x` : cam.digitalZoom > 1 ? `${cam.digitalZoom}x kırp` : '';
    const lens = cam.lens === 'front' ? 'ÖN' : cam.lens + 'mm';
    h.textContent = `${lens}  ${video.videoWidth}×${video.videoHeight}${z ? '  ' + z : ''}`;
  } else if (mode === 'edit' && ed) {
    const mp = (ed.src.w * ed.src.h / 1e6).toFixed(1);
    h.textContent = `${ed.src.kind === 'raw' ? 'RAW' : 'IMG'}  ${ed.src.w}×${ed.src.h}  ${mp}MP${ed.zoom ? '  1:1' : ''}`;
  } else h.textContent = '';
}

// Çekim
async function capture() {
  if (capturing || !cam.stream || !video.videoWidth) return;
  capturing = true;
  $('shutter').classList.add('busy');
  const fl = $('flash'); fl.classList.add('on'); setTimeout(() => fl.classList.remove('on'), 60);
  let c1 = null, c2 = null, c3 = null;
  try {
    const v = video, vw = v.videoWidth, vh = v.videoHeight, crop = cam.cropRect();
    const cx = Math.round(crop[0] * vw), cy = Math.round(crop[1] * vh);
    const cw = Math.round(crop[2] * vw), ch = Math.round(crop[3] * vh);
    const mirror = cam.facingFront;
    // orijinal kare
    c2 = document.createElement('canvas'); c2.width = cw; c2.height = ch;
    const x2 = c2.getContext('2d');
    if (mirror) { x2.translate(cw, 0); x2.scale(-1, 1); }
    x2.drawImage(v, cx, cy, cw, ch, 0, 0, cw, ch);
    // işlenmiş kare
    engine.uploadDisplay(c2);
    const t = engine.makeTarget(cw, ch);
    engine.render({
      src: { tex: engine.srcTex, linear: false, rect: [0, 0, 1, 1] },
      dst: [0, 0, 1, 1], full: [cw, ch], grainRef: Math.min(cw, ch),
      outW: cw, outH: ch, target: t, u: U, fx, seed: (Math.random() * 1e9) | 0, flipY: false,
    });
    const px = engine.readTarget(t);
    engine.freeTarget(t);
    c1 = document.createElement('canvas'); c1.width = cw; c1.height = ch;
    c1.getContext('2d').putImageData(new ImageData(new Uint8ClampedArray(px.buffer), cw, ch), 0, 0);
    const q = settings.jpegQ / 100;
    const blob = await canvasToBlob(c1, q);
    const orig = await canvasToBlob(c2, q);
    if (!blob) throw new Error('JPEG oluşturulamadı');
    // küçük resim
    c3 = document.createElement('canvas');
    const ts = 240 / Math.max(cw, ch);
    c3.width = Math.round(cw * ts); c3.height = Math.round(ch * ts);
    c3.getContext('2d').drawImage(c1, 0, 0, c3.width, c3.height);
    const thumb = await canvasToBlob(c3, 0.8);
    const shot = {
      id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
      time: Date.now(), w: cw, h: ch, blob, orig, thumb,
      preset: fx ? (activePreset().name + (paramsEqual(params, activePreset().params) ? '' : ' (düzenli)')) : 'Orijinal',
      saved: false,
    };
    await store.addShot(shot);
    refreshRoll();
    if (settings.autoShare) {
      const r = await shareFiles(shotFiles(shot)).catch(() => 'err');
      if (r === 'shared' || r === 'downloaded') { await store.updateShot(shot.id, { saved: true }); refreshRoll(); }
      else if (r === 'needtap') toast('Fotoğraf hazır', 'Kaydet', () => saveShots([shot]));
    }
  } catch (e) {
    toast('Çekim başarısız: ' + (e.message || e));
  } finally {
    freeCanvas(c1); freeCanvas(c2); freeCanvas(c3);
    capturing = false;
    $('shutter').classList.remove('busy');
  }
}
$('shutter').onclick = capture;
document.addEventListener('keydown', e => { if ((e.key === ' ' || e.key === 'Enter') && mode === 'camera' && $('modal').hidden && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); capture(); } });

function shotFiles(shot) {
  const base = 'zimboh_' + stamp(new Date(shot.time));
  const files = [new File([shot.blob], base + '.jpg', { type: 'image/jpeg' })];
  if (settings.saveOriginal && shot.orig) files.push(new File([shot.orig], base + '_orijinal.jpg', { type: 'image/jpeg' }));
  return files;
}
async function saveShots(shots) {
  const files = shots.flatMap(shotFiles);
  const r = await shareFiles(files).catch(e => { toast('Kaydedilemedi: ' + (e.message || e)); return 'err'; });
  if (r === 'shared' || r === 'downloaded') {
    for (const s of shots) await store.updateShot(s.id, { saved: true });
    refreshRoll();
    return true;
  }
  if (r === 'needtap') toast('Kaydetmek için tekrar dokun', 'Kaydet', () => saveShots(shots));
  return false;
}

// ---------- Film rulosu ----------
let rollUrl = null;
async function refreshRoll() {
  const shots = await store.listShots().catch(() => []);
  const img = $('rollThumb');
  if (rollUrl) { URL.revokeObjectURL(rollUrl); rollUrl = null; }
  if (shots[0] && shots[0].thumb) { rollUrl = URL.createObjectURL(shots[0].thumb); img.src = rollUrl; }
  else img.removeAttribute('src');
  const unsaved = shots.filter(s => !s.saved).length;
  $('rollBadge').hidden = !unsaved;
  $('rollBadge').textContent = unsaved;
  return shots;
}
$('rollBtn').onclick = openRoll;

async function openRoll() {
  const shots = await store.listShots().catch(() => []);
  const urls = [];
  const sel = new Set(shots.filter(s => !s.saved).map(s => s.id));
  const body = openModal('Film rulosu');
  const draw = () => {
    urls.forEach(u => URL.revokeObjectURL(u)); urls.length = 0;
    if (!shots.length) { body.innerHTML = `<p class="note">Henüz çekim yok. Çektiğin kareler, sen kaydedene ya da silene kadar burada durur.</p>`; return; }
    body.innerHTML = `
      <p class="note">Kareler bu telefonda saklanır. Seçip <b>Kaydet</b>'e bastığında paylaşım menüsünden <b>"Resmi Kaydet"</b> ile Fotoğraflar'a ekleyebilirsin.</p>
      <div class="btnrow"><button class="btn small" id="rAll">${sel.size === shots.length ? 'Seçimi kaldır' : 'Tümünü seç'}</button></div>
      <div class="grid">${shots.map(s => {
        const u = URL.createObjectURL(s.thumb || s.blob); urls.push(u);
        return `<div class="cell ${sel.has(s.id) ? 'sel' : ''}" data-id="${s.id}"><img src="${u}" alt="">${s.saved ? '<span class="ok">KAYDEDİLDİ</span>' : ''}<span class="check"></span></div>`;
      }).join('')}</div>
      <div class="btnrow">
        <button class="btn primary" id="rSave" ${sel.size ? '' : 'disabled'}>Kaydet (${sel.size})</button>
        <button class="btn" id="rEdit" ${sel.size === 1 ? '' : 'disabled'}>Düzenle</button>
        <button class="btn danger" id="rDel" ${sel.size ? '' : 'disabled'}>Sil</button>
      </div>`;
    body.querySelectorAll('.cell').forEach(c => c.onclick = () => { const id = c.dataset.id; sel.has(id) ? sel.delete(id) : sel.add(id); draw(); });
    $('rAll').onclick = () => { if (sel.size === shots.length) sel.clear(); else shots.forEach(s => sel.add(s.id)); draw(); };
    $('rSave').onclick = async () => {
      const list = shots.filter(s => sel.has(s.id));
      if (await saveShots(list)) { list.forEach(s => { s.saved = true; }); sel.clear(); draw(); }
    };
    $('rEdit').onclick = async () => {
      const s = shots.find(s => sel.has(s.id));
      closeModal();
      setMode('edit');
      await openFile(new File([s.orig || s.blob], 'zimboh_' + stamp(new Date(s.time)) + '.jpg', { type: 'image/jpeg' }));
    };
    $('rDel').onclick = async () => {
      const unsaved = shots.filter(s => sel.has(s.id) && !s.saved).length;
      if (unsaved && !confirm(`${unsaved} kaydedilmemiş kare silinecek. Emin misin?`)) return;
      await store.deleteShots([...sel]);
      for (let i = shots.length - 1; i >= 0; i--) if (sel.has(shots[i].id)) shots.splice(i, 1);
      sel.clear(); draw(); refreshRoll();
    };
  };
  draw();
  modalCleanup = () => urls.forEach(u => URL.revokeObjectURL(u));
}

// ---------- Düzenleme modu ----------
let ed = null; // { src, prevTex, pw, ph, zoom, cx, cy, regionTex, regionKey, name }
let renderQueued = false;
function scheduleRender() {
  if (renderQueued) return;
  renderQueued = true;
  requestAnimationFrame(() => { renderQueued = false; if (mode === 'edit') renderEdit(); });
}

$('openRawBtn').onclick = () => $('fileRaw').click();
$('openImgBtn').onclick = () => $('fileImg').click();
$('openBtn').onclick = () => openChooser();
$('fileRaw').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f, true); };
$('fileImg').onchange = e => { const f = e.target.files[0]; e.target.value = ''; if (f) openFile(f); };

function openChooser() {
  const body = openModal('Fotoğraf aç');
  body.innerHTML = `
    <div class="col" style="max-width:none">
      <button class="btn primary" id="cRaw">ProRAW / DNG aç</button>
      <button class="btn" id="cImg">Galeriden fotoğraf aç</button>
    </div>
    <p class="note">ProRAW için dosyayı Fotoğraflar'dan "Dosyalar'a Kaydet" ile kaydet, sonra "Dosyalara Göz At" ile seç. Galeriden seçilen fotoğrafları iPhone JPEG'e çevirebilir.</p>`;
  $('cRaw').onclick = () => { closeModal(); $('fileRaw').click(); };
  $('cImg').onclick = () => { closeModal(); $('fileImg').click(); };
}

async function openFile(file, expectRaw = false) {
  if (!engine) return;
  busy(true, 'Açılıyor…');
  try {
    let src = null, note = '';
    if (isRawFile(file)) {
      if (!self.crossOriginIsolated) {
        note = 'ProRAW motoru henüz hazır değil (uygulamayı kapatıp yeniden aç). Şimdilik iPhone\'un kendi dönüştürmesi kullanıldı.';
      } else {
        const half = settings.rawMode === 'half';
        try {
          src = await decodeRaw(file, { half, onStage: t => busy(true, t) });
        } catch (e) {
          if (!half) {
            try {
              busy(true, 'Tam çözünürlük açılamadı, hızlı mod deneniyor…');
              src = await decodeRaw(file, { half: true });
              note = 'Bellek yetmediği için RAW yarı çözünürlükte açıldı.';
            } catch (e2) { src = null; note = 'Bu RAW dosyası çözülemedi (' + (e2.message || e2) + '). iPhone\'un kendi dönüştürmesi kullanıldı.'; }
          } else note = 'Bu RAW dosyası çözülemedi. iPhone\'un kendi dönüştürmesi kullanıldı.';
        }
      }
      if (src) { busy(true, 'Önizleme hazırlanıyor…'); await new Promise(r => setTimeout(r, 20)); src.gain = autoGain(src); }
    }
    if (!src) src = await decodeImage(file);
    if (Math.max(src.w, src.h) > 16384) throw new Error('Görüntü çok büyük');
    loadEditSource(src, file.name);
    if (note) toast(note, null, null, 6000);
    else if (expectRaw && src.kind !== 'raw') toast('Seçilen dosya RAW değil (iPhone JPEG/HEIC\'e çevirmiş olabilir). Orijinal DNG için Dosyalar uygulamasından seç.', null, null, 6000);
  } catch (e) {
    toast('Dosya açılamadı: ' + (e.message || e), null, null, 5000);
  } finally {
    busy(false);
  }
}

function loadEditSource(src, name) {
  if (ed) {
    engine.deleteTexture(ed.prevTex);
    if (ed.regionTex) engine.deleteTexture(ed.regionTex);
    if (ed.src.url) URL.revokeObjectURL(ed.src.url);
  }
  const maxP = Math.min(2560, engine.maxTex);
  const s = Math.min(1, maxP / Math.max(src.w, src.h));
  const pw = Math.max(1, Math.round(src.w * s)), ph = Math.max(1, Math.round(src.h * s));
  const prevTex = engine.createTexture();
  if (src.kind === 'raw') engine.uploadHalfRGB(rawRegionHalf(src, 0, 0, src.w, src.h, pw, ph), pw, ph, prevTex);
  else engine.uploadDisplay(imageRegionCanvas(src, 0, 0, src.w, src.h, pw, ph), prevTex);
  ed = { src, prevTex, pw, ph, zoom: false, cx: src.w / 2, cy: src.h / 2, regionTex: null, regionKey: '', name: name || 'foto' };
  $('editEmpty').hidden = true;
  canvas.style.visibility = 'visible';
  setZoom(false);
  updateHud();
  scheduleRender();
}

function renderEdit() {
  if (!ed || !engine) return;
  const { src } = ed;
  const linear = src.kind === 'raw';
  const full = [src.w, src.h], grainRef = Math.min(src.w, src.h);
  if (!ed.zoom) {
    fitCanvas(src.w / src.h, ed.pw, ed.ph);
    engine.render({
      src: { tex: ed.prevTex, linear, gain: src.gain, rect: [0, 0, 1, 1] },
      dst: [0, 0, 1, 1], lowRect: [0, 0, 1, 1], full, grainRef,
      outW: canvas.width, outH: canvas.height, u: U, fx, seed: 777, flipY: true,
    });
    return;
  }
  const r = stage.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 3);
  const cw = Math.min(Math.round(r.width * dpr), src.w), ch = Math.min(Math.round(r.height * dpr), src.h);
  fitCanvas(cw / ch, cw, ch);
  const w = canvas.width, h = canvas.height;
  ed.cx = Math.min(src.w - w / 2, Math.max(w / 2, ed.cx));
  ed.cy = Math.min(src.h - h / 2, Math.max(h / 2, ed.cy));
  const x0 = Math.round(ed.cx - w / 2), y0 = Math.round(ed.cy - h / 2);
  const key = `${x0},${y0},${w},${h}`;
  if (!ed.regionTex) ed.regionTex = engine.createTexture();
  if (ed.regionKey !== key) {
    if (linear) engine.uploadHalfRGB(rawRegionHalf(src, x0, y0, w, h, w, h), w, h, ed.regionTex);
    else engine.uploadDisplay(imageRegionCanvas(src, x0, y0, w, h, w, h), ed.regionTex);
    ed.regionKey = key;
  }
  const rect = [x0 / src.w, y0 / src.h, w / src.w, h / src.h];
  engine.render({
    src: { tex: ed.regionTex, linear, gain: src.gain, rect },
    lowSrc: { tex: ed.prevTex, linear, gain: src.gain, rect: [0, 0, 1, 1] },
    dst: rect, lowRect: [0, 0, 1, 1], full, grainRef,
    outW: w, outH: h, u: U, fx, seed: 777, flipY: true,
  });
}

function setZoom(on, atX, atY) {
  if (!ed) return;
  ed.zoom = on;
  if (on && atX != null) { ed.cx = atX; ed.cy = atY; }
  $('zoomBtn').classList.toggle('on', on);
  $('zoomLabel').textContent = on ? 'Sığdır' : '1:1';
  updateHud();
  scheduleRender();
}
$('zoomBtn').onclick = () => { if (ed) setZoom(!ed.zoom); else toast('Önce bir fotoğraf aç'); };

// Sürükle (1:1) ve çift dokunma
let drag = null, lastTap = 0;
stage.addEventListener('pointerdown', e => {
  if (mode !== 'edit' || !ed) return;
  const now = Date.now();
  if (now - lastTap < 300) {
    lastTap = 0;
    const cr = canvas.getBoundingClientRect();
    if (!ed.zoom) {
      const fx_ = (e.clientX - cr.left) / cr.width, fy_ = (e.clientY - cr.top) / cr.height;
      setZoom(true, fx_ * ed.src.w, fy_ * ed.src.h);
    } else setZoom(false);
    return;
  }
  lastTap = now;
  if (!ed.zoom) return;
  drag = { x: e.clientX, y: e.clientY };
  stage.setPointerCapture(e.pointerId);
});
stage.addEventListener('pointermove', e => {
  if (!drag || !ed || !ed.zoom) return;
  const cr = canvas.getBoundingClientRect();
  const k = canvas.width / cr.width;
  ed.cx -= (e.clientX - drag.x) * k;
  ed.cy -= (e.clientY - drag.y) * k;
  drag = { x: e.clientX, y: e.clientY };
  scheduleRender();
});
stage.addEventListener('pointerup', () => { drag = null; });
stage.addEventListener('pointercancel', () => { drag = null; });

// Dışa aktarma
$('exportBtn').onclick = () => { if (ed) exportEdit(); else toast('Önce bir fotoğraf aç'); };

async function exportEdit() {
  const { src } = ed;
  const total = src.w * src.h;
  const target = settings.exportSize === 'full' ? total : settings.exportSize === '24' ? 24e6 : 12e6;
  let s = Math.min(1, Math.sqrt(target / total));
  if (src.w * s > engine.maxTex) s = engine.maxTex / src.w;
  const W = Math.round(src.w * s), H = Math.round(src.h * s);
  const SH = 256;
  const linear = src.kind === 'raw';
  busy(true, `Kaydediliyor ${W}×${H}…`, 0);
  const worker = new Worker('js/jpeg-worker.js');
  let resolveMsg = null, rejectMsg = null;
  worker.onmessage = e => { if (e.data.cmd === 'error') rejectMsg && rejectMsg(new Error(e.data.message)); else resolveMsg && resolveMsg(e.data); };
  worker.onerror = e => rejectMsg && rejectMsg(new Error(e.message || 'Kodlayıcı hatası'));
  const call = (msg, transfer) => new Promise((res, rej) => { resolveMsg = res; rejectMsg = rej; worker.postMessage(msg, transfer || []); });
  const stripTex = engine.createTexture();
  let tgt = null;
  try {
    await call({ cmd: 'start', w: W, h: H, quality: settings.jpegQ });
    for (let y = 0; y < H; y += SH) {
      const sh = Math.min(SH, H - y);
      const fy0 = y / H * src.h, fh = sh / H * src.h;
      if (linear) engine.uploadHalfRGB(rawRegionHalf(src, 0, fy0, src.w, fh, W, sh), W, sh, stripTex);
      else engine.uploadDisplay(imageRegionCanvas(src, 0, fy0, src.w, fh, W, sh), stripTex);
      if (!tgt || tgt.h !== sh) { if (tgt) engine.freeTarget(tgt); tgt = engine.makeTarget(W, sh); }
      const rect = [0, y / H, 1, sh / H];
      engine.render({
        src: { tex: stripTex, linear, gain: src.gain, rect },
        lowSrc: { tex: ed.prevTex, linear, gain: src.gain, rect: [0, 0, 1, 1] },
        dst: rect, lowRect: [0, 0, 1, 1], full: [src.w, src.h], grainRef: Math.min(src.w, src.h),
        outW: W, outH: sh, target: tgt, u: U, fx, seed: 777, flipY: false, reuseLow: y > 0,
      });
      const px = engine.readTarget(tgt);
      await call({ cmd: 'rows', data: px.buffer, rows: sh }, [px.buffer]);
      busy(true, `Kaydediliyor ${W}×${H}…`, (y + sh) / H * 0.97);
    }
    const res = await call({ cmd: 'finish' });
    busy(false);
    showExportResult(res.blob, W, H);
  } catch (e) {
    busy(false);
    toast('Kaydedilemedi: ' + (e.message || e) + '. Ayarlardan daha küçük dışa aktarma boyutu seçebilirsin.', null, null, 7000);
  } finally {
    worker.terminate();
    engine.deleteTexture(stripTex);
    if (tgt) engine.freeTarget(tgt);
    scheduleRender();
  }
}

function showExportResult(blob, W, H) {
  const name = (ed.name.replace(/\.[^.]+$/, '') || 'foto') + '_zimboh.jpg';
  const url = URL.createObjectURL(blob);
  const body = openModal('Hazır');
  body.innerHTML = `
    <img class="preview-img" src="${url}" alt="">
    <p class="note">${W}×${H} · ${(W * H / 1e6).toFixed(1)}MP · ${(blob.size / 1048576).toFixed(1)} MB</p>
    <div class="btnrow">
      <button class="btn primary" id="xShare">Fotoğraflara kaydet</button>
      <button class="btn" id="xDl">Dosya olarak indir</button>
    </div>
    <p class="note">"Fotoğraflara kaydet" paylaşım menüsünü açar; oradan <b>Resmi Kaydet</b>'i seç.</p>`;
  $('xShare').onclick = async () => {
    const r = await shareFiles([new File([blob], name, { type: 'image/jpeg' })]).catch(e => { toast('Paylaşılamadı: ' + e.message); });
    if (r === 'shared' || r === 'downloaded') toast('Kaydedildi');
  };
  $('xDl').onclick = () => downloadBlob(blob, name);
  modalCleanup = () => URL.revokeObjectURL(url);
}

// ---------- Presetler ----------
function renderChips() {
  const el = $('chips');
  const dirty = !paramsEqual(params, activePreset().params);
  const list = favorites.map(id => presets.find(p => p.id === id)).filter(Boolean);
  if (!favorites.includes(activeId)) list.unshift(activePreset());
  el.innerHTML = list.map(p => `<button class="chip ${p.id === activeId ? 'on' : ''} ${p.id === activeId && dirty ? 'dirty' : ''} ${favorites.includes(p.id) ? '' : 'temp'}" data-id="${p.id}">${esc(p.name)}</button>`).join('');
  el.querySelectorAll('.chip').forEach(b => b.onclick = () => applyPreset(b.dataset.id));
  if (!$('drawer').hidden) renderDrawer();
}

// ---------- Preset çekmecesi ----------
function openDrawer() {
  if (!$('panel').hidden) closePanel();
  $('drawer').hidden = false; app.classList.add('drawer-open');
  $('drawerBtn').classList.add('open'); $('drawerBtn').setAttribute('aria-expanded', 'true');
  renderDrawer();
  if (mode === 'edit') scheduleRender();
}
function closeDrawer() {
  $('drawer').hidden = true; app.classList.remove('drawer-open');
  $('drawerBtn').classList.remove('open'); $('drawerBtn').setAttribute('aria-expanded', 'false');
  if (mode === 'edit') scheduleRender();
}
$('drawerBtn').onclick = () => { $('drawer').hidden ? openDrawer() : closeDrawer(); };
$('drawerManage').onclick = openPresetManager;

function toggleFav(id) {
  if (favorites.includes(id)) {
    if (favorites.length <= 1) { toast('En az bir favori olmalı'); return; }
    favorites = favorites.filter(x => x !== id);
  } else favorites.push(id);
  saveFavorites(favorites);
  renderChips();
  renderDrawer();
}

function renderDrawer() {
  const body = $('drawerBody');
  const st = body.scrollTop;
  const card = p => `<div class="pcard ${p.id === activeId ? 'on' : ''}" data-id="${p.id}" role="button" tabindex="0">
      <span class="pname">${esc(p.name)}</span>
      <button class="star ${favorites.includes(p.id) ? 'on' : ''}" data-star="${p.id}" aria-label="Favori">${favorites.includes(p.id) ? '★' : '☆'}</button>
    </div>`;
  const favs = favorites.map(id => presets.find(p => p.id === id)).filter(Boolean);
  const rest = presets.filter(p => !favorites.includes(p.id));
  const mine = rest.filter(p => !p.builtin);
  let html = `<div class="pgrid"><button class="pcard add" id="drawerAdd"><span class="pname">＋ Ekle</span></button>${favs.map(card).join('')}</div>`;
  html = `<div class="section-title">Favoriler <span class="hint">· yıldızlılar şeritte görünür</span></div>` + html;
  if (mine.length) html += `<div class="section-title">Benim presetlerim</div><div class="pgrid">${mine.map(card).join('')}</div>`;
  for (const c of CATEGORIES) {
    const items = rest.filter(p => p.builtin && p.cat === c.id);
    if (items.length) html += `<div class="section-title">${c.label}</div><div class="pgrid">${items.map(card).join('')}</div>`;
  }
  body.innerHTML = html;
  body.scrollTop = st;
  $('drawerAdd').onclick = openSavePreset;
  body.querySelectorAll('.pcard[data-id]').forEach(el => el.onclick = e => {
    if (e.target.closest('[data-star]')) return;
    applyPreset(el.dataset.id);
    closeDrawer();
  });
  body.querySelectorAll('[data-star]').forEach(b => b.onclick = e => { e.stopPropagation(); toggleFav(b.dataset.star); });
}

function applyPreset(id) {
  const p = presets.find(x => x.id === id);
  if (!p) return;
  if (id === activeId && paramsEqual(params, p.params)) return;
  activeId = id;
  params = { ...p.params };
  settings.lastPreset = id;
  onParamsChanged(true);
  if (!fx) $('fxBtn').click();
}
function onParamsChanged(full) {
  U = toUniforms(params);
  settings.lastParams = params;
  persist();
  renderChips();
  if (mode === 'edit') scheduleRender();
  if (full && !$('panel').hidden) renderPanel();
}

function openSavePreset() {
  const ap = activePreset();
  const body = openModal('Preset kaydet');
  const suggested = ap.builtin ? ap.name + ' (benim)' : ap.name;
  body.innerHTML = `
    <p class="note">Şu anki ayarlar preset olarak kaydedilir.</p>
    <input class="field" id="pName" maxlength="40" value="${esc(suggested)}" autocomplete="off">
    <div class="btnrow">
      <button class="btn primary" id="pNew">Yeni preset olarak kaydet</button>
      ${!ap.builtin ? `<button class="btn" id="pOver">"${esc(ap.name)}" üzerine yaz</button>` : ''}
    </div>`;
  const inp = $('pName');
  setTimeout(() => { inp.focus(); inp.select(); }, 50);
  $('pNew').onclick = () => {
    const name = inp.value.trim() || 'Preset';
    const p = { id: newId(), name, builtin: false, params: { ...params } };
    presets.push(p); saveUserPresets(presets);
    favorites.push(p.id); saveFavorites(favorites);
    activeId = p.id; settings.lastPreset = p.id; persist();
    renderChips(); closeModal(); toast(`"${name}" kaydedildi ve favorilere eklendi`);
    requestAnimationFrame(() => { const c = $('chips').querySelector(`[data-id="${p.id}"]`); c && c.scrollIntoView({ inline: 'center', behavior: 'smooth' }); });
  };
  if ($('pOver')) $('pOver').onclick = () => {
    ap.params = { ...params };
    const nm = inp.value.trim(); if (nm) ap.name = nm;
    saveUserPresets(presets); renderChips(); closeModal(); toast('Preset güncellendi');
  };
}

function openPresetManager() {
  const body = openModal('Presetler');
  const draw = () => {
    body.innerHTML = presets.map(p => `
      <div class="plist-row" data-id="${p.id}">
        <span class="name">${esc(p.name)}</span>
        ${p.builtin ? '<span class="tag">HAZIR</span>' : ''}
        <button class="btn small" data-a="dup">Kopyala</button>
        ${p.builtin ? '' : '<button class="btn small" data-a="ren">Adlandır</button><button class="btn small danger" data-a="del">Sil</button>'}
      </div>`).join('') + `
      <div class="btnrow" style="margin-top:14px">
        <button class="btn" id="pmExp">Presetleri dışa aktar</button>
        <button class="btn" id="pmImp">İçe aktar</button>
      </div>
      <p class="note">Hazır presetler silinemez; kopyalayıp kendi versiyonunu düzenleyebilirsin. Dışa aktarılan dosyayı iCloud Drive'a koyabilir ya da arkadaşına gönderebilirsin.</p>`;
    body.querySelectorAll('.plist-row button').forEach(b => b.onclick = () => {
      const id = b.closest('.plist-row').dataset.id;
      const p = presets.find(x => x.id === id);
      if (b.dataset.a === 'dup') {
        const c = { id: newId(), name: (p.name + ' kopya').slice(0, 40), builtin: false, params: { ...p.params } };
        presets.push(c); saveUserPresets(presets); renderChips(); draw();
      } else if (b.dataset.a === 'ren') {
        const nm = prompt('Yeni ad', p.name);
        if (nm && nm.trim()) { p.name = nm.trim().slice(0, 40); saveUserPresets(presets); renderChips(); draw(); }
      } else if (b.dataset.a === 'del') {
        if (!confirm(`"${p.name}" silinsin mi?`)) return;
        presets = presets.filter(x => x.id !== id); saveUserPresets(presets);
        favorites = favorites.filter(x => x !== id);
        if (!favorites.length) favorites = [DEFAULT_FAVORITES[0]];
        saveFavorites(favorites);
        if (activeId === id) { activeId = BUILTIN_PRESETS[0].id; settings.lastPreset = activeId; persist(); }
        renderChips(); draw();
      }
    });
    $('pmExp').onclick = exportPresets;
    $('pmImp').onclick = () => $('filePresets').click();
  };
  draw();
}
async function exportPresets() {
  const users = presets.filter(p => !p.builtin);
  if (!users.length) { toast('Henüz kendi presetin yok'); return; }
  const blob = new Blob([exportPresetsJSON(presets)], { type: 'application/json' });
  const f = new File([blob], 'zimbohcam-presetler.json', { type: 'application/json' });
  const r = await shareFiles([f]).catch(() => null);
  if (!r) downloadBlob(blob, f.name);
}
$('filePresets').onchange = async e => {
  const f = e.target.files[0]; e.target.value = '';
  if (!f) return;
  try {
    const list = parseImportedPresets(await f.text());
    presets.push(...list); saveUserPresets(presets); renderChips();
    toast(`${list.length} preset içe aktarıldı`);
    if (!$('modal').hidden && $('modalTitle').textContent === 'Presetler') openPresetManager();
  } catch (err) { toast('İçe aktarılamadı: ' + err.message); }
};

// ---------- Ayar paneli ----------
function openPanel() { if (!$('drawer').hidden) closeDrawer(); $('panel').hidden = false; app.classList.add('panel-open'); renderPanel(); if (mode === 'edit') scheduleRender(); }
function closePanel() { $('panel').hidden = true; app.classList.remove('panel-open'); if (mode === 'edit') scheduleRender(); }
$('adjustBtnCam').onclick = openPanel;
$('adjustBtnEdit').onclick = openPanel;
$('panelDone').onclick = closePanel;
$('resetPreset').onclick = () => { params = { ...activePreset().params }; onParamsChanged(true); };
$('resetNeutral').onclick = () => { params = neutralParams(); onParamsChanged(true); };

function fmtVal(p, v) {
  if (p.fmt) return p.fmt(v);
  if (p.hue) return Math.round(v) + '°';
  return (v > 0 && p.min < 0 ? '+' : '') + Math.round(v);
}
function hueTrack(p) {
  if (p.key === 'halHue') return 'linear-gradient(90deg, hsl(0 100% 50%), hsl(25 100% 50%), hsl(50 100% 50%))';
  return 'linear-gradient(90deg, hsl(0 90% 55%), hsl(60 90% 55%), hsl(120 90% 55%), hsl(180 90% 55%), hsl(240 90% 55%), hsl(300 90% 55%), hsl(360 90% 55%))';
}

function sliderRow(p, ap) {
  const v = params[p.key], mod = Math.abs(v - ap[p.key]) > 1e-6;
  return `<div class="row">
      <div class="row-top"><label class="${mod ? 'mod' : ''}" id="lb-${p.key}">${p.label}</label><button class="val" data-reset="${p.key}" title="Preset değerine dön">${fmtVal(p, v)}</button></div>
      <input type="range" data-k="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" ${p.hue ? `style="--track:${hueTrack(p)}"` : ''}>
    </div>`;
}
function mixerHtml(ap) {
  const c = HSL_COLORS.find(x => x.id === hslSel) || HSL_COLORS[0];
  const dots = HSL_COLORS.map(x => {
    const used = ['h', 's', 'l'].some(k => params[`hsl_${x.id}_${k}`]);
    return `<button class="hdot ${x.id === c.id ? 'on' : ''} ${used ? 'used' : ''}" data-hsl="${x.id}" style="--c:${x.css}" aria-label="${x.label}"></button>`;
  }).join('');
  return `<div class="section-title">Renk karıştırıcı</div>
    <div class="hdots">${dots}</div>
    <div class="hname">${c.label}</div>
    ${['h', 's', 'l'].map(k => sliderRow(PARAM_MAP[`hsl_${c.id}_${k}`], ap)).join('')}
    <p class="note">Bir renge dokun, sonra o rengin tonunu, doygunluğunu ve parlaklığını değiştir. Ör. yeşili mora kaydırmak Lomochrome Purple görünümü verir.</p>`;
}

function renderPanel() {
  const tabs = [...GROUPS];
  if (mode === 'camera') tabs.push({ id: 'cam', label: 'Kamera' });
  if (!tabs.some(t => t.id === panelTab)) panelTab = 'ton';
  $('tabs').innerHTML = tabs.map(t => `<button class="tab ${t.id === panelTab ? 'on' : ''}" data-t="${t.id}">${t.label}</button>`).join('');
  $('tabs').querySelectorAll('.tab').forEach(b => b.onclick = () => { panelTab = b.dataset.t; renderPanel(); });
  $('panel').querySelector('.panel-foot').hidden = panelTab === 'cam';
  const body = $('panelBody');
  const keepScroll = body.dataset.tab === panelTab ? body.scrollTop : 0;
  body.dataset.tab = panelTab;
  if (panelTab === 'cam') { renderCamPanel(body); body.scrollTop = keepScroll; return; }
  const ap = activePreset().params;
  const list = PARAMS.filter(p => p.group === panelTab && !p.hsl);
  body.innerHTML = list.map(p => {
    const v = params[p.key], mod = Math.abs(v - ap[p.key]) > 1e-6;
    if (p.toggle) return `<div class="toggle-row"><label class="${mod ? 'mod' : ''}" style="font-size:13px;font-weight:600">${p.label}</label><button class="switch ${v ? 'on' : ''}" data-k="${p.key}" role="switch" aria-checked="${!!v}"></button></div>`;
    return `<div class="row">
      <div class="row-top"><label class="${mod ? 'mod' : ''}" id="lb-${p.key}">${p.label}</label><button class="val" data-reset="${p.key}" title="Preset değerine dön">${fmtVal(p, v)}</button></div>
      <input type="range" data-k="${p.key}" min="${p.min}" max="${p.max}" step="${p.step}" value="${v}" ${p.hue ? `style="--track:${hueTrack(p)}"` : ''}>
    </div>`;
  }).join('') + (panelTab === 'isik' ? `<p class="note">Halation: parlak ışıkların etrafındaki kırmızı ışıma. "Işık eşiği" düştükçe daha az parlak alanlar da ışır.</p>` : '')
    + (panelTab === 'grain' ? `<p class="note">Grain görüntü boyutuna göre ölçeklenir; ekranda gördüğün, kaydedilen fotoğrafın aynı boyutta görünüşüdür. 1:1 modunda tam çözünürlükte görebilirsin.</p>` : '')
    + (panelTab === 'renk' ? mixerHtml(ap) : '');
  body.scrollTop = keepScroll;
  body.querySelectorAll('[data-hsl]').forEach(b => b.onclick = () => { hslSel = b.dataset.hsl; renderPanel(); });
  body.querySelectorAll('input[type=range]').forEach(inp => {
    inp.oninput = () => {
      const p = PARAM_MAP[inp.dataset.k];
      params[p.key] = Number(inp.value);
      body.querySelector(`[data-reset="${p.key}"]`).textContent = fmtVal(p, params[p.key]);
      $('lb-' + p.key).classList.toggle('mod', Math.abs(params[p.key] - activePreset().params[p.key]) > 1e-6);
      onParamsChanged(false);
    };
  });
  body.querySelectorAll('[data-reset]').forEach(b => b.onclick = () => {
    const k = b.dataset.reset; params[k] = activePreset().params[k]; onParamsChanged(true);
  });
  body.querySelectorAll('.switch[data-k]').forEach(b => b.onclick = () => {
    const k = b.dataset.k; params[k] = params[k] ? 0 : 1; onParamsChanged(true);
  });
}

// Gerçek kamera kontrolleri (cihazın desteklediği kadar)
function renderCamPanel(body) {
  if (!cam.stream) { body.innerHTML = '<p class="note">Kamera açık değil.</p>'; return; }
  const caps = cam.caps();
  const st = cam.track.getSettings ? cam.track.getSettings() : {};
  let html = `<div class="section-title">Lens</div><div class="lenses" style="justify-content:flex-start;flex-wrap:wrap">`
    + [...cam.availableLenses(), 'front'].map(l => `<button class="lens ${cam.lens === l ? 'on' : ''}" data-l="${l}">${l === 'front' ? 'Ön' : l + 'mm'}</button>`).join('') + `</div>`;
  html += `<p class="note">Akış: ${video.videoWidth}×${video.videoHeight}${cam.lens === '48' ? (cam.hwZoom ? ' · 48mm donanım zoom' : ' · 48mm = ana kamera ortadan kırpma') : ''}</p>`;
  if (caps.torch) html += `<div class="toggle-row"><label>Fener (sürekli ışık)</label><button class="switch ${st.torch ? 'on' : ''}" id="cTorch"></button></div>`;
  for (const [k, label] of MODE_CAPS) {
    const m = caps[k];
    if (Array.isArray(m) && m.includes('continuous') && (m.includes('manual') || m.includes('single-shot') || m.includes('locked'))) {
      const locked = st[k] && st[k] !== 'continuous';
      html += `<div class="toggle-row"><label>${label}</label><button class="switch ${locked ? 'on' : ''}" data-mode="${k}"></button></div>`;
    }
  }
  let numeric = 0;
  for (const [k, label] of NUMERIC_CAPS) {
    const c = caps[k];
    if (c && typeof c.max === 'number' && typeof c.min === 'number' && c.max > c.min) {
      numeric++;
      const v = typeof st[k] === 'number' ? st[k] : c.min;
      const step = c.step || (c.max - c.min) / 100;
      html += `<div class="row"><div class="row-top"><label>${label}</label><span class="val" id="cv-${k}">${+v.toFixed(3)}</span></div>
        <input type="range" data-cap="${k}" min="${c.min}" max="${c.max}" step="${step}" value="${v}"></div>`;
    }
  }
  const missing = ['iso', 'exposureTime', 'focusDistance'].filter(k => !caps[k]);
  if (missing.length) html += `<p class="note">Safari bu iPhone'da ISO, enstantane ve manuel netleme kontrolüne izin vermiyor; pozlama ve netleme otomatik. Safari ileride bu ayarları açarsa burada kendiliğinden görünür.</p>`;
  if (!caps.torch && !numeric) html += `<p class="note">Bu kamera için ek donanım ayarı bildirilmedi.</p>`;
  html += `<div class="optrow"><span>Akış çözünürlüğü</span><div class="opts" id="cRes">${[['max', 'Maks'], ['4k', '4K'], ['hd', 'HD']].map(([v, l]) => `<button class="${settings.streamRes === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div></div>
    <p class="note">Vizör takılırsa HD'yi dene. Çekilen fotoğrafın çözünürlüğü akış çözünürlüğüne eşittir.</p>`;
  body.innerHTML = html;
  body.querySelectorAll('.lens').forEach(b => b.onclick = () => switchLens(b.dataset.l));
  if ($('cTorch')) $('cTorch').onclick = async () => { const on = !(cam.track.getSettings().torch); await cam.apply({ torch: on }); renderPanel(); };
  body.querySelectorAll('.switch[data-mode]').forEach(b => b.onclick = async () => {
    const k = b.dataset.mode, m = caps[k];
    const cur = cam.track.getSettings()[k];
    const lockV = m.includes('manual') ? 'manual' : m.includes('locked') ? 'locked' : 'single-shot';
    const ok = await cam.apply({ [k]: cur && cur !== 'continuous' ? 'continuous' : lockV });
    if (!ok) toast('Bu ayar uygulanamadı');
    renderPanel();
  });
  const manualFor = { exposureTime: ['exposureMode', 'manual'], iso: ['exposureMode', 'manual'], focusDistance: ['focusMode', 'manual'], colorTemperature: ['whiteBalanceMode', 'manual'] };
  body.querySelectorAll('input[data-cap]').forEach(inp => {
    let pend = 0;
    inp.oninput = () => {
      const k = inp.dataset.cap, v = Number(inp.value);
      $('cv-' + k).textContent = +v.toFixed(3);
      cancelAnimationFrame(pend);
      pend = requestAnimationFrame(async () => {
        const c = { [k]: v };
        if (manualFor[k]) c[manualFor[k][0]] = manualFor[k][1];
        if (k === 'zoom') { cam.hwZoom = v; cam.digitalZoom = 1; }
        await cam.apply(c); updateHud();
      });
    };
  });
  body.querySelectorAll('#cRes button').forEach(b => b.onclick = async () => {
    settings.streamRes = b.dataset.v; persist(true);
    await startCamera(); renderPanel();
  });
}

// ---------- Uygulama ayarları ----------
$('settingsBtn').onclick = openSettings;
function opts(id, cur, list) {
  return `<div class="opts" id="${id}">${list.map(([v, l]) => `<button class="${String(cur) === String(v) ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>`;
}
function openSettings() {
  const body = openModal('Ayarlar');
  const draw = () => {
    body.innerHTML = `
      <div class="section-title">Çekim</div>
      <div class="toggle-row"><span>Orijinali de kaydet</span><button class="switch ${settings.saveOriginal ? 'on' : ''}" id="sOrig"></button></div>
      <div class="toggle-row"><span>Her çekimden sonra kaydetme menüsünü aç</span><button class="switch ${settings.autoShare ? 'on' : ''}" id="sAuto"></button></div>
      <p class="note">Kapalıyken kareler film rulosunda birikir; istediğin zaman toplu kaydedersin.</p>
      <div class="optrow"><span>JPEG kalitesi</span>${opts('sQ', settings.jpegQ, [[85, '85'], [92, '92'], [97, '97']])}</div>
      <div class="optrow"><span>Akış çözünürlüğü</span>${opts('sRes', settings.streamRes, [['max', 'Maks'], ['4k', '4K'], ['hd', 'HD']])}</div>

      <div class="section-title">Düzenleme</div>
      <div class="optrow"><span>Dışa aktarma boyutu</span>${opts('sExp', settings.exportSize, [['full', 'Tam'], ['24', '24MP'], ['12', '12MP']])}</div>
      <div class="optrow"><span>RAW çözme</span>${opts('sRaw', settings.rawMode, [['full', 'Tam'], ['half', 'Hızlı']])}</div>
      <p class="note">Hızlı mod RAW'ı yarı çözünürlükte (48MP → 12MP) açar; daha az bellek kullanır.</p>

      <div class="section-title">Presetler</div>
      <div class="btnrow"><button class="btn" id="sPm">Presetleri yönet</button></div>

      <div class="section-title">Hakkında</div>
      <p class="note">zimbohCam ${VERSION}<br>
      ProRAW motoru: ${self.crossOriginIsolated ? 'hazır' : 'hazır değil (uygulamayı kapatıp yeniden aç)'}<br>
      Kameralar: ${esc((cam.deviceLabels || []).join(', ') || 'henüz okunmadı')}<br>
      Fotoğrafların ve presetlerin yalnızca bu telefonda saklanır, hiçbir sunucuya gönderilmez.</p>`;
    $('sOrig').onclick = () => { settings.saveOriginal = !settings.saveOriginal; persist(true); draw(); };
    $('sAuto').onclick = () => { settings.autoShare = !settings.autoShare; persist(true); draw(); };
    const bind = (id, key, num, after) => body.querySelectorAll(`#${id} button`).forEach(b => b.onclick = () => {
      settings[key] = num ? Number(b.dataset.v) : b.dataset.v; persist(true); draw(); after && after();
    });
    bind('sQ', 'jpegQ', true);
    bind('sRes', 'streamRes', false, () => { if (mode === 'camera') startCamera(); });
    bind('sExp', 'exportSize');
    bind('sRaw', 'rawMode');
    $('sPm').onclick = openPresetManager;
  };
  draw();
}

// ---------- Modal ----------
let modalCleanup = null;
function openModal(title) {
  if (modalCleanup) { try { modalCleanup(); } catch {} modalCleanup = null; }
  $('modalTitle').textContent = title;
  $('modal').hidden = false;
  return $('modalBody');
}
function closeModal() {
  $('modal').hidden = true;
  $('modalBody').innerHTML = '';
  if (modalCleanup) { try { modalCleanup(); } catch {} modalCleanup = null; }
}
$('modalClose').onclick = closeModal;
$('modal').addEventListener('click', e => { if (e.target === $('modal')) closeModal(); });

// ---------- Yaşam döngüsü ----------
document.addEventListener('visibilitychange', () => {
  if (document.hidden) cam.stop();
  else if (mode === 'camera') startCamera();
});
let resizeT = 0;
window.addEventListener('resize', () => { clearTimeout(resizeT); resizeT = setTimeout(() => { if (mode === 'edit') scheduleRender(); }, 60); });

async function setupSW() {
  if (!('serviceWorker' in navigator)) return false;
  try {
    await navigator.serviceWorker.register('sw.js');
    if (!self.crossOriginIsolated) {
      await navigator.serviceWorker.ready;
      let flag = null;
      try { flag = sessionStorage.getItem('zc-coi'); } catch {}
      if (!flag) {
        try { sessionStorage.setItem('zc-coi', '1'); } catch { return false; }
        location.reload();
        return true;
      }
    }
  } catch {}
  return false;
}

(async function init() {
  renderChips();
  requestAnimationFrame(() => { const c = $('chips').querySelector('.chip.on'); c && c.scrollIntoView({ inline: 'center' }); });
  refreshRoll();
  if (await setupSW()) return;
  if (engine) setMode('camera');
})();
