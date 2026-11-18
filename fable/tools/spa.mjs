// lê o eixo da pista do SVG (path2840), amostra as béziers e imprime um polígono reamostrado
import fs from 'node:fs';
const s = fs.readFileSync('C:/Users/Murilo/Desktop/pista/Spa-Francorchamps_of_Belgium.svg', 'utf8');
const id = process.argv[2] || 'path2840', NP = +(process.argv[3] || 200);
const tag = s.match(new RegExp('<path[^>]*id="' + id + '"[^>]*>'))[0], d = tag.match(/\sd="([^"]*)"/)[1];
const tok = d.match(/[a-zA-Z]|-?\d*\.?\d+(?:e-?\d+)?/g);
let i = 0, x = 0, y = 0, sx = 0, sy = 0, cmd = '', pts = [], closed = false; const cmds = {};
const num = () => +tok[i++];
while (i < tok.length) {
  if (/[a-zA-Z]/.test(tok[i])) { cmd = tok[i++]; cmds[cmd] = (cmds[cmd] || 0) + 1; if (cmd === 'z' || cmd === 'Z') { closed = true; continue; } }
  const rel = cmd === cmd.toLowerCase(), C = cmd.toLowerCase();
  if (C === 'm') { const a = num(), b = num(); x = rel ? x + a : a; y = rel ? y + b : b; sx = x; sy = y; pts.push([x, y]); cmd = rel ? 'l' : 'L'; }
  else if (C === 'l') { const a = num(), b = num(); x = rel ? x + a : a; y = rel ? y + b : b; pts.push([x, y]); }
  else if (C === 'c') {
    const p = []; for (let k = 0; k < 6; k++) p.push(num()); const x1 = rel ? x + p[0] : p[0], y1 = rel ? y + p[1] : p[1], x2 = rel ? x + p[2] : p[2], y2 = rel ? y + p[3] : p[3], x3 = rel ? x + p[4] : p[4], y3 = rel ? y + p[5] : p[5];
    for (let k = 1; k <= 12; k++) { const t = k / 12, u = 1 - t; pts.push([u * u * u * x + 3 * u * u * t * x1 + 3 * u * t * t * x2 + t * t * t * x3, u * u * u * y + 3 * u * u * t * y1 + 3 * u * t * t * y2 + t * t * t * y3]); }
    x = x3; y = y3;
  } else throw new Error('comando ' + cmd);
}
const cum = [0]; for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
const L = cum[cum.length - 1], gap = Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]);
let area = 0; for (let k = 0; k < pts.length; k++) { const a = pts[k], b = pts[(k + 1) % pts.length]; area += a[0] * b[1] - b[0] * a[1]; }
const xs = pts.map(p => p[0]), ys = pts.map(p => p[1]);
console.error(JSON.stringify({ cmds, n: pts.length, L: +L.toFixed(1), gap: +gap.toFixed(2), closed, area2: +area.toFixed(0), bbox: [Math.min(...xs), Math.min(...ys), Math.max(...xs), Math.max(...ys)].map(v => +v.toFixed(1)), start: pts[0], dir0: [pts[6][0] - pts[0][0], pts[6][1] - pts[0][1]].map(v => +v.toFixed(1)) }));
// reamostra em NP pontos uniformes
const out = []; let j = 0;
for (let k = 0; k < NP; k++) { const t = k / NP * L; while (cum[j + 1] < t) j++; const f = (t - cum[j]) / (cum[j + 1] - cum[j]); out.push([pts[j][0] + (pts[j + 1][0] - pts[j][0]) * f, pts[j][1] + (pts[j + 1][1] - pts[j][1]) * f]); }
// desenho ASCII
const W = 110, H = 44, bx0 = Math.min(...xs), by0 = Math.min(...ys), bw = Math.max(...xs) - bx0, bh = Math.max(...ys) - by0, g = Array.from({ length: H }, () => Array(W).fill(' '));
out.forEach((p, k) => { const cx = Math.round((p[0] - bx0) / bw * (W - 1)), cy = Math.round((p[1] - by0) / bh * (H - 1)); g[cy][cx] = k === 0 ? 'S' : k % 10 === 0 ? String((k / 10) % 10) : g[cy][cx] === ' ' ? '.' : g[cy][cx]; });
console.error(g.map(r => r.join('')).join('\n'));
console.log(JSON.stringify(out.map(p => [+(p[0] - bx0).toFixed(1), +(p[1] - by0).toFixed(1)])));
