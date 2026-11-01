// zimbohCam — WebGL2 film motoru
// Tüm efektler GPU'da: ton eğrisi, renk, halation, bloom, grain, vinyet.

const VS = `#version 300 es
in vec2 aPos;
out vec2 vUv;
uniform float uFlipY;
void main(){
  vUv = aPos * 0.5 + 0.5;
  if (uFlipY > 0.5) vUv.y = 1.0 - vUv.y;
  gl_Position = vec4(aPos, 0.0, 1.0);
}`;

const COMMON = `#version 300 es
precision highp float;
precision highp int;
const float L0 = 0.5909090909;
const float BLO = 6.5;
const float BHI = 4.5;
const float CC = 6.0;
const float CP = 0.6;
const float CG = 1.175;
const vec3 LUMA = vec3(0.2126, 0.7152, 0.0722);
float sig(float x){ return 1.0/(1.0+exp(-x)); }
float curveN(float l){
  float a = sig(-CC*CP), b = sig(CC*(1.0-CP));
  return (sig(CC*(l-CP)) - a) / (b - a);
}
float encL(float x, float lo, float hi){
  float s = log2(max(x, 1e-7) / 0.18);
  return s < 0.0 ? L0 * (1.0 + s / lo) : L0 + (1.0 - L0) * s / hi;
}
float toneF(float x, float lo, float hi){
  return pow(max(curveN(clamp(encL(x, lo, hi), 0.0, 1.0)), 0.0), CG);
}
vec3 tone3(vec3 x, float lo, float hi){ return vec3(toneF(x.r,lo,hi), toneF(x.g,lo,hi), toneF(x.b,lo,hi)); }
float invT(float y){
  float f = pow(clamp(y, 0.0, 1.0), 1.0/CG);
  float a = sig(-CC*CP), b = sig(CC*(1.0-CP));
  float t = clamp(a + f*(b-a), 1e-6, 1.0-1e-6);
  float l = CP + log(t/(1.0-t)) / CC;
  float s = l < L0 ? (l/L0 - 1.0) * BLO : (l - L0) / (1.0 - L0) * BHI;
  return 0.18 * exp2(s);
}
vec3 inv3(vec3 c){ return vec3(invT(c.r), invT(c.g), invT(c.b)); }
`;

// Düşük çözünürlüklü parlak alan çıkarımı (halation + bloom kaynağı)
const FS_PREP = COMMON + `
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform int uSrcLinear;
uniform float uSrcGain;
uniform vec4 uSrcRect;
uniform vec4 uDstRect;
uniform vec2 uStep;
uniform float uExposure;
uniform vec3 uWB;
uniform float uHalThresh;
uniform float uBloomThresh;
uniform float uLowScale;
void main(){
  vec2 full = uDstRect.xy + vUv * uDstRect.zw;
  vec2 suv = (full - uSrcRect.xy) / uSrcRect.zw;
  vec3 acc = vec3(0.0); float hal = 0.0;
  for (int j = 0; j < 4; j++) for (int i = 0; i < 4; i++){
    vec2 off = (vec2(float(i), float(j)) - 1.5) * uStep;
    vec3 c = texture(uSrc, suv + off).rgb;
    vec3 x = uSrcLinear == 1 ? c * uSrcGain : inv3(c);
    x *= uExposure * uWB;
    float L = dot(x, LUMA);
    hal += max(L - uHalThresh, 0.0);
    acc += x * (max(L - uBloomThresh, 0.0) / max(L, 1e-4));
  }
  o = vec4(acc / 16.0, hal / 16.0) * uLowScale;
}`;

const FS_BLUR = `#version 300 es
precision highp float;
in vec2 vUv;
out vec4 o;
uniform sampler2D uTex;
uniform vec2 uDir;     // texel yönü
uniform float uSigma;  // piksel
void main(){
  float stepPx = max(1.0, uSigma * 3.0 / 12.0);
  vec4 acc = vec4(0.0); float ws = 0.0;
  for (int i = -12; i <= 12; i++){
    float d = float(i) * stepPx;
    float w = exp(-0.5 * d * d / max(uSigma * uSigma, 0.25));
    acc += texture(uTex, vUv + uDir * d) * w; ws += w;
  }
  o = acc / ws;
}`;

