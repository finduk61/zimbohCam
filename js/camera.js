// zimbohCam — kamera akışı, lensler ve gerçek donanım ayarları

const RES = {
  max:  { width: { ideal: 4032 }, height: { ideal: 3024 } },
  '4k': { width: { ideal: 3840 }, height: { ideal: 2160 } },
  hd:   { width: { ideal: 1920 }, height: { ideal: 1440 } },
};

// iOS etiketleri (İngilizce ve Türkçe)
const RX = {
  front: /front|ön|facetime/i,
  ultra: /ultra/i,
  tele:  /tele/i,
  multi: /dual|triple|ikili|üçlü|çift/i,
};

export class Camera {
  constructor(video) {
    this.video = video;
    this.stream = null;
    this.track = null;
    this.devices = { wide: null, ultra: null, tele: null, front: null };
    this.lens = '24';
    this.resolution = 'max';
    this.digitalZoom = 1;   // donanım zoom'u yoksa shader ile kırpma
    this.hwZoom = null;     // donanım zoom değeri
  }

  get facingFront() { return this.lens === 'front'; }

  async start(lens = this.lens) {
    this.lens = lens;
    this.stop();
    const base = RES[this.resolution] || RES.max;
    let constraints;
    const dev = this._deviceFor(lens);
    if (dev) constraints = { video: { deviceId: { exact: dev }, ...base }, audio: false };
    else constraints = { video: { facingMode: lens === 'front' ? 'user' : 'environment', ...base }, audio: false };
    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      if (dev) stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: lens === 'front' ? 'user' : 'environment', ...base }, audio: false });
      else throw e;
    }
    this.stream = stream;
    this.track = stream.getVideoTracks()[0];
    this.video.srcObject = stream;
    this.video.muted = true;
    this.video.setAttribute('playsinline', '');
    await this.video.play().catch(() => {});
    await new Promise(r => { if (this.video.videoWidth) r(); else this.video.onloadedmetadata = () => r(); });
    if (!this._enumerated) await this.enumerate();
    // 48mm = ana kamera 2x
    this.digitalZoom = 1; this.hwZoom = null;
    if (lens === '48') await this.setZoom(2);
    // Ön kamera: Apple Kamera'nın normal (geniş olmayan) kadrajı = sensörün ortadan ~1.3x kırpılmış hali
    else if (lens === 'front') await this.setZoom(1.3);
    return this.info();
  }

  stop() {
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = null; this.track = null;
  }

  async enumerate() {
    try {
      const list = (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput');
      const backs = [];
      for (const d of list) {
        const l = d.label || '';
        if (RX.front.test(l)) { this.devices.front = this.devices.front || d.deviceId; continue; }
        if (RX.multi.test(l)) continue;
        if (RX.ultra.test(l)) this.devices.ultra = d.deviceId;
        else if (RX.tele.test(l)) this.devices.tele = d.deviceId;
        else backs.push(d);
      }
      if (backs.length) this.devices.wide = backs[0].deviceId;
      this._enumerated = list.some(d => d.label);
      this.deviceLabels = list.map(d => d.label).filter(Boolean);
    } catch {}
  }

  _deviceFor(lens) {
    if (lens === '13') return this.devices.ultra;
    if (lens === '120') return this.devices.tele;
    if (lens === 'front') return this.devices.front;
    return this.devices.wide;
  }

  availableLenses() {
    const out = [];
    if (this.devices.ultra) out.push('13');
    out.push('24', '48');
    if (this.devices.tele) out.push('120');
    return out;
  }

  info() {
    const s = this.track ? this.track.getSettings() : {};
    return { width: this.video.videoWidth, height: this.video.videoHeight, settings: s };
  }

  caps() {
    try { return this.track && this.track.getCapabilities ? this.track.getCapabilities() : {}; } catch { return {}; }
  }

  async apply(c) {
    if (!this.track) return false;
    try { await this.track.applyConstraints({ advanced: [c] }); return true; }
    catch { try { await this.track.applyConstraints(c); return true; } catch { return false; } }
  }

  async setZoom(z) {
    const c = this.caps();
    if (c.zoom && typeof c.zoom.max === 'number' && c.zoom.max >= z && c.zoom.min <= z) {
      if (await this.apply({ zoom: z })) { this.hwZoom = z; this.digitalZoom = 1; return 'hw'; }
    }
    this.hwZoom = null;
    this.digitalZoom = Math.max(1, z);
    return 'digital';
  }

  // Kırpma dikdörtgeni (normalize) — dijital zoom için
  cropRect() {
    const z = this.digitalZoom || 1;
    const s = 1 / z;
    return [(1 - s) / 2, (1 - s) / 2, s, s];
  }
}

// Gelişmiş panelde gösterilecek gerçek kontroller
export const NUMERIC_CAPS = [
  ['zoom', 'Zoom'],
  ['exposureCompensation', 'Pozlama telafisi (donanım)'],
  ['exposureTime', 'Enstantane'],
  ['iso', 'ISO'],
  ['focusDistance', 'Netleme mesafesi'],
  ['colorTemperature', 'Renk sıcaklığı (K)'],
  ['brightness', 'Parlaklık (donanım)'],
  ['sharpness', 'Keskinlik (donanım)'],
];
export const MODE_CAPS = [
  ['whiteBalanceMode', 'Beyaz dengesi kilidi'],
  ['exposureMode', 'Pozlama kilidi'],
  ['focusMode', 'Netleme kilidi'],
];
