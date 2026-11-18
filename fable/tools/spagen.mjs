// gera source/js/10_track_b_spa.js a partir do polígono extraído do SVG (spa.json, 400 pontos em unidades do SVG)
import fs from 'node:fs';
const [inp, out] = process.argv.slice(2), P0 = JSON.parse(fs.readFileSync(inp, 'utf8')), n = P0.length, SH = 7, P = P0.map((_, i) => P0[(i + SH) % n]);
// relevo: [distância desde a largada (m), altura relativa à largada (m)], pelo mapa de elevação (máximo 470 m em Les Combes, mínimo 373 m em Paul Frère)
const EL = [[0, 0], [308, 7], [400, 6.5], [955, -24], [1250, 12], [1580, 26], [2298, 67], [2530, 64], [2980, 42], [3280, 28], [3690, 6], [3980, -6], [4365, -18], [4800, -29], [5080, -30], [5770, -20], [6080, -12], [6625, -3], [6988, 0]];
const K = 7004 / 4817;   // unidades do SVG → metros (a volta real tem 7004 m)
const d = [P[3][0] - P[n - 3][0], P[3][1] - P[n - 3][1]], th = Math.atan2(d[1], d[0]), c = Math.cos(th), s = Math.sin(th);
const pts = P.map(p => { const dx = (p[0] - P[0][0]) * K, dz = (p[1] - P[0][1]) * K; return [Math.round((c * dx + s * dz - 60) * 10) / 10, Math.round((-s * dx + c * dz) * 10) / 10]; });
const xs = pts.map(p => p[0]), zs = pts.map(p => p[1]);
console.log('extensão', Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs));
fs.writeFileSync(out, `// Segundo mapa (tecla P): Spa-Francorchamps em tamanho real (7 km).
// O eixo vem do mapa oficial do traçado (SVG), reamostrado em ${n} pontos; aqui já em metros, girado para a reta de largada
// apontar para +X e a linha de chegada ficar no mesmo lugar do circuito original. Sentido horário, como o de verdade.
const SPA_PTS = [${pts.map(p => p[0] + ',' + p[1]).join(', ')}];
// Relevo: altura (m; a linha de largada é o zero) por fração da volta, seguindo o mapa de elevação do circuito: a reta
// dos boxes sobe de leve até La Source; dali DESCE até a Eau Rouge, sobe o Raidillon e a reta Kemmel até Les Combes (ponto
// mais alto, 470 m), desce por Rivage, Pouhon e Fagnes até Stavelot / Paul Frère (ponto mais baixo, 373 m) e volta a subir
// por Blanchimont até a chicane. As chaves ficam nas curvas de verdade do traçado.
const SPA_ELEV = [${EL.map(k => '[' + +(k[0] / 6988).toFixed(4) + ', ' + k[1] + ']').join(', ')}];
// eixo em amostras de 0,5 m (Catmull-Rom fechada pelos pontos)
function spaRaw(raw) {
  const n = SPA_PTS.length / 2, P = i => { i = ((i % n) + n) % n; return [SPA_PTS[i * 2], SPA_PTS[i * 2 + 1]]; };
  for (let i = 0; i < n; i++) {
    const a = P(i - 1), b = P(i), c = P(i + 1), d = P(i + 2), m = Math.max(1, Math.round(Math.hypot(c[0] - b[0], c[1] - b[1]) / 0.5));
    for (let k = 0; k < m; k++) {
      const t = k / m, t2 = t * t, t3 = t2 * t, w0 = -0.5 * t3 + t2 - 0.5 * t, w1 = 1.5 * t3 - 2.5 * t2 + 1, w2 = -1.5 * t3 + 2 * t2 + 0.5 * t, w3 = 0.5 * t3 - 0.5 * t2;
      raw.push([a[0] * w0 + b[0] * w1 + c[0] * w2 + d[0] * w3, a[1] * w0 + b[1] * w1 + c[1] * w2 + d[1] * w3]);
    }
  }
}
function spaElev(f) {
  const E = SPA_ELEV; let q = 1; while (q < E.length - 1 && E[q][0] < f) q++;
  const a = E[q - 1], b = E[q], t = sat((f - a[0]) / (b[0] - a[0]));
  return a[1] + (b[1] - a[1]) * (0.5 - 0.5 * Math.cos(t * PI));
}
// trechos em curva tirados da curvatura suavizada (kb), no formato que zebras, brita, pneus e adereços esperam
function spaSegs(kb) {
  const N = TRK.N, ds = TRK.ds, TH = 1 / 260; let i = 0;
  while (i < N) {
    if (Math.abs(kb[i]) < TH) { i++; continue; }
    const sg = Math.sign(kb[i]); let j = i, ang = 0;
    while (j < N && Math.abs(kb[j]) >= TH && Math.sign(kb[j]) === sg) { ang += kb[j] * ds; j++; }
    const len = (j - i) * ds, deg = ang * 180 / PI;
    if (len > 10 && Math.abs(deg) > 8) TRK.segs.push({ type: 'A', s0: i * ds, s1: j * ds, k: ang / len, name: '', R: len / Math.abs(ang), ang: deg });
    i = j;
  }
}
// relevo regional: média das alturas da pista ponderada pela distância (o terreno acompanha o circuito, sem aterros enormes)
function spaReg(x, z) {
  const R = TRK.reg; let sw = 0, sh = 0;
  for (let i = 0; i < R.length; i += 3) { const dx = x - R[i], dz = z - R[i + 1], q = dx * dx + dz * dz + 8100, w = 1 / (q * q); sw += w; sh += w * R[i + 2]; }
  return sh / sw;
}
`);