const FS_MAIN = COMMON + `
in vec2 vUv;
out vec4 o;
uniform sampler2D uSrc;
uniform sampler2D uLowA;
uniform sampler2D uLowB;
uniform int uSrcLinear;
uniform float uSrcGain;
uniform vec4 uSrcRect;
uniform vec4 uDstRect;
uniform vec4 uLowRect;
uniform vec2 uFull;       // tam görüntü piksel boyutu
uniform float uPxScale;   // çıktı pikseli başına tam görüntü pikseli
uniform float uGrainRef;  // grain referansı (kısa kenar, px)
uniform vec4 uImgRect;    // fotoğrafın kendisi (kırpma) — vinyet için
uniform int uFx;
uniform float uExposure;
uniform vec3 uWB;
uniform float uContrastK;
uniform float uLo, uHi;
uniform float uBlacks, uWhites;
uniform float uVignette;
uniform float uSat;
uniform int uMono;
uniform vec3 uShadowTint, uHighTint;
uniform float uGrainAmt, uGrainSize, uGrainColor;
uniform float uHalAmt; uniform vec3 uHalColor;
uniform float uBloomAmt;
uniform float uLowScale;
uniform uint uSeed;

uvec3 pcg3(uvec3 v){
  v = v * 1664525u + 1013904223u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  v ^= v >> 16u;
  v.x += v.y*v.z; v.y += v.z*v.x; v.z += v.x*v.y;
  return v;
}
vec3 h3(ivec2 p, uint s){
  uvec3 u = pcg3(uvec3(uint(p.x + 32768), uint(p.y + 32768), s));
  return vec3(u) * (1.0 / 4294967295.0) * 2.0 - 1.0;
}
vec3 vnoise(vec2 p, uint s){
  vec2 i = floor(p), f = fract(p);
  vec2 u = f*f*(3.0-2.0*f);
  ivec2 ii = ivec2(i);
  vec3 a = h3(ii, s), b = h3(ii + ivec2(1,0), s), c = h3(ii + ivec2(0,1), s), d = h3(ii + ivec2(1,1), s);
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}
float contrastC(float y, float k){
  const float p = 0.46;
  y = clamp(y, 0.0, 1.0);
  return y < p ? p * pow(y / p, k) : 1.0 - (1.0 - p) * pow((1.0 - y) / (1.0 - p), k);
}

void main(){
  vec2 full = uDstRect.xy + vUv * uDstRect.zw;
  vec2 suv = (full - uSrcRect.xy) / uSrcRect.zw;
  vec3 c = texture(uSrc, suv).rgb;
  if (uFx == 0){
    vec3 y0 = uSrcLinear == 1 ? tone3(c * uSrcGain, BLO, BHI) : c;
    o = vec4(clamp(y0, 0.0, 1.0), 1.0);
    return;
  }
  vec3 x = uSrcLinear == 1 ? c * uSrcGain : inv3(c);
  x *= uExposure * uWB;

  vec2 luv = (full - uLowRect.xy) / uLowRect.zw;
  float hal = texture(uLowA, luv).a / uLowScale;
  vec3 blo = texture(uLowB, luv).rgb / uLowScale;
  x += uHalColor * hal * uHalAmt;
  x += blo * uBloomAmt;

  float L = dot(x, LUMA);
  if (uMono == 1) x = vec3(dot(x, vec3(0.30, 0.56, 0.14)));
  else x = max(mix(vec3(L), x, uSat), 0.0);

  // vinyet
  vec2 iuv = (full - uImgRect.xy) / uImgRect.zw;
  vec2 isz = uImgRect.zw * uFull;
  vec2 vc = (iuv - 0.5) * vec2(isz.x / max(isz.x, isz.y), isz.y / max(isz.x, isz.y)) * 2.0;
  float vr = length(vc) / 1.41421;
  x *= 1.0 - uVignette * smoothstep(0.25, 1.05, vr);

  vec3 y = tone3(x, uLo, uHi);
  y = vec3(contrastC(y.r, uContrastK), contrastC(y.g, uContrastK), contrastC(y.b, uContrastK));

  if (uBlacks > 0.0) y = uBlacks * 0.22 + (1.0 - uBlacks * 0.22) * y;
  else y = max((y + uBlacks * 0.09) / (1.0 + uBlacks * 0.09), 0.0);
  if (uWhites < 0.0) y *= 1.0 + uWhites * 0.25;
  else y = y / (1.0 - uWhites * 0.2);

  float Y = dot(clamp(y, 0.0, 1.0), LUMA);
  y += uShadowTint * (1.0 - Y) * (1.0 - Y);
  y += uHighTint * Y * Y;

  // grain
  if (uGrainAmt > 0.0){
    float cell = max(uGrainSize * uGrainRef / 1500.0, 0.35);
    vec2 gp = full * uFull / cell;
    float k = max(1.0, uPxScale / cell);
    vec3 n = vnoise(gp, uSeed) * 0.8 + vnoise(gp * 2.07 + 17.3, uSeed + 7u) * 0.5;
    vec3 nm = vec3(n.r);
    vec3 g = mix(nm, n, uGrainColor);
    float Yc = clamp(Y, 0.0, 1.0);
    float w = 0.35 + 2.6 * Yc * (1.0 - Yc);
    y += g * (uGrainAmt / k) * w;
  }
  // çok hafif dither (bantlanmayı önler)
  vec3 dn = h3(ivec2(gl_FragCoord.xy), uSeed + 99u);
  y += dn * (0.5 / 255.0);
  o = vec4(clamp(y, 0.0, 1.0), 1.0);
}`;

