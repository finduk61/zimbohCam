// zimbohCam — akışlı JPEG kodlayıcı (4:2:0, baseline)
// Büyük (48MP) görüntüleri şeritler halinde kodlar; Safari'nin canvas boyut sınırına takılmaz.
// Tablolar ve AAN DCT: Adobe JPEG encoder (BSD), Andreas Ritter JS portu / jpeg-js.

const ZZ = [0,1,5,6,14,15,27,28,2,4,7,13,16,26,29,42,3,8,12,17,25,30,41,43,9,11,18,24,31,40,44,53,10,19,23,32,39,45,52,54,20,22,33,38,46,51,55,60,21,34,37,47,50,56,59,61,35,36,48,49,57,58,62,63];
const DC_L_N = [0,0,1,5,1,1,1,1,1,1,0,0,0,0,0,0,0];
const DC_V = [0,1,2,3,4,5,6,7,8,9,10,11];
const AC_L_N = [0,0,2,1,3,3,2,4,3,5,5,4,4,0,0,1,0x7d];
const AC_L_V = [0x01,0x02,0x03,0x00,0x04,0x11,0x05,0x12,0x21,0x31,0x41,0x06,0x13,0x51,0x61,0x07,0x22,0x71,0x14,0x32,0x81,0x91,0xa1,0x08,0x23,0x42,0xb1,0xc1,0x15,0x52,0xd1,0xf0,0x24,0x33,0x62,0x72,0x82,0x09,0x0a,0x16,0x17,0x18,0x19,0x1a,0x25,0x26,0x27,0x28,0x29,0x2a,0x34,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe1,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf1,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa];
const DC_C_N = [0,0,3,1,1,1,1,1,1,1,1,1,0,0,0,0,0];
const AC_C_N = [0,0,2,1,2,4,4,3,4,7,5,4,4,0,1,2,0x77];
const AC_C_V = [0x00,0x01,0x02,0x03,0x11,0x04,0x05,0x21,0x31,0x06,0x12,0x41,0x51,0x07,0x61,0x71,0x13,0x22,0x32,0x81,0x08,0x14,0x42,0x91,0xa1,0xb1,0xc1,0x09,0x23,0x33,0x52,0xf0,0x15,0x62,0x72,0xd1,0x0a,0x16,0x24,0x34,0xe1,0x25,0xf1,0x17,0x18,0x19,0x1a,0x26,0x27,0x28,0x29,0x2a,0x35,0x36,0x37,0x38,0x39,0x3a,0x43,0x44,0x45,0x46,0x47,0x48,0x49,0x4a,0x53,0x54,0x55,0x56,0x57,0x58,0x59,0x5a,0x63,0x64,0x65,0x66,0x67,0x68,0x69,0x6a,0x73,0x74,0x75,0x76,0x77,0x78,0x79,0x7a,0x82,0x83,0x84,0x85,0x86,0x87,0x88,0x89,0x8a,0x92,0x93,0x94,0x95,0x96,0x97,0x98,0x99,0x9a,0xa2,0xa3,0xa4,0xa5,0xa6,0xa7,0xa8,0xa9,0xaa,0xb2,0xb3,0xb4,0xb5,0xb6,0xb7,0xb8,0xb9,0xba,0xc2,0xc3,0xc4,0xc5,0xc6,0xc7,0xc8,0xc9,0xca,0xd2,0xd3,0xd4,0xd5,0xd6,0xd7,0xd8,0xd9,0xda,0xe2,0xe3,0xe4,0xe5,0xe6,0xe7,0xe8,0xe9,0xea,0xf2,0xf3,0xf4,0xf5,0xf6,0xf7,0xf8,0xf9,0xfa];
const YQT = [16,11,10,16,24,40,51,61,12,12,14,19,26,58,60,55,14,13,16,24,40,57,69,56,14,17,22,29,51,87,80,62,18,22,37,56,68,109,103,77,24,35,55,64,81,104,113,92,49,64,78,87,103,121,120,101,72,92,95,98,112,100,103,99];
const UVQT = [17,18,24,47,99,99,99,99,18,21,26,66,99,99,99,99,24,26,56,99,99,99,99,99,47,66,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99,99];
const AASF = [1.0,1.387039845,1.306562965,1.175875602,1.0,0.785694958,0.541196100,0.275899379];

