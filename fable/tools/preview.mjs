// Pré-visualização em software das malhas dos carros (sem GPU): node preview.mjs <source> <saida> [carros] [vistas]
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
const src = process.argv[2], out = process.argv[3], cars = (process.argv[4] || '0').split(',').map(Number), only = process.argv[5] ? process.argv[5].split(',') : null;
const files = fs.readdirSync(path.join(src, 'js')).filter(f => /^(00_math|02_mesh|30_car_)/.test(f)).sort();
let code = `const BUILD = [], GAME = {}, R = { drawables: [], transparents: [] }, Q = new Map();\n`;
for (const f of files) code += fs.readFileSync(path.join(src, 'js', f), 'utf8') + '\n';
code += `
return function (i) {
  const mb = new MeshBuilder(1 << 17), gl = new MeshBuilder(1 << 14), w = new MeshBuilder(1 << 15), wb = new MeshBuilder(1 << 11);
  const t0 = Date.now();
  if (typeof carBuildCar === 'function') carBuildCar(i, mb, gl, w, wb);
  else { carShapeInit(); carWindowsInit(); carSeamInit(); carBuildBody(mb, gl); carBuildParts(mb, gl); carBuildWheel(w, wb); }
  const hubs = typeof CARDEFS !== 'undefined' ? CARDEFS[i].hubs : CAR.hubs;
  return { mb, gl, w, hubs, ms: Date.now() - t0, name: typeof CARDEFS !== 'undefined' ? CARDEFS[i].id : 'uno', paint: typeof CARDEFS !== 'undefined' ? CARDEFS[i].paint : [0.168, 0.275, 0.425] };
};`;
const build = new Function(code)();