const LOW_LONG = 384;

export class FilmEngine {
  constructor(canvas) {
    this.canvas = canvas;
    const gl = canvas.getContext('webgl2', { antialias: false, premultipliedAlpha: false, preserveDrawingBuffer: false, alpha: false });
    if (!gl) throw new Error('Bu cihaz WebGL2 desteklemiyor.');
    this.gl = gl;
    this.floatRT = !!gl.getExtension('EXT_color_buffer_float') || !!gl.getExtension('EXT_color_buffer_half_float');
    this.lowScale = this.floatRT ? 1.0 : 0.125;
    this.maxTex = gl.getParameter(gl.MAX_TEXTURE_SIZE);
    this.progPrep = this._prog(FS_PREP);
    this.progBlur = this._prog(FS_BLUR);
    this.progMain = this._prog(FS_MAIN);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    this.vao = gl.createVertexArray();
    gl.bindVertexArray(this.vao);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);
    this.low = null;
    this.srcTex = this._tex();
    this.outFbo = null;
    gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);
  }

  _prog(fs) {
    const gl = this.gl;
    const mk = (type, src) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error('Shader: ' + gl.getShaderInfoLog(s));
      return s;
    };
    const p = gl.createProgram();
    gl.attachShader(p, mk(gl.VERTEX_SHADER, VS));
    gl.attachShader(p, mk(gl.FRAGMENT_SHADER, fs));
    gl.bindAttribLocation(p, 0, 'aPos');
    gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error('Program: ' + gl.getProgramInfoLog(p));
    const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    p.u = {};
    for (let i = 0; i < n; i++) {
      const info = gl.getActiveUniform(p, i);
      p.u[info.name.replace(/\[0\]$/, '')] = gl.getUniformLocation(p, info.name);
    }
    return p;
  }

  _tex(filter) {
    const gl = this.gl;
    const t = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter || gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    return t;
  }

  _rt(w, h, float) {
    const gl = this.gl;
    const tex = this._tex();
    if (float && this.floatRT) gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA16F, w, h, 0, gl.RGBA, gl.HALF_FLOAT, null);
    else gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, w, h, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
    const fbo = gl.createFramebuffer();
    gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
    gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
    return { tex, fbo, w, h };
  }

  _ensureLow(aspect) {
    let w, h;
    if (aspect >= 1) { w = LOW_LONG; h = Math.max(8, Math.round(LOW_LONG / aspect)); }
    else { h = LOW_LONG; w = Math.max(8, Math.round(LOW_LONG * aspect)); }
    if (this.low && this.low.w === w && this.low.h === h) return this.low;
    const gl = this.gl;
    if (this.low) for (const k of ['prep', 't1', 'a', 't2', 'b']) { gl.deleteTexture(this.low[k].tex); gl.deleteFramebuffer(this.low[k].fbo); }
    this.low = { w, h, prep: this._rt(w, h, true), t1: this._rt(w, h, true), a: this._rt(w, h, true), t2: this._rt(w, h, true), b: this._rt(w, h, true) };
    return this.low;
  }

  // Kaynak yükleme --------------------------------------------------------
  // Video, canvas, ImageBitmap (ekran kodlu, 8 bit)
  uploadDisplay(el, tex) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex || this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, gl.RGBA, gl.UNSIGNED_BYTE, el);
  }
  // Doğrusal RAW verisi: Uint16Array (half float bitleri), RGB
  uploadHalfRGB(data, w, h, tex) {
    const gl = this.gl;
    gl.bindTexture(gl.TEXTURE_2D, tex || this.srcTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGB16F, w, h, 0, gl.RGB, gl.HALF_FLOAT, data);
  }
  createTexture() { return this._tex(); }
  deleteTexture(t) { this.gl.deleteTexture(t); }

  // Ana çizim -------------------------------------------------------------
  // opts: { src:{tex, linear, gain, rect}, lowSrc:{tex, linear, gain, rect, w, h}, dst:rect,
  //         full:[w,h], grainRef, outW, outH, target: null|fbo, params(uniforms), fx, seed, flipY, lowRect }
  render(o) {
    const gl = this.gl;
    const u = o.u;
    gl.bindVertexArray(this.vao);
    const lowRect = o.lowRect || o.dst;
    const fx = o.fx && u;

    if (fx && !o.reuseLow) {
      const lowAspect = (lowRect[2] * o.full[0]) / (lowRect[3] * o.full[1]);
      const L = this._ensureLow(lowAspect);
      const ls = o.lowSrc || o.src;
      // prep
      let p = this.progPrep;
      gl.useProgram(p);
      gl.bindFramebuffer(gl.FRAMEBUFFER, L.prep.fbo);
      gl.viewport(0, 0, L.w, L.h);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, ls.tex);
      gl.uniform1i(p.u.uSrc, 0);
      gl.uniform1i(p.u.uSrcLinear, ls.linear ? 1 : 0);
      gl.uniform1f(p.u.uSrcGain, ls.gain || 1);
      gl.uniform4fv(p.u.uSrcRect, ls.rect || [0, 0, 1, 1]);
      gl.uniform4fv(p.u.uDstRect, lowRect);
      // 4x4 örnek aralığı: düşük çözünürlük pikselini kaynak uv'de kapla
      const srW = ls.rect ? ls.rect[2] : 1, srH = ls.rect ? ls.rect[3] : 1;
      gl.uniform2f(p.u.uStep, (lowRect[2] / srW) / L.w / 4, (lowRect[3] / srH) / L.h / 4);
      gl.uniform1f(p.u.uExposure, u.exposure);
      gl.uniform3fv(p.u.uWB, u.wb);
      gl.uniform1f(p.u.uHalThresh, u.halThresh);
      gl.uniform1f(p.u.uBloomThresh, u.halThresh * 0.6);
      gl.uniform1f(p.u.uLowScale, this.lowScale);
      gl.uniform1f(p.u.uFlipY, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      // bulanıklık
      const shortLow = Math.min(L.w, L.h);
      const blur = (src, dst, dx, dy, sigma) => {
        const b = this.progBlur;
        gl.useProgram(b);
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.fbo);
        gl.viewport(0, 0, L.w, L.h);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, src.tex);
        gl.uniform1i(b.u.uTex, 0);
        gl.uniform2f(b.u.uDir, dx / L.w, dy / L.h);
        gl.uniform1f(b.u.uSigma, sigma);
        gl.uniform1f(b.u.uFlipY, 0);
        gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      };
      // düşük çözünürlük, tam görüntünün kısa kenarına göre ölçekle
      const lowShortFull = Math.min(lowRect[2] * o.full[0], lowRect[3] * o.full[1]);
      const ref = o.grainRef || lowShortFull;
      const toLow = shortLow / lowShortFull * ref; // sigma oranını düşük piksele çevir
      const sH = Math.max(0.6, u.halSigma * toLow);
      const sB = Math.max(1.0, u.bloomSigma * toLow);
      blur(L.prep, L.t1, 1, 0, sH); blur(L.t1, L.a, 0, 1, sH);
      blur(L.prep, L.t2, 1, 0, sB); blur(L.t2, L.b, 0, 1, sB);
    }

    const p = this.progMain;
    gl.useProgram(p);
    gl.bindFramebuffer(gl.FRAMEBUFFER, o.target ? o.target.fbo : null);
    gl.viewport(0, 0, o.outW, o.outH);
    gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, o.src.tex);
    gl.uniform1i(p.u.uSrc, 0);
    if (this.low) {
      gl.activeTexture(gl.TEXTURE1); gl.bindTexture(gl.TEXTURE_2D, this.low.a.tex);
      gl.activeTexture(gl.TEXTURE2); gl.bindTexture(gl.TEXTURE_2D, this.low.b.tex);
    }
    gl.uniform1i(p.u.uLowA, 1);
    gl.uniform1i(p.u.uLowB, 2);
    gl.uniform1i(p.u.uSrcLinear, o.src.linear ? 1 : 0);
    gl.uniform1f(p.u.uSrcGain, o.src.gain || 1);
    gl.uniform4fv(p.u.uSrcRect, o.src.rect || [0, 0, 1, 1]);
    gl.uniform4fv(p.u.uDstRect, o.dst);
    gl.uniform4fv(p.u.uLowRect, lowRect);
    gl.uniform4fv(p.u.uImgRect, o.imgRect || [0, 0, 1, 1]);
    gl.uniform2f(p.u.uFull, o.full[0], o.full[1]);
    gl.uniform1f(p.u.uPxScale, (o.dst[2] * o.full[0]) / o.outW);
    gl.uniform1f(p.u.uGrainRef, o.grainRef || Math.min(o.full[0], o.full[1]));
    gl.uniform1i(p.u.uFx, fx ? 1 : 0);
    gl.uniform1f(p.u.uFlipY, o.flipY ? 1 : 0);
    gl.uniform1ui(p.u.uSeed, (o.seed >>> 0) || 1);
    if (fx) {
      gl.uniform1f(p.u.uExposure, u.exposure);
      gl.uniform3fv(p.u.uWB, u.wb);
      gl.uniform1f(p.u.uContrastK, u.contrastK);
      gl.uniform1f(p.u.uLo, u.lo);
      gl.uniform1f(p.u.uHi, u.hi);
      gl.uniform1f(p.u.uBlacks, u.blacks);
      gl.uniform1f(p.u.uWhites, u.whites);
      gl.uniform1f(p.u.uVignette, u.vignette);
      gl.uniform1f(p.u.uSat, u.sat);
      gl.uniform1i(p.u.uMono, u.mono);
      gl.uniform3fv(p.u.uShadowTint, u.shadowTint);
      gl.uniform3fv(p.u.uHighTint, u.highTint);
      gl.uniform1f(p.u.uGrainAmt, u.grainAmt);
      gl.uniform1f(p.u.uGrainSize, u.grainSize);
      gl.uniform1f(p.u.uGrainColor, u.grainColor);
      gl.uniform1f(p.u.uHalAmt, u.halAmt);
      gl.uniform3fv(p.u.uHalColor, u.halColor);
      gl.uniform1f(p.u.uBloomAmt, u.bloomAmt);
      gl.uniform1f(p.u.uLowScale, this.lowScale);
    }
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
  }

  // Ekran dışı hedef (çekim/dışa aktarım için)
  makeTarget(w, h) { return this._rt(w, h, false); }
  freeTarget(t) { const gl = this.gl; gl.deleteTexture(t.tex); gl.deleteFramebuffer(t.fbo); }
  readTarget(t, out) {
    const gl = this.gl;
    gl.bindFramebuffer(gl.FRAMEBUFFER, t.fbo);
    const buf = out || new Uint8Array(t.w * t.h * 4);
    gl.readPixels(0, 0, t.w, t.h, gl.RGBA, gl.UNSIGNED_BYTE, buf);
    return buf;
  }
}

// RAW: 16 bit doğrusal → half float LUT
let HALF_LUT = null;
export function halfLUT() {
  if (HALF_LUT) return HALF_LUT;
  const f32 = new Float32Array(1), u32 = new Uint32Array(f32.buffer);
  HALF_LUT = new Uint16Array(65536);
  for (let i = 0; i < 65536; i++) {
    f32[0] = i / 65535;
    const x = u32[0];
    const sign = (x >>> 16) & 0x8000;
    let e = ((x >>> 23) & 0xff) - 127 + 15;
    let m = x & 0x7fffff;
    let h;
    if (e <= 0) {
      if (e < -10) h = 0;
      else { m = (m | 0x800000) >> (1 - e); h = (m + 0x1000) >> 13; }
    } else if (e >= 31) h = 0x7c00;
    else { h = (e << 10) + ((m + 0x1000) >> 13); if (h >= 0x7c00) h = 0x7bff; }
    HALF_LUT[i] = sign | h;
  }
  return HALF_LUT;
}