function huff(n, v) {
  const code = new Int32Array(256), len = new Int32Array(256);
  let cv = 0, p = 0;
  for (let k = 1; k <= 16; k++) { for (let j = 1; j <= n[k]; j++) { code[v[p]] = cv; len[v[p]] = k; p++; cv++; } cv *= 2; }
  return { code, len };
}
const HT = { ydc: huff(DC_L_N, DC_V), uvdc: huff(DC_C_N, DC_V), yac: huff(AC_L_N, AC_L_V), uvac: huff(AC_C_N, AC_C_V) };

class Enc {
  constructor(w, h, q) {
    this.w = w; this.h = h;
    q = Math.max(1, Math.min(100, q | 0));
    const sf = q < 50 ? Math.floor(5000 / q) : Math.floor(200 - q * 2);
    this.YT = new Uint8Array(64); this.UVT = new Uint8Array(64);
    for (let i = 0; i < 64; i++) {
      this.YT[ZZ[i]] = Math.min(255, Math.max(1, Math.floor((YQT[i] * sf + 50) / 100)));
      this.UVT[ZZ[i]] = Math.min(255, Math.max(1, Math.floor((UVQT[i] * sf + 50) / 100)));
    }
    this.fY = new Float32Array(64); this.fUV = new Float32Array(64);
    for (let r = 0, k = 0; r < 8; r++) for (let c = 0; c < 8; c++, k++) {
      this.fY[k] = 1 / (this.YT[ZZ[k]] * AASF[r] * AASF[c] * 8);
      this.fUV[k] = 1 / (this.UVT[ZZ[k]] * AASF[r] * AASF[c] * 8);
    }
    this.out = new Uint8Array(1 << 22); this.pos = 0;
    this.bitBuf = 0; this.bitCnt = 0;
    this.dcY = 0; this.dcU = 0; this.dcV = 0;
    this.blk = new Float32Array(64); this.q = new Int32Array(64); this.du = new Int32Array(64);
    this.band = new Uint8Array(w * 16 * 4); this.bandRows = 0; this.rowsDone = 0;
    this.header();
  }
  grow(n) {
    if (this.pos + n <= this.out.length) return;
    let s = this.out.length * 2; while (s < this.pos + n) s *= 2;
    const o = new Uint8Array(s); o.set(this.out.subarray(0, this.pos)); this.out = o;
  }
  b(v) { this.grow(1); this.out[this.pos++] = v; }
  wd(v) { this.b((v >> 8) & 255); this.b(v & 255); }
  header() {
    this.wd(0xFFD8);
    this.wd(0xFFE0); this.wd(16); [0x4A,0x46,0x49,0x46,0,1,1,0].forEach(v => this.b(v)); this.wd(1); this.wd(1); this.b(0); this.b(0);
    this.wd(0xFFDB); this.wd(132); this.b(0); for (let i = 0; i < 64; i++) this.b(this.YT[i]); this.b(1); for (let i = 0; i < 64; i++) this.b(this.UVT[i]);
    this.wd(0xFFC0); this.wd(17); this.b(8); this.wd(this.h); this.wd(this.w); this.b(3);
    this.b(1); this.b(0x22); this.b(0); this.b(2); this.b(0x11); this.b(1); this.b(3); this.b(0x11); this.b(1);
    this.wd(0xFFC4); this.wd(0x01A2);
    const tbl = (cls, n, v) => { this.b(cls); for (let i = 1; i <= 16; i++) this.b(n[i]); for (const x of v) this.b(x); };
    tbl(0x00, DC_L_N, DC_V); tbl(0x10, AC_L_N, AC_L_V); tbl(0x01, DC_C_N, DC_V); tbl(0x11, AC_C_N, AC_C_V);
    this.wd(0xFFDA); this.wd(12); this.b(3); this.b(1); this.b(0); this.b(2); this.b(0x11); this.b(3); this.b(0x11); this.b(0); this.b(0x3f); this.b(0);
  }
  bits(code, len) {
    this.bitBuf = (this.bitBuf << len) | (code & ((1 << len) - 1));
    this.bitCnt += len;
    while (this.bitCnt >= 8) {
      const v = (this.bitBuf >> (this.bitCnt - 8)) & 255;
      this.grow(2);
      this.out[this.pos++] = v;
      if (v === 255) this.out[this.pos++] = 0;
      this.bitCnt -= 8;
    }
    this.bitBuf &= (1 << this.bitCnt) - 1;
  }
  cat(v) { v = v < 0 ? -v : v; let c = 0; while (v) { c++; v >>= 1; } return c; }
  dct(d, ft) {
    for (let o = 0; o < 64; o += 8) {
      const t0 = d[o] + d[o+7], t7 = d[o] - d[o+7], t1 = d[o+1] + d[o+6], t6 = d[o+1] - d[o+6];
      const t2 = d[o+2] + d[o+5], t5 = d[o+2] - d[o+5], t3 = d[o+3] + d[o+4], t4 = d[o+3] - d[o+4];
      let a10 = t0 + t3; const a13 = t0 - t3; let a11 = t1 + t2; let a12 = t1 - t2;
      d[o] = a10 + a11; d[o+4] = a10 - a11;
      const z1 = (a12 + a13) * 0.707106781; d[o+2] = a13 + z1; d[o+6] = a13 - z1;
      a10 = t4 + t5; a11 = t5 + t6; a12 = t6 + t7;
      const z5 = (a10 - a12) * 0.382683433, z2 = 0.5411961 * a10 + z5, z4 = 1.306562965 * a12 + z5, z3 = a11 * 0.707106781;
      const z11 = t7 + z3, z13 = t7 - z3;
      d[o+5] = z13 + z2; d[o+3] = z13 - z2; d[o+1] = z11 + z4; d[o+7] = z11 - z4;
    }
    for (let o = 0; o < 8; o++) {
      const t0 = d[o] + d[o+56], t7 = d[o] - d[o+56], t1 = d[o+8] + d[o+48], t6 = d[o+8] - d[o+48];
      const t2 = d[o+16] + d[o+40], t5 = d[o+16] - d[o+40], t3 = d[o+24] + d[o+32], t4 = d[o+24] - d[o+32];
      let a10 = t0 + t3; const a13 = t0 - t3; let a11 = t1 + t2; let a12 = t1 - t2;
      d[o] = a10 + a11; d[o+32] = a10 - a11;
      const z1 = (a12 + a13) * 0.707106781; d[o+16] = a13 + z1; d[o+48] = a13 - z1;
      a10 = t4 + t5; a11 = t5 + t6; a12 = t6 + t7;
      const z5 = (a10 - a12) * 0.382683433, z2 = 0.5411961 * a10 + z5, z4 = 1.306562965 * a12 + z5, z3 = a11 * 0.707106781;
      const z11 = t7 + z3, z13 = t7 - z3;
      d[o+40] = z13 + z2; d[o+24] = z13 - z2; d[o+8] = z11 + z4; d[o+56] = z11 - z4;
    }
    const q = this.q;
    for (let i = 0; i < 64; i++) { const v = d[i] * ft[i]; q[i] = v > 0 ? (v + 0.5) | 0 : (v - 0.5) | 0; }
    const du = this.du;
    for (let i = 0; i < 64; i++) du[ZZ[i]] = q[i];
    return du;
  }
  block(d, ft, dc, hdc, hac) {
    const du = this.dct(d, ft);
    const diff = du[0] - dc;
    if (diff === 0) this.bits(hdc.code[0], hdc.len[0]);
    else { const c = this.cat(diff); this.bits(hdc.code[c], hdc.len[c]); this.bits(diff < 0 ? diff + (1 << c) - 1 : diff, c); }
    let end = 63; while (end > 0 && du[end] === 0) end--;
    if (end === 0) { this.bits(hac.code[0], hac.len[0]); return du[0]; }
    let i = 1;
    while (i <= end) {
      const start = i;
      while (du[i] === 0 && i <= end) i++;
      let nz = i - start;
      while (nz >= 16) { this.bits(hac.code[0xF0], hac.len[0xF0]); nz -= 16; }
      const v = du[i], c = this.cat(v);
      const sym = (nz << 4) + c;
      this.bits(hac.code[sym], hac.len[sym]);
      this.bits(v < 0 ? v + (1 << c) - 1 : v, c);
      i++;
    }
    if (end !== 63) this.bits(hac.code[0], hac.len[0]);
    return du[0];
  }
  // 16 satırlık bant kodla (band: w*16*4 RGBA)
  encodeBand(band) {
    const w = this.w, blk = this.blk;
    const cb = new Float32Array(64), cr = new Float32Array(64);
    for (let mx = 0; mx < w; mx += 16) {
      for (let by = 0; by < 2; by++) for (let bx = 0; bx < 2; bx++) {
        for (let y = 0; y < 8; y++) {
          const row = (by * 8 + y) * w;
          for (let x = 0; x < 8; x++) {
            let px = mx + bx * 8 + x; if (px >= w) px = w - 1;
            const i = (row + px) * 4;
            blk[y * 8 + x] = 0.299 * band[i] + 0.587 * band[i+1] + 0.114 * band[i+2] - 128;
          }
        }
        this.dcY = this.block(blk, this.fY, this.dcY, HT.ydc, HT.yac);
      }
      for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) {
        let r = 0, g = 0, bl = 0;
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          let px = mx + x * 2 + dx; if (px >= w) px = w - 1;
          const i = ((y * 2 + dy) * w + px) * 4;
          r += band[i]; g += band[i+1]; bl += band[i+2];
        }
        r *= 0.25; g *= 0.25; bl *= 0.25;
        cb[y * 8 + x] = -0.168736 * r - 0.331264 * g + 0.5 * bl;
        cr[y * 8 + x] = 0.5 * r - 0.418688 * g - 0.081312 * bl;
      }
      this.dcU = this.block(cb, this.fUV, this.dcU, HT.uvdc, HT.uvac);
      this.dcV = this.block(cr, this.fUV, this.dcV, HT.uvdc, HT.uvac);
    }
  }
  addRows(data, rows) {
    const rb = this.w * 4;
    for (let r = 0; r < rows; r++) {
      this.band.set(data.subarray(r * rb, (r + 1) * rb), this.bandRows * rb);
      this.bandRows++; this.rowsDone++;
      if (this.bandRows === 16) { this.encodeBand(this.band); this.bandRows = 0; }
    }
  }
  finish() {
    if (this.bandRows > 0) {
      const rb = this.w * 4;
      const last = this.band.subarray((this.bandRows - 1) * rb, this.bandRows * rb);
      for (let r = this.bandRows; r < 16; r++) this.band.set(last, r * rb);
      this.encodeBand(this.band); this.bandRows = 0;
    }
    if (this.bitCnt > 0) this.bits((1 << (8 - this.bitCnt)) - 1, 8 - this.bitCnt);
    this.wd(0xFFD9);
    return this.out.subarray(0, this.pos);
  }
}

let enc = null;
self.onmessage = (e) => {
  const m = e.data;
  try {
    if (m.cmd === 'start') { enc = new Enc(m.w, m.h, m.quality || 92); self.postMessage({ cmd: 'started' }); }
    else if (m.cmd === 'rows') { enc.addRows(new Uint8Array(m.data), m.rows); self.postMessage({ cmd: 'progress', done: enc.rowsDone, id: m.id }); }
    else if (m.cmd === 'finish') {
      const bytes = enc.finish(); enc = null;
      const blob = new Blob([bytes], { type: 'image/jpeg' });
      self.postMessage({ cmd: 'done', blob });
    }
  } catch (err) {
    self.postMessage({ cmd: 'error', message: String(err && err.message || err) });
  }
};