function png(W, H, rgba) {
  const raw = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) { raw[y * (W * 4 + 1)] = 0; rgba.copy(raw, y * (W * 4 + 1) + 1, y * W * 4, (y + 1) * W * 4); }
  const crcT = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; crcT[n] = c >>> 0; }
  const crc = b => { let c = 0xffffffff; for (const x of b) c = crcT[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
  const chunk = (t, d) => { const l = Buffer.alloc(4); l.writeUInt32BE(d.length); const td = Buffer.concat([Buffer.from(t), d]); const c = Buffer.alloc(4); c.writeUInt32BE(crc(td)); return Buffer.concat([l, td, c]); };
  const ih = Buffer.alloc(13); ih.writeUInt32BE(W, 0); ih.writeUInt32BE(H, 4); ih[8] = 8; ih[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ih), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
const norm = v => { const l = Math.hypot(...v); return v.map(x => x / l); };
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
const VIEWS = {
  lado: { d: [0, 0, -1], up: [0, 1, 0], c: [0, 0.75, 0], s: 250, W: 1200, H: 480 },
  frente: { d: [-1, 0, 0], up: [0, 1, 0], c: [0, 0.75, 0], s: 330, W: 700, H: 560 },
  tras: { d: [1, 0, 0], up: [0, 1, 0], c: [0, 0.75, 0], s: 330, W: 700, H: 560 },
  cima: { d: [0, -1, 0], up: [1, 0, 0], c: [0, 0.75, 0], s: 250, W: 520, H: 1200 },
  f34: { d: norm([-1, -0.38, -0.75]), up: [0, 1, 0], c: [0, 0.7, 0], s: 230, W: 1200, H: 640 },
  t34: { d: norm([1, -0.42, 0.8]), up: [0, 1, 0], c: [0, 0.7, 0], s: 230, W: 1200, H: 640 },
};
function render(car, vn) {
  const V = VIEWS[vn], W = V.W, H = V.H, d = V.d, r = norm(cross(d, V.up)), u = cross(r, d);
  const col = new Float32Array(W * H * 3), zb = new Float32Array(W * H).fill(1e9);
  for (let i = 0; i < W * H; i++) { col[i * 3] = 0.55; col[i * 3 + 1] = 0.58; col[i * 3 + 2] = 0.6; }
  const L = norm([-d[0] + 0.3 * r[0] + 0.5 * u[0], -d[1] + 0.3 * r[1] + 0.5 * u[1], -d[2] + 0.3 * r[2] + 0.5 * u[2]]);
  const matCol = (id, a, c) => {
    if (id === 1) return a > 200 ? car.paint.map(x => x * 0.8) : car.paint;
    if (id === 12) return a ? [0.85, 0.85, 0.9] : [0.75, 0.7, 0.45];
    if (id === 7) return [0.8, 0.82, 0.85];
    if (id === 9) return c.map(x => Math.min(1, x * 1.2 + 0.05));
    if (id === 5 || id === 10 || id === 14 || id === 15) return c;
    return c.map(x => Math.min(1, x * 2.2 + 0.035));
  };
  const draw = (m, xf, glass) => {
    const f = m.f32, s16 = m.i16, u8 = m.u8, P = [], N = [];
    for (let i = 0; i < m.nv; i++) {
      let p = [f[i * 9], f[i * 9 + 1], f[i * 9 + 2]], n = [s16[i * 18 + 6] / 32767, s16[i * 18 + 7] / 32767, s16[i * 18 + 8] / 32767];
      if (xf) { p = xf(p, false); n = xf(n, true); }
      const q = [p[0] - V.c[0], p[1] - V.c[1], p[2] - V.c[2]];
      P.push([W / 2 + dot(q, r) * V.s, H / 2 - dot(q, u) * V.s, dot(q, d)]); N.push(n);
    }
    for (let t = 0; t < m.ni; t += 3) {
      const ia = m.idx[t], ib = m.idx[t + 1], ic = m.idx[t + 2], a = P[ia], b = P[ib], c = P[ic];
      const area = (b[0] - a[0]) * (c[1] - a[1]) - (c[0] - a[0]) * (b[1] - a[1]); if (Math.abs(area) < 1e-9) continue;
      const x0 = Math.max(0, Math.floor(Math.min(a[0], b[0], c[0]))), x1 = Math.min(W - 1, Math.ceil(Math.max(a[0], b[0], c[0])));
      const y0 = Math.max(0, Math.floor(Math.min(a[1], b[1], c[1]))), y1 = Math.min(H - 1, Math.ceil(Math.max(a[1], b[1], c[1])));
      const id = u8[ia * 36 + 28], pa = u8[ia * 36 + 29], vc = [u8[ia * 36 + 32] / 255, u8[ia * 36 + 33] / 255, u8[ia * 36 + 34] / 255];
      if (area > 0 && !glass) continue;   // face de trás: descartada como no jogo
      const base = glass ? [0.5, 0.7, 0.75] : matCol(id, pa, vc), back = area > 0;   // área > 0 na tela (y para baixo) = face de trás
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        const px = x + 0.5, py = y + 0.5;
        const w0 = ((b[0] - px) * (c[1] - py) - (c[0] - px) * (b[1] - py)) / area, w1 = ((c[0] - px) * (a[1] - py) - (a[0] - px) * (c[1] - py)) / area, w2 = 1 - w0 - w1;
        if (w0 < 0 || w1 < 0 || w2 < 0) continue;
        const z = w0 * a[2] + w1 * b[2] + w2 * c[2], k = y * W + x; if (z >= zb[k]) continue;
        const n = [0, 1, 2].map(j => w0 * N[ia][j] + w1 * N[ib][j] + w2 * N[ic][j]);
        let sh = dot(norm(n), L); if (back) sh = -sh * 0.5; sh = 0.3 + 0.7 * Math.max(0, sh);
        if (glass) { for (let j = 0; j < 3; j++) col[k * 3 + j] = col[k * 3 + j] * 0.55 + base[j] * 0.45 * sh; }
        else { zb[k] = z; for (let j = 0; j < 3; j++) col[k * 3 + j] = (back && !glass ? 0.6 : 1) * base[j] * sh; }
      }
    }
  };
  draw(car.mb);
  car.hubs.forEach((h, i) => {
    const left = (i & 1) === 0, sg = left ? -1 : 1;
    draw(car.w, (p, isN) => [sg * p[0] + (isN ? 0 : h[0]), p[1] + (isN ? 0 : h[1]), sg * p[2] + (isN ? 0 : h[2])]);
  });
  draw(car.gl, null, true);
  const rgba = Buffer.alloc(W * H * 4);
  for (let i = 0; i < W * H; i++) { for (let j = 0; j < 3; j++) rgba[i * 4 + j] = Math.round(255 * Math.pow(Math.min(1, col[i * 3 + j]), 1 / 2.2)); rgba[i * 4 + 3] = 255; }
  return png(W, H, rgba);
}
fs.mkdirSync(out, { recursive: true });
for (const i of cars) {
  const car = build(i);
  let bad = 0; for (let k = 0; k < car.mb.nv * 9; k++) if (k % 9 < 3 && !Number.isFinite(car.mb.f32[k])) bad++;
  const b = car.mb.bounds();
  console.log(`${car.name}: ${car.ms} ms, corpo ${car.mb.nv} v / ${car.mb.ni / 3} t, vidro ${car.gl.ni / 3} t, roda ${car.w.ni / 3} t, NaN ${bad}, x ${b.min[0].toFixed(3)}..${b.max[0].toFixed(3)} y ${b.min[1].toFixed(3)}..${b.max[1].toFixed(3)} z ${b.min[2].toFixed(3)}..${b.max[2].toFixed(3)}`);
  for (const vn of Object.keys(VIEWS)) if (!only || only.includes(vn)) fs.writeFileSync(path.join(out, `${car.name}-${vn}.png`), render(car, vn));
}
